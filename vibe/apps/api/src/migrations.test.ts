import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { runMigrations } from './migrations';

/**
 * Tests for migration system, specifically verifying that
 * repository_url column is properly added to existing databases
 */

describe('Migrations - repository_url column', () => {
  let testDb: Database.Database;
  let testDbPath: string;

  before(() => {
    // Create a temporary test database
    testDbPath = path.join('/tmp', `test-migrations-${Date.now()}.db`);
    testDb = new Database(testDbPath);

    // Simulate an old database schema WITHOUT repository_url
    testDb.exec(`
      CREATE TABLE IF NOT EXISTS vibe_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        local_path TEXT NOT NULL,
        last_synced INTEGER,
        created_at INTEGER NOT NULL
      );
    `);
  });

  after(() => {
    // Cleanup
    testDb.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should add repository_url column to existing vibe_projects table', () => {
    // Verify column doesn't exist initially
    const columnsBefore = testDb.pragma('table_info(vibe_projects)') as { name: string }[];
    const hasColumnBefore = columnsBefore.some((col) => col.name === 'repository_url');
    assert.strictEqual(hasColumnBefore, false, 'repository_url should not exist before migration');

    // Run migrations
    runMigrations(testDb);

    // Verify column now exists
    const columnsAfter = testDb.pragma('table_info(vibe_projects)') as { name: string }[];
    const hasColumnAfter = columnsAfter.some((col) => col.name === 'repository_url');
    assert.strictEqual(hasColumnAfter, true, 'repository_url should exist after migration');
  });

  it('should be idempotent - running migrations twice should not error', () => {
    // Run migrations twice
    assert.doesNotThrow(() => {
      runMigrations(testDb);
      runMigrations(testDb);
    }, 'Running migrations multiple times should not throw');
  });

  it('should allow NULL values in repository_url column', () => {
    // Insert a project without repository_url
    const insertStmt = testDb.prepare(`
      INSERT INTO vibe_projects (id, name, local_path, created_at)
      VALUES (?, ?, ?, ?)
    `);
    
    assert.doesNotThrow(() => {
      insertStmt.run('test-id', 'test-project', '/tmp/test', Date.now());
    }, 'Should allow inserting project without repository_url');

    // Verify it was inserted
    const project = testDb.prepare('SELECT * FROM vibe_projects WHERE id = ?').get('test-id') as any;
    assert.strictEqual(project.repository_url, null, 'repository_url should be NULL when not provided');
  });
});
