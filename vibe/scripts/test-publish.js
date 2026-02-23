#!/usr/bin/env node

/**
 * Manual test script for the Publish API endpoint
 * Usage: node scripts/test-publish.js
 */

const fs = require('fs');
const path = require('path');

const API_BASE_URL = process.env.API_URL || 'http://localhost:3001';
const PREVIEWS_DIR = process.env.PREVIEWS_DIR || '/data/previews';
const PUBLISHED_DIR = process.env.PUBLISHED_DIR || '/data/published';

async function post(endpoint, body) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`POST ${endpoint} failed: ${response.status} - ${text}`);
  }
  
  return await response.json();
}

async function get(endpoint) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GET ${endpoint} failed: ${response.status} - ${text}`);
  }
  
  return await response.json();
}

async function testPublishAPI() {
  console.log('🧪 Testing Publish API...\n');
  
  try {
    // 1. Create a test project
    console.log('1️⃣  Creating test project...');
    const project = await post('/projects', {
      name: `test-publish-${Date.now()}`,
      template: 'empty'
    });
    console.log(`✓ Project created: ${project.id}`);
    
    // 2. Create a test job
    console.log('\n2️⃣  Creating test job...');
    const job = await post('/jobs', {
      prompt: 'Test prompt',
      project_id: project.id
    });
    console.log(`✓ Job created: ${job.task_id}`);
    
    // 3. Simulate preview generation (normally done by executor)
    console.log('\n3️⃣  Creating mock preview files...');
    const previewDir = path.join(PREVIEWS_DIR, job.task_id);
    if (!fs.existsSync(previewDir)) {
      fs.mkdirSync(previewDir, { recursive: true });
    }
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Preview</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; background: #f0f0f0; }
    h1 { color: #333; }
  </style>
</head>
<body>
  <h1>Test Preview Page</h1>
  <p>Job ID: ${job.task_id}</p>
  <p>Timestamp: ${new Date().toISOString()}</p>
</body>
</html>`;
    
    fs.writeFileSync(path.join(previewDir, 'index.html'), htmlContent);
    console.log(`✓ Mock preview created at: ${previewDir}`);
    
    // 4. Update job to mark it as completed with preview (simulate executor)
    console.log('\n4️⃣  Marking job as completed with preview...');
    const Database = require('better-sqlite3');
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data/vibe.db');
    const db = new Database(dbPath);
    
    const previewUrl = `/previews/${job.task_id}/index.html`;
    db.prepare(`UPDATE vibe_tasks SET preview_url = ?, execution_state = ?, last_modified = ? WHERE task_id = ?`)
      .run(previewUrl, 'completed', Date.now(), job.task_id);
    db.close();
    console.log(`✓ Job marked as completed with preview URL`);
    
    // 5. Test the publish endpoint
    console.log('\n5️⃣  Publishing preview to project...');
    const publishResult = await post(`/projects/${project.id}/publish`, {
      job_id: job.task_id
    });
    console.log(`✓ Publish successful!`);
    console.log(`   Published URL: ${publishResult.published_url}`);
    
    // 6. Verify published files exist
    console.log('\n6️⃣  Verifying published files...');
    const publishedDir = path.join(PUBLISHED_DIR, project.id);
    const publishedIndexPath = path.join(publishedDir, 'index.html');
    
    if (!fs.existsSync(publishedIndexPath)) {
      throw new Error('Published index.html does not exist!');
    }
    console.log(`✓ Published files exist at: ${publishedDir}`);
    
    // 7. Verify project was updated
    console.log('\n7️⃣  Verifying project metadata...');
    const updatedProject = await get(`/projects/${project.id}`);
    
    if (updatedProject.published_url !== publishResult.published_url) {
      throw new Error('Project published_url does not match!');
    }
    if (updatedProject.published_job_id !== job.task_id) {
      throw new Error('Project published_job_id does not match!');
    }
    if (!updatedProject.published_at) {
      throw new Error('Project published_at is missing!');
    }
    console.log(`✓ Project metadata updated correctly`);
    console.log(`   Published URL: ${updatedProject.published_url}`);
    console.log(`   Published Job: ${updatedProject.published_job_id}`);
    console.log(`   Published At: ${new Date(updatedProject.published_at).toISOString()}`);
    
    // 8. Test accessing the published URL
    console.log('\n8️⃣  Testing published URL access...');
    const publishedContent = await fetch(`${API_BASE_URL}${publishResult.published_url}`);
    if (!publishedContent.ok) {
      throw new Error(`Failed to access published URL: ${publishedContent.status}`);
    }
    const html = await publishedContent.text();
    if (!html.includes('Test Preview Page')) {
      throw new Error('Published content does not match expected content!');
    }
    console.log(`✓ Published URL is accessible and serves correct content`);
    
    // 9. Cleanup
    console.log('\n9️⃣  Cleaning up...');
    fs.rmSync(previewDir, { recursive: true, force: true });
    fs.rmSync(publishedDir, { recursive: true, force: true });
    console.log(`✓ Cleanup complete`);
    
    console.log('\n✅ All tests passed!');
    console.log('\n📋 Summary:');
    console.log(`   - Project ID: ${project.id}`);
    console.log(`   - Job ID: ${job.task_id}`);
    console.log(`   - Preview URL: ${storage.getTask(job.task_id).preview_url}`);
    console.log(`   - Published URL: ${publishResult.published_url}`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testPublishAPI().catch(console.error);
}

module.exports = { testPublishAPI };
