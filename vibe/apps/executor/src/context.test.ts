import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  ProjectContext, 
  gatherProjectContext, 
  getContextFiles, 
  getFileContent, 
  hasFile 
} from './context';

describe('Context Gatherer', () => {
  describe('gatherProjectContext', () => {
    it('should convert Map to Record and create ProjectContext', () => {
      const files = new Map<string, string>();
      files.set('src/index.ts', 'console.log("hello");');
      files.set('src/utils.ts', 'export const add = (a, b) => a + b;');
      
      const context = gatherProjectContext(
        '/path/to/repo',
        'update index file',
        files,
        100,
        false
      );
      
      assert.strictEqual(context.repoPath, '/path/to/repo');
      assert.strictEqual(context.prompt, 'update index file');
      assert.strictEqual(context.totalSize, 100);
      assert.strictEqual(context.truncated, false);
      assert.strictEqual(Object.keys(context.files).length, 2);
      assert.strictEqual(context.files['src/index.ts'], 'console.log("hello");');
      assert.strictEqual(context.files['src/utils.ts'], 'export const add = (a, b) => a + b;');
    });

    it('should handle empty files map', () => {
      const files = new Map<string, string>();
      
      const context = gatherProjectContext(
        '/path/to/repo',
        'test prompt',
        files,
        0,
        false
      );
      
      assert.strictEqual(Object.keys(context.files).length, 0);
      assert.strictEqual(context.totalSize, 0);
    });

    it('should preserve truncation flag', () => {
      const files = new Map<string, string>();
      files.set('large-file.txt', 'x'.repeat(100000));
      
      const context = gatherProjectContext(
        '/path/to/repo',
        'test prompt',
        files,
        100000,
        true
      );
      
      assert.strictEqual(context.truncated, true);
    });
  });

  describe('getContextFiles', () => {
    it('should return sorted list of file paths', () => {
      const context: ProjectContext = {
        files: {
          'src/z.ts': 'content',
          'src/a.ts': 'content',
          'src/m.ts': 'content'
        },
        totalSize: 100,
        truncated: false,
        repoPath: '/repo',
        prompt: 'test'
      };
      
      const fileList = getContextFiles(context);
      
      assert.deepStrictEqual(fileList, ['src/a.ts', 'src/m.ts', 'src/z.ts']);
    });

    it('should return empty array for empty context', () => {
      const context: ProjectContext = {
        files: {},
        totalSize: 0,
        truncated: false,
        repoPath: '/repo',
        prompt: 'test'
      };
      
      const fileList = getContextFiles(context);
      
      assert.deepStrictEqual(fileList, []);
    });
  });

  describe('getFileContent', () => {
    it('should return file content for existing file', () => {
      const context: ProjectContext = {
        files: {
          'src/index.ts': 'console.log("hello");'
        },
        totalSize: 100,
        truncated: false,
        repoPath: '/repo',
        prompt: 'test'
      };
      
      const content = getFileContent(context, 'src/index.ts');
      
      assert.strictEqual(content, 'console.log("hello");');
    });

    it('should return undefined for non-existing file', () => {
      const context: ProjectContext = {
        files: {
          'src/index.ts': 'console.log("hello");'
        },
        totalSize: 100,
        truncated: false,
        repoPath: '/repo',
        prompt: 'test'
      };
      
      const content = getFileContent(context, 'src/missing.ts');
      
      assert.strictEqual(content, undefined);
    });
  });

  describe('hasFile', () => {
    it('should return true for existing file', () => {
      const context: ProjectContext = {
        files: {
          'src/index.ts': 'console.log("hello");'
        },
        totalSize: 100,
        truncated: false,
        repoPath: '/repo',
        prompt: 'test'
      };
      
      assert.strictEqual(hasFile(context, 'src/index.ts'), true);
    });

    it('should return false for non-existing file', () => {
      const context: ProjectContext = {
        files: {
          'src/index.ts': 'console.log("hello");'
        },
        totalSize: 100,
        truncated: false,
        repoPath: '/repo',
        prompt: 'test'
      };
      
      assert.strictEqual(hasFile(context, 'src/missing.ts'), false);
    });
  });
});
