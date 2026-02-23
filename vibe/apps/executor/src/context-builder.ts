import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const MAX_CONTEXT_SIZE = parseInt(process.env.MAX_CONTEXT_SIZE || '50000', 10);

export interface ContextResult {
  files: Map<string, string>;
  totalSize: number;
  truncated: boolean;
}

// Build deterministic context: ripgrep for files + 1-hop import resolution
export async function buildContext(repoPath: string, prompt: string): Promise<ContextResult> {
  const files = new Map<string, string>();
  let totalSize = 0;
  let truncated = false;

  // Debug: Log scan root path
  console.log(`[Context Builder] Scanning repository at: ${repoPath}`);

  // Step 1: Use ripgrep to find relevant files based on keywords from prompt
  const keywords = extractKeywords(prompt);
  const discoveredFiles = new Set<string>();

  console.log(`[Context Builder] Extracted keywords from prompt: ${keywords.join(', ')}`);

  // Search for each keyword
  for (const keyword of keywords) {
    try {
      const rgResult = execSync(
        `rg -l "${keyword}" --type-add 'code:*.{js,ts,jsx,tsx,py,go,java,c,cpp,h,hpp}' -t code`,
        { cwd: repoPath, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
      );
      
      const foundFiles = rgResult.trim().split('\n').filter(f => f);
      console.log(`[Context Builder] Keyword "${keyword}" found in ${foundFiles.length} files`);
      foundFiles.forEach(f => discoveredFiles.add(f));
    } catch (error) {
      // No matches for this keyword, continue
      console.log(`[Context Builder] Keyword "${keyword}" found 0 matches`);
    }
  }

  console.log(`[Context Builder] Total files discovered by ripgrep: ${discoveredFiles.size}`);

  // If no files found, include common entry points
  if (discoveredFiles.size === 0) {
    console.log('[Context Builder] No files found by ripgrep, trying common entry points...');
    const commonEntries = [
      'index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.ts',
      'src/index.js', 'src/index.ts', 'src/main.js', 'src/main.ts',
      // apps/web entry points (monorepo support)
      'apps/web/src/App.tsx', 'apps/web/src/App.jsx',
      'apps/web/src/main.tsx', 'apps/web/src/main.jsx',
      'apps/web/index.html',
      'apps/web/package.json',
      'apps/web/vite.config.ts', 'apps/web/vite.config.js'
    ];
    
    for (const entry of commonEntries) {
      const fullPath = path.join(repoPath, entry);
      if (fs.existsSync(fullPath)) {
        console.log(`[Context Builder] Found common entry point: ${entry}`);
        discoveredFiles.add(entry);
        // Continue to add all existing entry points, don't break
      }
    }
  }

  // Guard: If still no files found, include README.md and/or package.json from repo root
  if (discoveredFiles.size === 0) {
    console.log('[Context Builder] No entry points found, checking for README.md and package.json...');
    const fallbackFiles = ['README.md', 'package.json', 'readme.md', 'README', 'README.txt'];
    
    for (const fallback of fallbackFiles) {
      const fullPath = path.join(repoPath, fallback);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        console.log(`[Context Builder] Adding fallback file: ${fallback}`);
        discoveredFiles.add(fallback);
      }
    }
    
    if (discoveredFiles.size === 0) {
      console.warn('[Context Builder] WARNING: No files could be found in repository!');
    }
  }

  // Sort files alphabetically for deterministic ordering
  const sortedFiles = Array.from(discoveredFiles).sort();

  console.log(`[Context Builder] Files to process (before filtering): ${sortedFiles.length}`);
  if (sortedFiles.length > 0 && sortedFiles.length <= 20) {
    console.log(`[Context Builder] File list: ${sortedFiles.join(', ')}`);
  } else if (sortedFiles.length > 20) {
    console.log(`[Context Builder] File list (first 20): ${sortedFiles.slice(0, 20).join(', ')}...`);
  }

  // Step 2: For each file, add its content and resolve 1-hop imports
  const processedFiles = new Set<string>();
  const skippedFiles: string[] = [];
  
  for (const filePath of sortedFiles) {
    if (totalSize >= MAX_CONTEXT_SIZE) {
      truncated = true;
      console.log(`[Context Builder] Context size limit reached (${MAX_CONTEXT_SIZE} chars), truncating`);
      break;
    }

    const sizeBefore = files.size;
    await addFileWithImports(repoPath, filePath, files, processedFiles, totalSize);
    totalSize = Array.from(files.values()).reduce((sum, content) => sum + content.length, 0);
    
    // Track if file was skipped
    if (files.size === sizeBefore && !processedFiles.has(filePath)) {
      skippedFiles.push(filePath);
    }
  }

  console.log(`[Context Builder] Final context: ${files.size} files, ${totalSize} chars`);
  if (skippedFiles.length > 0) {
    console.log(`[Context Builder] Skipped ${skippedFiles.length} files (not found or unreadable): ${skippedFiles.slice(0, 10).join(', ')}${skippedFiles.length > 10 ? '...' : ''}`);
  }

  return { files, totalSize, truncated };
}

