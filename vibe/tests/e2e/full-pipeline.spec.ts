/**
 * E2E Test: Full VIBE Pipeline
 * 
 * Tests the complete flow from prompt to PR creation in under 3 minutes:
 * 1. Creates a project via POST /projects
 * 2. Submits a job/task via POST /jobs
 * 3. Monitors execution via Server-Sent Events (SSE) at /jobs/:id/logs
 * 4. Validates successful PR creation and absence of errors
 * 
 * This test scaffold validates the core VIBE workflow and ensures:
 * - The pipeline completes successfully
 * - A PR is opened to GitHub
 * - No runtime errors occur (e.g., null pointer exceptions)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { TestApiClient, collectSSE } from './test-utils';

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const TEST_TIMEOUT = 200000; // 200 seconds total test timeout

describe('E2E: Full Pipeline', () => {
  let api: TestApiClient;

  before(() => {
    // Initialize API client
    api = new TestApiClient({ baseUrl: API_BASE_URL, timeout: 30000 });
    console.log(`Testing against API at: ${API_BASE_URL}`);
  });

  it('prompt → PR in under 3 minutes', { timeout: TEST_TIMEOUT }, async () => {
    // Step 1: Create a project
    console.log('Creating test project...');
    const project = await api.post('/projects', {
      name: `e2e-test-${Date.now()}`,
      template: 'empty'
    });

    assert.ok(project.id, 'Project should have an id');
    assert.ok(project.name, 'Project should have a name');
    console.log(`Project created: ${project.id}`);

    // Step 2: Create a job
    console.log('Creating job...');
    const job = await api.post('/jobs', {
      project_id: project.id,
      prompt: 'add a utils.ts with a sum function'
    });

    assert.ok(job.task_id, 'Job should have a task_id');
    assert.strictEqual(job.status, 'queued', 'Job should be queued');
    console.log(`Job created: ${job.task_id}`);

    // Step 3: Collect SSE logs
    console.log('Collecting logs via SSE...');
    const logs: string[] = [];

    try {
      await collectSSE(
        API_BASE_URL,
        `/jobs/${job.task_id}/logs`,
        logs,
        {
          timeout: 180000, // 3 minutes
          until: (log) => {
            // Stop collecting when we see terminal conditions
            // Use specific terminal messages to avoid premature stopping
            return log.includes('PR opened') || 
                   log.includes('Pipeline failed') ||
                   log.includes('Task failed') ||
                   log.toLowerCase().includes('fatal error');
          }
        }
      );
    } catch (error: any) {
      console.error('Error collecting logs:', error.message);
      console.log('Logs collected so far:');
      logs.forEach((log, i) => console.log(`  ${i + 1}. ${log}`));
      throw error;
    }

    // Step 4: Verify results
    console.log(`\nCollected ${logs.length} log entries`);
    
    const allLogs = logs.join('\n');
    console.log('\n--- Full Log Output ---');
    console.log(allLogs);
    console.log('--- End Log Output ---\n');

    // Assert PR was opened
    assert.ok(
      allLogs.includes('PR opened'),
      'Expected logs to contain "PR opened" message'
    );

    // Assert no null pointer errors
    assert.ok(
      !allLogs.includes('Cannot read properties of null'),
      'Logs should not contain null pointer errors'
    );

    // Additional assertions for pipeline stages
    assert.ok(
      allLogs.includes('Task created') || allLogs.includes('Task created and queued'),
      'Expected logs to show task creation'
    );

    console.log('✅ E2E test passed: PR opened successfully without errors');
  });

  // Optional: Add cleanup after test
  after(async () => {
    console.log('E2E test cleanup complete');
  });
});
