import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildContext } from './context-builder';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Context Builder Monorepo Test Suite
 * 
 * Tests that the context builder properly handles monorepo entry points
 * specifically for apps/web directory structure
 */

describe('Context Builder - Monorepo apps/web Support', () => {
  it('should find apps/web/src/App.tsx when no ripgrep matches', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-context-test-'));
    
    try {
      // Create apps/web structure
      const appsWebSrcDir = path.join(tempDir, 'apps', 'web', 'src');
      fs.mkdirSync(appsWebSrcDir, { recursive: true });
      
      // Create App.tsx
      const appTsxPath = path.join(appsWebSrcDir, 'App.tsx');
      fs.writeFileSync(appTsxPath, 'function App() { return <div>Hello</div>; }');
      
      // Build context with unrelated keywords
      const prompt = 'Update the documentation';
      const result = await buildContext(tempDir, prompt);
      
      // Should have found apps/web/src/App.tsx as fallback
      assert.ok(result.files.size > 0, 'Context should not be empty');
      assert.ok(
        result.files.has('apps/web/src/App.tsx'), 
        'Context should include apps/web/src/App.tsx'
      );
      
    } finally {
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should find apps/web/src/main.tsx when no ripgrep matches', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-context-test-'));
    
    try {
      // Create apps/web structure
      const appsWebSrcDir = path.join(tempDir, 'apps', 'web', 'src');
      fs.mkdirSync(appsWebSrcDir, { recursive: true });
      
      // Create main.tsx
      const mainTsxPath = path.join(appsWebSrcDir, 'main.tsx');
      fs.writeFileSync(mainTsxPath, 'import React from "react"; ReactDOM.render();');
      
      // Build context with unrelated keywords
      const prompt = 'Fix the bug';
      const result = await buildContext(tempDir, prompt);
      
      // Should have found apps/web/src/main.tsx as fallback
      assert.ok(result.files.size > 0, 'Context should not be empty');
      assert.ok(
        result.files.has('apps/web/src/main.tsx'), 
        'Context should include apps/web/src/main.tsx'
      );
      
    } finally {
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should find apps/web/index.html when no ripgrep matches', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-context-test-'));
    
    try {
      // Create apps/web structure
      const appsWebDir = path.join(tempDir, 'apps', 'web');
      fs.mkdirSync(appsWebDir, { recursive: true });
      
      // Create index.html
      const indexHtmlPath = path.join(appsWebDir, 'index.html');
      fs.writeFileSync(indexHtmlPath, '<!DOCTYPE html><html><body></body></html>');
      
      // Build context with unrelated keywords
      const prompt = 'Update the styles';
      const result = await buildContext(tempDir, prompt);
      
      // Should have found apps/web/index.html as fallback
      assert.ok(result.files.size > 0, 'Context should not be empty');
      assert.ok(
        result.files.has('apps/web/index.html'), 
        'Context should include apps/web/index.html'
      );
      
    } finally {
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should find apps/web/vite.config.ts when no ripgrep matches', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-context-test-'));
    
    try {
      // Create apps/web structure
      const appsWebDir = path.join(tempDir, 'apps', 'web');
      fs.mkdirSync(appsWebDir, { recursive: true });
      
      // Create vite.config.ts
      const viteConfigPath = path.join(appsWebDir, 'vite.config.ts');
      fs.writeFileSync(viteConfigPath, 'export default defineConfig({ plugins: [] });');
      
      // Build context with unrelated keywords
      const prompt = 'Fix the build';
      const result = await buildContext(tempDir, prompt);
      
      // Should have found apps/web/vite.config.ts as fallback
      assert.ok(result.files.size > 0, 'Context should not be empty');
      assert.ok(
        result.files.has('apps/web/vite.config.ts'), 
        'Context should include apps/web/vite.config.ts'
      );
      
    } finally {
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should include all matching entry points in apps/web', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-context-test-'));
    
    try {
      // Create apps/web structure with multiple files
      const appsWebSrcDir = path.join(tempDir, 'apps', 'web', 'src');
      fs.mkdirSync(appsWebSrcDir, { recursive: true });
      
      // Create multiple files
      fs.writeFileSync(path.join(appsWebSrcDir, 'App.tsx'), 'App content');
      fs.writeFileSync(path.join(appsWebSrcDir, 'main.tsx'), 'Main content');
      
      // Build context
      const prompt = 'Update something';
      const result = await buildContext(tempDir, prompt);
      
      // Should find all matching entry points
      assert.ok(result.files.size >= 2, 'Should find all matching entry points');
      assert.ok(
        result.files.has('apps/web/src/App.tsx'), 
        'Should include App.tsx'
      );
      assert.ok(
        result.files.has('apps/web/src/main.tsx'), 
        'Should include main.tsx'
      );
      
    } finally {
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should handle monorepo with both root and apps/web structure', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-context-test-'));
    
    try {
      // Create root structure
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name": "root"}');
      
      // Create apps/web structure
      const appsWebDir = path.join(tempDir, 'apps', 'web');
      fs.mkdirSync(appsWebDir, { recursive: true });
      fs.writeFileSync(path.join(appsWebDir, 'package.json'), '{"name": "web"}');
      
      // Build context
      const prompt = 'Update the configuration';
      const result = await buildContext(tempDir, prompt);
      
      // Should find a file (root index.js would come first if it existed, 
      // otherwise apps/web/src/App.tsx, etc.)
      assert.ok(result.files.size > 0, 'Context should not be empty');
      
    } finally {
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
