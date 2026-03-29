import Database from 'better-sqlite3';

interface Migration {
  version: number;
  name: string;
  up: string;
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const columns = db.pragma(`table_info(${table})`) as { name: string }[];
  return columns.some((col) => col.name === column);
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: `
      CREATE TABLE IF NOT EXISTS vibe_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        repository_url TEXT,
        local_path TEXT NOT NULL,
        last_synced INTEGER,
        created_at INTEGER NOT NULL,
        tenant_id TEXT,
        published_url TEXT,
        published_at INTEGER,
        published_job_id TEXT
      );
      CREATE TABLE IF NOT EXISTS vibe_tasks (
        task_id TEXT PRIMARY KEY,
        user_prompt TEXT NOT NULL,
        project_id TEXT,
        repository_url TEXT,
        source_branch TEXT NOT NULL,
        destination_branch TEXT NOT NULL,
        execution_state TEXT NOT NULL,
        pull_request_link TEXT,
        iteration_count INTEGER DEFAULT 0,
        initiated_at INTEGER NOT NULL,
        last_modified INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES vibe_projects(id)
      );
      CREATE TABLE IF NOT EXISTS vibe_events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        event_message TEXT NOT NULL,
        severity TEXT NOT NULL,
        event_time INTEGER NOT NULL,
        FOREIGN KEY (task_id) REFERENCES vibe_tasks(task_id)
      );
      CREATE INDEX IF NOT EXISTS idx_events_by_task ON vibe_events(task_id, event_time);
      CREATE INDEX IF NOT EXISTS idx_tasks_by_project ON vibe_tasks(project_id);
    `,
  },
  {
    version: 2,
    name: 'add_users_and_auth',
    up: `
      CREATE TABLE IF NOT EXISTS vibe_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS vibe_auth_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES vibe_users(id)
      );
    `,
  },
  {
    version: 3,
    name: 'add_workspaces',
    up: `
      CREATE TABLE IF NOT EXISTS vibe_workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (owner_id) REFERENCES vibe_users(id)
      );
      CREATE TABLE IF NOT EXISTS vibe_workspace_members (
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        joined_at INTEGER NOT NULL,
        PRIMARY KEY (workspace_id, user_id),
        FOREIGN KEY (workspace_id) REFERENCES vibe_workspaces(id),
        FOREIGN KEY (user_id) REFERENCES vibe_users(id)
      );
    `,
  },
  {
    version: 4,
    name: 'add_supabase_connections',
    up: `
      CREATE TABLE IF NOT EXISTS vibe_supabase_connections (
        project_id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        anon_key TEXT NOT NULL,
        service_key_enc TEXT NOT NULL,
        connected_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES vibe_projects(id)
      );
    `,
  },
  {
    version: 5,
    name: 'add_billing',
    up: `
      CREATE TABLE IF NOT EXISTS vibe_tenant_budgets (
        tenant_id TEXT PRIMARY KEY,
        limit_usd REAL NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `,
  },
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(
      (r) => r.version
    )
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    console.log(`[Migrations] Applying v${migration.version}: ${migration.name}`);
    db.exec(migration.up);
    db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
      migration.version,
      migration.name,
      Date.now()
    );
  }

  // Column-level migrations (SQLite ALTER TABLE doesn't support IF NOT EXISTS)
  const alterations: [string, string, string][] = [
    ['vibe_projects', 'repository_url', 'TEXT'],
    ['vibe_tasks', 'repository_url', 'TEXT'],
    ['vibe_tasks', 'llm_provider', `TEXT DEFAULT 'openai'`],
    ['vibe_tasks', 'llm_model', 'TEXT'],
    ['vibe_tasks', 'user_id', 'TEXT'],
    ['vibe_tasks', 'last_diff', 'TEXT'],
    ['vibe_tasks', 'preview_url', 'TEXT'],
    ['vibe_projects', 'workspace_id', 'TEXT'],
    ['vibe_projects', 'published_url', 'TEXT'],
    ['vibe_projects', 'published_at', 'INTEGER'],
    ['vibe_projects', 'published_job_id', 'TEXT'],
    ['vibe_projects', 'tenant_id', 'TEXT'],
    ['vibe_tasks', 'tenant_id', 'TEXT'],
    ['vibe_tasks', 'llm_prompt_tokens', 'INTEGER'],
    ['vibe_tasks', 'llm_completion_tokens', 'INTEGER'],
    ['vibe_tasks', 'llm_total_tokens', 'INTEGER'],
    ['vibe_tasks', 'preflight_seconds', 'REAL'],
    ['vibe_tasks', 'total_job_seconds', 'REAL'],
    ['vibe_tasks', 'files_changed_count', 'INTEGER'],
  ];
  for (const [table, col, colDef] of alterations) {
    if (!columnExists(db, table, col)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${colDef}`);
      console.log(`[Migrations] Added ${col} to ${table}`);
    }
  }

  // Create indexes for tenant_id columns (idempotent via IF NOT EXISTS)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_by_tenant ON vibe_projects(tenant_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_by_tenant ON vibe_tasks(tenant_id)`);

  console.log('[Migrations] All migrations applied');
}
