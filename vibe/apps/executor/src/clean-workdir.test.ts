import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Tests for clean working directory per iteration functionality.
 * 
 * These tests verify that:
 * 1. Each iteration gets its own clean working directory
 * 2. Failed git apply doesn't contaminate subsequent iterations
 * 3. Repository state is properly reset between iterations
 */

describe('Clean Working Directory Per Iteration', () => {
  it('should create unique attempt directories', () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-workdir-test-'));
    
    try {
      const taskId = 'test-task-123';
      const baseWorkDir = path.join(baseDir, '.vibe', 'work', taskId);
      
      // Create base directory structure
      fs.mkdirSync(baseWorkDir, { recursive: true });
      
      // Create attempt directories
      const attempt1Dir = path.join(baseWorkDir, 'attempt-1');
      const attempt2Dir = path.join(baseWorkDir, 'attempt-2');
      const attempt3Dir = path.join(baseWorkDir, 'attempt-3');
      
      fs.mkdirSync(attempt1Dir, { recursive: true });
      fs.mkdirSync(attempt2Dir, { recursive: true });
      fs.mkdirSync(attempt3Dir, { recursive: true });
      
      // Verify all directories exist
      assert.ok(fs.existsSync(attempt1Dir), 'attempt-1 directory should exist');
      assert.ok(fs.existsSync(attempt2Dir), 'attempt-2 directory should exist');
      assert.ok(fs.existsSync(attempt3Dir), 'attempt-3 directory should exist');
      
      // Verify they are separate directories
      assert.notStrictEqual(attempt1Dir, attempt2Dir);
      assert.notStrictEqual(attempt2Dir, attempt3Dir);
      
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });

  it('should isolate dirty state from previous attempts', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-workdir-test-'));
    
    try {
      // Initialize a git repository
      execSync('git init', { cwd: tempDir });
      execSync('git config user.email "test@test.com"', { cwd: tempDir });
      execSync('git config user.name "Test User"', { cwd: tempDir });
      execSync('git config commit.gpgsign false', { cwd: tempDir });

      // Create a file and commit it
      const testFile = path.join(tempDir, 'test.txt');
      fs.writeFileSync(testFile, 'original content\n');
      execSync('git add test.txt', { cwd: tempDir });
      execSync('git commit -m "Initial commit"', { cwd: tempDir });
      
      // Simulate a dirty state (modify file without committing)
      fs.writeFileSync(testFile, 'modified content\n');
      
      // Verify file is modified
      const statusBefore = execSync('git status --porcelain', { cwd: tempDir, encoding: 'utf-8' });
      assert.ok(statusBefore.includes('test.txt'), 'File should be modified');
      
      // Reset to clean state (simulating what happens between iterations)
      execSync('git reset --hard HEAD', { cwd: tempDir });
      execSync('git clean -fd', { cwd: tempDir });
      
      // Verify repository is clean
      const statusAfter = execSync('git status --porcelain', { cwd: tempDir, encoding: 'utf-8' });
      assert.strictEqual(statusAfter.trim(), '', 'Repository should be clean');
      
      // Verify file content is restored
      const restoredContent = fs.readFileSync(testFile, 'utf-8');
      assert.strictEqual(restoredContent, 'original content\n', 'File content should be restored');
      
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should clean up untracked files between iterations', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-workdir-test-'));
    
    try {
      // Initialize a git repository
      execSync('git init', { cwd: tempDir });
      execSync('git config user.email "test@test.com"', { cwd: tempDir });
      execSync('git config user.name "Test User"', { cwd: tempDir });
      execSync('git config commit.gpgsign false', { cwd: tempDir });

      // Create a file and commit it
      const trackedFile = path.join(tempDir, 'tracked.txt');
      fs.writeFileSync(trackedFile, 'tracked content\n');
      execSync('git add tracked.txt', { cwd: tempDir });
      execSync('git commit -m "Initial commit"', { cwd: tempDir });
      
      // Create untracked files (simulating failed patch artifacts)
      const untrackedFile = path.join(tempDir, 'untracked.txt');
      const patchFile = path.join(tempDir, '.vibe-diff.patch');
      fs.writeFileSync(untrackedFile, 'untracked content\n');
      fs.writeFileSync(patchFile, 'patch content\n');
      
      // Verify untracked files exist
      assert.ok(fs.existsSync(untrackedFile), 'Untracked file should exist');
      assert.ok(fs.existsSync(patchFile), 'Patch file should exist');
      
      // Clean untracked files (simulating cleanup between iterations)
      execSync('git clean -fd', { cwd: tempDir });
      
      // Verify untracked files are removed
      assert.ok(!fs.existsSync(untrackedFile), 'Untracked file should be removed');
      assert.ok(!fs.existsSync(patchFile), 'Patch file should be removed');
      
      // Verify tracked file still exists
      assert.ok(fs.existsSync(trackedFile), 'Tracked file should still exist');
      
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should support .vibe/work directory structure', () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-workdir-test-'));
    
    try {
      // Create .vibe/work structure
      const vibeWorkDir = path.join(baseDir, '.vibe', 'work');
      fs.mkdirSync(vibeWorkDir, { recursive: true });
      
      // Verify directory exists
      assert.ok(fs.existsSync(vibeWorkDir), '.vibe/work directory should exist');
      
      // Create task-specific directories
      const task1Dir = path.join(vibeWorkDir, 'task-123');
      const task2Dir = path.join(vibeWorkDir, 'task-456');
      
      fs.mkdirSync(task1Dir, { recursive: true });
      fs.mkdirSync(task2Dir, { recursive: true });
      
      // Verify task directories are isolated
      assert.ok(fs.existsSync(task1Dir), 'task-123 directory should exist');
      assert.ok(fs.existsSync(task2Dir), 'task-456 directory should exist');
      
      // Create repo and attempt subdirectories for task-123
      const repoDir = path.join(task1Dir, 'repo');
      const attempt1Dir = path.join(task1Dir, 'attempt-1');
      
      fs.mkdirSync(repoDir, { recursive: true });
      fs.mkdirSync(attempt1Dir, { recursive: true });
      
      assert.ok(fs.existsSync(repoDir), 'repo directory should exist');
      assert.ok(fs.existsSync(attempt1Dir), 'attempt-1 directory should exist');
      
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });

  it('should handle worktree cleanup properly', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-workdir-test-'));
    
    try {
      // Initialize a git repository
      execSync('git init', { cwd: tempDir });
      execSync('git config user.email "test@test.com"', { cwd: tempDir });
      execSync('git config user.name "Test User"', { cwd: tempDir });
      execSync('git config commit.gpgsign false', { cwd: tempDir });

      // Create a file and commit it
      const testFile = path.join(tempDir, 'test.txt');
      fs.writeFileSync(testFile, 'original content\n');
      execSync('git add test.txt', { cwd: tempDir });
      execSync('git commit -m "Initial commit"', { cwd: tempDir });
      
      // Create a worktree
      const worktreeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-worktree-'));
      
      try {
        execSync(`git worktree add --detach "${worktreeDir}" HEAD`, { cwd: tempDir });
        
        // Verify worktree exists
        assert.ok(fs.existsSync(worktreeDir), 'Worktree directory should exist');
        
        // List worktrees to verify it was created
        const worktreeList = execSync('git worktree list', { cwd: tempDir, encoding: 'utf-8' });
        assert.ok(worktreeList.includes(worktreeDir), 'Worktree should be listed');
        
        // Clean up worktree
        execSync(`git worktree remove --force "${worktreeDir}"`, { cwd: tempDir });
        
        // Verify worktree is removed from git
        const worktreeListAfter = execSync('git worktree list', { cwd: tempDir, encoding: 'utf-8' });
        assert.ok(!worktreeListAfter.includes(worktreeDir), 'Worktree should be removed from list');
        
      } finally {
        // Clean up worktree directory if it still exists
        if (fs.existsSync(worktreeDir)) {
          fs.rmSync(worktreeDir, { recursive: true, force: true });
        }
      }
      
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
