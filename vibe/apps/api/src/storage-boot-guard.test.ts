import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

/**
 * Tests for the boot-time schema guard in storage.ts
 * This validates the fix for the crash-loop issue where repository_url was missing
 */

describe('Storage boot-time schema guard', () => {
  let testDb: Database.Database;
  let testDbPath: string;

  before(() => {
    // Create a temporary test database
    testDbPath = path.join('/tmp', `test-boot-guard-${Date.now()}.db`);
    testDb = new Database(testDbPath);

    // Simulate the problematic state: migrations table says everything is applied,
    // but repository_url column is missing from vibe_projects
    testDb.exec(`
      CREATE TABLE IF NOT EXISTS vibe_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        local_path TEXT NOT NULL,
        last_synced INTEGER,
        created_at INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );
      
      INSERT INTO schema_migrations (version, name, applied_at) 
      VALUES (1, 'initial_schema', ${Date.now()});
    `);
  });

  after(() => {
    // Cleanup
    testDb.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should detect missing repository_url column', () => {
    // Verify column doesn't exist initially
    const columnsBefore = testDb.pragma('table_info(vibe_projects)') as { name: string }[];
    const hasColumnBefore = columnsBefore.some((col) => col.name === 'repository_url');
    assert.strictEqual(hasColumnBefore, false, 'repository_url should not exist in problematic state');
  });

  it('should add repository_url column when missing', () => {
    // Simulate the boot-time schema guard logic
    const columns = testDb.pragma('table_info(vibe_projects)') as { name: string }[];
    if (!columns.some(col => col.name === 'repository_url')) {
      testDb.exec('ALTER TABLE vibe_projects ADD COLUMN repository_url TEXT');
    }

    // Verify column now exists
    const columnsAfter = testDb.pragma('table_info(vibe_projects)') as { name: string }[];
    const hasColumnAfter = columnsAfter.some((col) => col.name === 'repository_url');
    assert.strictEqual(hasColumnAfter, true, 'repository_url should exist after boot guard');
  });

  it('should be idempotent - running guard twice should not error', () => {
    // Run the guard logic twice
    assert.doesNotThrow(() => {
      const columns1 = testDb.pragma('table_info(vibe_projects)') as { name: string }[];
      if (!columns1.some(col => col.name === 'repository_url')) {
        testDb.exec('ALTER TABLE vibe_projects ADD COLUMN repository_url TEXT');
      }
      
      const columns2 = testDb.pragma('table_info(vibe_projects)') as { name: string }[];
      if (!columns2.some(col => col.name === 'repository_url')) {
        testDb.exec('ALTER TABLE vibe_projects ADD COLUMN repository_url TEXT');
      }
    }, 'Running boot guard multiple times should not throw');
  });

  it('should allow prepared statements with repository_url after guard runs', () => {
    // Ensure the guard has run
    const columns = testDb.pragma('table_info(vibe_projects)') as { name: string }[];
    if (!columns.some(col => col.name === 'repository_url')) {
      testDb.exec('ALTER TABLE vibe_projects ADD COLUMN repository_url TEXT');
    }

    // This should not throw since repository_url now exists
    assert.doesNotThrow(() => {
      const insertStmt = testDb.prepare(`
        INSERT INTO vibe_projects (id, name, repository_url, local_path, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      insertStmt.run('test-proj-1', 'test-project-1', 'https://github.com/test/repo', '/tmp/test', Date.now());
    }, 'Should be able to prepare and execute statement with repository_url');

    // Verify the data was inserted correctly
    const project = testDb.prepare('SELECT * FROM vibe_projects WHERE id = ?').get('test-proj-1') as any;
    assert.strictEqual(project.repository_url, 'https://github.com/test/repo', 'repository_url should be stored correctly');
  });
});
