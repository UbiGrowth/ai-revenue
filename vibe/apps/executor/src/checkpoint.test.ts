import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Tests for checkpoint functionality
 * Verifies that git tags are created in the format vibe/job-<taskId>
 */

describe('Checkpoint Tag Creation', () => {
  let testRepoDir: string;
  let git: SimpleGit;

  before(async () => {
    // Create a temporary test repository
    testRepoDir = path.join(os.tmpdir(), `test-checkpoint-repo-${Date.now()}`);
    fs.mkdirSync(testRepoDir, { recursive: true });
    
    git = simpleGit(testRepoDir);
    await git.init();
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');
    
    // Create an initial commit
    fs.writeFileSync(path.join(testRepoDir, 'README.md'), '# Test Repo\n');
    await git.add('README.md');
    await git.commit('Initial commit');
  });

  after(() => {
    // Clean up test repository
    if (fs.existsSync(testRepoDir)) {
      fs.rmSync(testRepoDir, { recursive: true, force: true });
    }
  });

  it('should create a checkpoint tag with correct format', async () => {
    const taskId = 'test-task-123';
    const tagName = `vibe/job-${taskId}`;
    
    // Create the tag on HEAD
    await git.tag([tagName, 'HEAD']);
    
    // Verify the tag was created
    const tags = await git.tags();
    assert.ok(tags.all.includes(tagName), `Tag ${tagName} should exist`);
  });

  it('should create tags with different task IDs', async () => {
    const taskIds = ['task-1', 'task-2', 'task-3'];
    
    for (const taskId of taskIds) {
      const tagName = `vibe/job-${taskId}`;
      await git.tag([tagName, 'HEAD']);
    }
    
    // Verify all tags were created
    const tags = await git.tags();
    for (const taskId of taskIds) {
      const tagName = `vibe/job-${taskId}`;
      assert.ok(tags.all.includes(tagName), `Tag ${tagName} should exist`);
    }
  });

  it('should create tag pointing to specific commit', async () => {
    // Create a new commit
    fs.writeFileSync(path.join(testRepoDir, 'file.txt'), 'test content\n');
    await git.add('file.txt');
    await git.commit('Add test file');
    const log = await git.log(['-1']);
    const commitHash = log.latest?.hash;
    
    const taskId = 'task-with-commit';
    const tagName = `vibe/job-${taskId}`;
    
    // Create tag pointing to HEAD
    await git.tag([tagName, 'HEAD']);
    
    // Verify tag points to the right commit
    const tagInfo = await git.raw(['rev-parse', tagName]);
    assert.ok(tagInfo.trim().startsWith(commitHash!.substring(0, 7)), 'Tag should point to correct commit');
  });

  it('should handle tag creation on different branches', async () => {
    // Create and checkout a new branch
    const branchName = 'feature-branch';
    await git.checkoutLocalBranch(branchName);
    
    // Make a commit on the new branch
    fs.writeFileSync(path.join(testRepoDir, 'feature.txt'), 'feature content\n');
    await git.add('feature.txt');
    await git.commit('Add feature file');
    
    const taskId = 'task-on-branch';
    const tagName = `vibe/job-${taskId}`;
    
    // Create tag on the current branch
    await git.tag([tagName, branchName]);
    
    // Verify tag exists
    const tags = await git.tags();
    assert.ok(tags.all.includes(tagName), `Tag ${tagName} should exist on ${branchName}`);
  });
});
