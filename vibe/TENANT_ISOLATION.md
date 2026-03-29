# Tenant Isolation Feature

This document describes the multi-tenant isolation feature implemented in VIBE.

## Overview

VIBE now supports multi-tenant isolation at the database, API, and filesystem levels. Each tenant's data (projects, jobs, and repository files) is completely isolated from other tenants.

## Requirements

All API endpoints that access projects or jobs require the `X-Tenant-Id` header:

```bash
X-Tenant-Id: <tenant-identifier>
```

## Database Schema

### Added Columns

Two new columns have been added to support tenant isolation:

1. **vibe_projects.tenant_id** (TEXT)
   - Stores the tenant identifier for each project
   - Indexed for efficient querying

2. **vibe_tasks.tenant_id** (TEXT)
   - Stores the tenant identifier for each job/task
   - Indexed for efficient querying

### Indexes

- `idx_projects_by_tenant` - Index on `vibe_projects(tenant_id)`
- `idx_tasks_by_tenant` - Index on `vibe_tasks(tenant_id)`

## API Changes

### Middleware

A new middleware function `requireTenantHeader()` has been added to validate the presence of the `X-Tenant-Id` header on all protected endpoints.

### Affected Endpoints

All project and job-related endpoints now require the tenant header:

#### Projects
- `POST /projects` - Create project (scoped to tenant)
- `POST /projects/import/github` - Import GitHub repo (scoped to tenant)
- `GET /projects` - List projects (filtered by tenant)
- `GET /projects/:id` - Get project (validates tenant ownership)
- `DELETE /projects/:id` - Delete project (validates tenant ownership)
- `GET /projects/:id/jobs` - List project jobs (validates tenant ownership)
- `POST /projects/:id/publish` - Publish project (validates tenant ownership)

#### Jobs
- `POST /jobs` - Create job (scoped to tenant, validates project ownership)
- `GET /jobs` - List jobs (filtered by tenant)
- `GET /jobs/:id` - Get job (validates tenant ownership)
- `GET /jobs/:id/diff` - Get diff (validates tenant ownership)
- `POST /jobs/:id/diff/apply` - Apply diff (validates tenant ownership)
- `POST /jobs/:id/preview` - Set preview URL (validates tenant ownership)

#### Analytics
- `GET /analytics/overview` - Get analytics (filtered by tenant)

### Error Responses

#### Missing Tenant Header (400)
```json
{
  "error": "Missing required header: X-Tenant-Id"
}
```

#### Unauthorized Access (403)
```json
{
  "error": "Access denied: project belongs to different tenant"
}
```
or
```json
{
  "error": "Access denied: job belongs to different tenant"
}
```

## Filesystem Structure

Projects are now stored in tenant-specific directories:

```
/data/repos/
├── {tenant_id}/
│   ├── {project_id_1}/
│   │   └── (git repository files)
│   └── {project_id_2}/
│       └── (git repository files)
└── {another_tenant_id}/
    └── {project_id_3}/
        └── (git repository files)
```

### Example

```
/data/repos/
├── acme-corp/
│   ├── 7bfee80b-bd1e-4e42-b8fc-fe0a82c36c97/
│   │   └── README.md
│   └── 9a1c3f5e-2b4d-6e8f-0a1b-3c5d7e9f1a2b/
│       └── package.json
└── beta-inc/
    └── 0cc46a0f-237c-4040-842c-fb4b6a539a94/
        └── README.md
```

## Usage Examples

### Creating a Project

```bash
curl -X POST http://localhost:3001/projects \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: acme-corp" \
  -d '{
    "name": "my-project",
    "template": "empty"
  }'
```

Response:
```json
{
  "id": "7bfee80b-bd1e-4e42-b8fc-fe0a82c36c97",
  "name": "my-project",
  "repository_url": null,
  "local_path": "/data/repos/acme-corp/7bfee80b-bd1e-4e42-b8fc-fe0a82c36c97",
  "message": "Project created successfully"
}
```

### Listing Projects

```bash
curl -X GET http://localhost:3001/projects \
  -H "X-Tenant-Id: acme-corp"
```

Response:
```json
[
  {
    "id": "7bfee80b-bd1e-4e42-b8fc-fe0a82c36c97",
    "name": "my-project",
    "repository_url": null,
    "local_path": "/data/repos/acme-corp/7bfee80b-bd1e-4e42-b8fc-fe0a82c36c97",
    "tenant_id": "acme-corp",
    ...
  }
]
```

### Creating a Job

```bash
curl -X POST http://localhost:3001/jobs \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: acme-corp" \
  -d '{
    "prompt": "Add a new feature",
    "project_id": "7bfee80b-bd1e-4e42-b8fc-fe0a82c36c97"
  }'
```

Response:
```json
{
  "task_id": "a77d1d54-cdda-4765-8dbc-0354d88a6ac2",
  "status": "queued",
  "message": "Task created successfully"
}
```

### Cross-Tenant Access (Denied)

```bash
# Attempt to access tenant A's project with tenant B's credentials
curl -X GET http://localhost:3001/projects/7bfee80b-bd1e-4e42-b8fc-fe0a82c36c97 \
  -H "X-Tenant-Id: beta-inc"
```

Response (403):
```json
{
  "error": "Access denied: project belongs to different tenant"
}
```

## Migration Notes

### Existing Data

- Existing projects and jobs will have `tenant_id = NULL`
- These will not be accessible through the tenant-scoped API endpoints
- Manual migration may be required to assign tenant IDs to existing data

### Database Migration

The migration is automatic and will:
1. Add `tenant_id` columns to `vibe_projects` and `vibe_tasks` tables
2. Create indexes on the new columns
3. Preserve all existing data

## Security Considerations

1. **Tenant ID Validation**: Always validate the tenant ID from headers, never from request body
2. **Authorization**: Each endpoint validates that the requested resource belongs to the authenticated tenant
3. **Filesystem Isolation**: Projects are stored in tenant-specific directories preventing accidental cross-tenant file access
4. **Database Indexes**: Efficient querying with indexed tenant_id columns

## Implementation Details

### Storage Layer

The storage layer (`apps/api/src/storage.ts`) has been updated to:
- Accept `tenant_id` parameters in create methods
- Filter queries by `tenant_id` in list methods
- Return tenant_id in all project and task objects

### Middleware

The middleware (`apps/api/src/auth.ts`) includes:
- `requireTenantHeader()`: Validates X-Tenant-Id header presence and extracts tenant ID
- Extended `AuthRequest` interface to include `tenantId` property

### Executor Compatibility

The executor continues to work with tenant-isolated data because:
- It reads the `local_path` from the project record, which is already tenant-scoped
- It processes jobs from all tenants (no tenant filtering in `getNextQueuedTask()`)
- Jobs are associated with projects via `project_id`, maintaining tenant boundaries

## Testing

A comprehensive test suite validates:
- ✅ Endpoints reject requests without tenant header (400)
- ✅ Projects are created with tenant-scoped paths
- ✅ Tenants can only list their own projects
- ✅ Cross-tenant project access is denied (403)
- ✅ Jobs are created with tenant association
- ✅ Cross-tenant job access is denied (403)
- ✅ Filesystem structure correctly isolates tenant data
- ✅ Database correctly stores and indexes tenant_id

See the test script at `/tmp/test-tenant-isolation.sh` for details.