async function addFileWithImports(
  repoPath: string,
  filePath: string,
  files: Map<string, string>,
  processedFiles: Set<string>,
  currentSize: number
): Promise<void> {
  if (processedFiles.has(filePath) || currentSize >= MAX_CONTEXT_SIZE) {
    return;
  }

  const fullPath = path.join(repoPath, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`[Context Builder] Skipping ${filePath}: file not found at ${fullPath}`);
    return;
  }

  const stat = fs.statSync(fullPath);
  if (!stat.isFile()) {
    console.log(`[Context Builder] Skipping ${filePath}: not a regular file`);
    return;
  }

  // Read file content
  let content: string;
  try {
    content = fs.readFileSync(fullPath, 'utf-8');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[Context Builder] Skipping ${filePath}: cannot read file (${message})`);
    return; // Skip files we can't read
  }

  files.set(filePath, content);
  processedFiles.add(filePath);

  // Parse imports (1-hop only)
  const imports = parseImports(content, filePath);
  
  for (const importPath of imports) {
    if (currentSize >= MAX_CONTEXT_SIZE) {
      break;
    }

    const resolvedPath = resolveImportPath(repoPath, filePath, importPath);
    if (resolvedPath && !processedFiles.has(resolvedPath)) {
      await addFileWithImports(repoPath, resolvedPath, files, processedFiles, currentSize);
      currentSize = Array.from(files.values()).reduce((sum, c) => sum + c.length, 0);
    }
  }
}

function extractKeywords(prompt: string): string[] {
  // Extract meaningful words (longer than 3 chars, not common words)
  const commonWords = new Set(['the', 'this', 'that', 'with', 'from', 'for', 'and', 'or']);
  const words = prompt.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  return words.filter(w => !commonWords.has(w)).slice(0, 5); // Top 5 keywords
}

function parseImports(content: string, filePath: string): string[] {
  const imports: string[] = [];
  const ext = path.extname(filePath);

  if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
    // JavaScript/TypeScript imports
    const importRegex = /import\s+.*?from\s+['"](.+?)['"]/g;
    const requireRegex = /require\(['"](.+?)['"]\)/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
  } else if (ext === '.py') {
    // Python imports
    const importRegex = /(?:from\s+(\S+)\s+import|import\s+(\S+))/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const module = match[1] || match[2];
      if (module && !module.startsWith('.')) {
        continue; // Skip stdlib/external packages
      }
      imports.push(module);
    }
  }

  return imports;
}

function resolveImportPath(repoPath: string, fromFile: string, importPath: string): string | null {
  // Skip external packages
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null;
  }

  const fromDir = path.dirname(fromFile);
  let resolved = path.normalize(path.join(fromDir, importPath));

  // Try different extensions
  const extensions = ['', '.js', '.ts', '.jsx', '.tsx', '.py', '/index.js', '/index.ts'];
  
  for (const ext of extensions) {
    const candidate = resolved + ext;
    const fullPath = path.join(repoPath, candidate);
    
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return candidate;
    }
  }

  return null;
}

export function formatContext(files: Map<string, string>): string {
  // Sort by filename for deterministic output
  const sortedEntries = Array.from(files.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  
  let context = '';
  for (const [filePath, content] of sortedEntries) {
    context += `\n--- ${filePath} ---\n${content}\n`;
  }

  return context;
}
