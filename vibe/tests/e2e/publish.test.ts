/**
 * E2E Test for Publish Endpoint
 * Tests the POST /projects/:id/publish endpoint
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { TestApiClient } from './test-utils';
import fs from 'fs';
import path from 'path';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3001';
const PREVIEWS_DIR = '/data/previews';
const PUBLISHED_DIR = '/data/published';

describe('Publish API', () => {
  const client = new TestApiClient({ baseUrl: API_BASE_URL });
  let testProjectId: string;
  let testJobId: string;

  before(async () => {
    // Create a test project
    const projectResponse = await client.post('/projects', {
      name: `test-publish-${Date.now()}`,
      template: 'empty'
    });
    testProjectId = projectResponse.id;

    // Create a test job for the project
    const jobResponse = await client.post('/jobs', {
      prompt: 'Test prompt for publish',
      project_id: testProjectId
    });
    testJobId = jobResponse.task_id;

    // Create mock preview files
    const previewDir = path.join(PREVIEWS_DIR, testJobId);
    if (!fs.existsSync(previewDir)) {
      fs.mkdirSync(previewDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(previewDir, 'index.html'),
      '<html><body><h1>Test Preview</h1></body></html>'
    );

    // Update job with preview URL (simulate completed job)
    // This would normally be done by the executor
    const storage = require('../../apps/api/src/storage').storage;
    storage.setPreviewUrl(testJobId, `/previews/${testJobId}/index.html`);
    storage.updateTaskState(testJobId, 'completed');
  });

  after(async () => {
    // Cleanup
    try {
      if (testProjectId) {
        await client.delete(`/projects/${testProjectId}`);
      }
      
      // Clean up test preview directory
      const previewDir = path.join(PREVIEWS_DIR, testJobId);
      if (fs.existsSync(previewDir)) {
        fs.rmSync(previewDir, { recursive: true, force: true });
      }

      // Clean up test published directory
      const publishedDir = path.join(PUBLISHED_DIR, testProjectId);
      if (fs.existsSync(publishedDir)) {
        fs.rmSync(publishedDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  it('should return 400 if job_id is missing', async () => {
    try {
      await client.post(`/projects/${testProjectId}/publish`, {});
      assert.fail('Expected request to fail with 400');
    } catch (error: any) {
      assert.ok(error.message.includes('400'), `Expected 400 error, got: ${error.message}`);
    }
  });

  it('should return 404 if project does not exist', async () => {
    const fakeProjectId = 'fake-project-id-123';
    try {
      await client.post(`/projects/${fakeProjectId}/publish`, { job_id: testJobId });
      assert.fail('Expected request to fail with 404');
    } catch (error: any) {
      assert.ok(error.message.includes('404'), `Expected 404 error, got: ${error.message}`);
    }
  });

  it('should return 404 if job does not exist', async () => {
    const fakeJobId = 'fake-job-id-123';
    try {
      await client.post(`/projects/${testProjectId}/publish`, { job_id: fakeJobId });
      assert.fail('Expected request to fail with 404');
    } catch (error: any) {
      assert.ok(error.message.includes('404'), `Expected 404 error, got: ${error.message}`);
    }
  });

  it('should successfully publish a job preview', async () => {
    // Publish the preview
    const response = await client.post(`/projects/${testProjectId}/publish`, {
      job_id: testJobId
    });

    // Verify response
    assert.ok(response.message, 'Response should have a message');
    assert.equal(response.message, 'Project published successfully');
    assert.ok(response.published_url, 'Response should have published_url');
    assert.equal(response.published_url, `/published/${testProjectId}/index.html`);
    assert.equal(response.job_id, testJobId);

    // Verify files were copied
    const publishedIndexPath = path.join(PUBLISHED_DIR, testProjectId, 'index.html');
    assert.ok(fs.existsSync(publishedIndexPath), 'Published index.html should exist');

    const content = fs.readFileSync(publishedIndexPath, 'utf-8');
    assert.ok(content.includes('Test Preview'), 'Published content should match preview');

    // Verify database was updated
    const project = await client.get(`/projects/${testProjectId}`);
    assert.equal(project.published_url, `/published/${testProjectId}/index.html`);
    assert.equal(project.published_job_id, testJobId);
    assert.ok(project.published_at, 'Project should have published_at timestamp');
  });

  it('should overwrite existing published content', async () => {
    // First publish
    await client.post(`/projects/${testProjectId}/publish`, { job_id: testJobId });

    // Update preview content
    const previewDir = path.join(PREVIEWS_DIR, testJobId);
    fs.writeFileSync(
      path.join(previewDir, 'index.html'),
      '<html><body><h1>Updated Preview</h1></body></html>'
    );

    // Publish again
    const response = await client.post(`/projects/${testProjectId}/publish`, {
      job_id: testJobId
    });

    assert.equal(response.message, 'Project published successfully');

    // Verify updated content
    const publishedIndexPath = path.join(PUBLISHED_DIR, testProjectId, 'index.html');
    const content = fs.readFileSync(publishedIndexPath, 'utf-8');
    assert.ok(content.includes('Updated Preview'), 'Published content should be updated');
  });
});
