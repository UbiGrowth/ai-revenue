import { buildContext as buildContextInternal } from './context-builder';

export interface ProjectContext {
  files: Record<string, string>;
  totalSize: number;
  truncated: boolean;
  repoPath: string;
  prompt: string;
}

/**
 * Gather project context by building and converting ContextResult to ProjectContext
 */
export async function gatherContext(
  repoPath: string,
  prompt: string
): Promise<ProjectContext> {
  const result = await buildContextInternal(repoPath, prompt);
  
  // Convert Map to Record
  const filesRecord: Record<string, string> = Object.fromEntries(result.files);

  return {
    files: filesRecord,
    totalSize: result.totalSize,
    truncated: result.truncated,
    repoPath,
    prompt
  };
}

/**
 * Gather project context by converting ContextResult to ProjectContext
 */
export function gatherProjectContext(
  repoPath: string,
  prompt: string,
  files: Map<string, string>,
  totalSize: number,
  truncated: boolean
): ProjectContext {
  // Convert Map to Record
  const filesRecord: Record<string, string> = Object.fromEntries(files);

  return {
    files: filesRecord,
    totalSize,
    truncated,
    repoPath,
    prompt
  };
}

/**
 * Get list of file paths from ProjectContext
 */
export function getContextFiles(context: ProjectContext): string[] {
  return Object.keys(context.files).sort();
}

/**
 * Get file content from ProjectContext
 */
export function getFileContent(context: ProjectContext, filePath: string): string | undefined {
  return context.files[filePath];
}

/**
 * Check if a file exists in the context
 */
export function hasFile(context: ProjectContext, filePath: string): boolean {
  return filePath in context.files;
}
