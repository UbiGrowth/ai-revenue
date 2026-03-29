# Publish API (v1)

## Overview

The Publish API allows you to promote a job's preview to a stable, published URL for a project. This is separate from GitHub PR creation and provides a URL-based deployment workflow.

## How It Works

1. **Previews** are generated when a job completes successfully at `/data/previews/<job_id>/`
2. **Publishing** copies the preview to `/data/published/<project_id>/`, making it the "live" version
3. Published content is accessible at a stable URL: `/published/<project_id>/index.html`

## API Endpoint

### POST /projects/:id/publish

Publish a job's preview as the live version for a project.

#### Request

```json
{
  "job_id": "string"
}
```

#### Response (Success - 200)

```json
{
  "message": "Project published successfully",
  "published_url": "/published/<project_id>/index.html",
  "job_id": "<job_id>"
}
```

#### Error Responses

- **400 Bad Request**: Missing job_id, job doesn't belong to project, or job has no preview
- **404 Not Found**: Project not found, job not found, or preview files not found
- **500 Internal Server Error**: Failed to copy files or update database

#### Example Usage

```bash
# Create a project
curl -X POST http://localhost:3001/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "my-app", "template": "empty"}'

# Create and run a job (generates preview)
curl -X POST http://localhost:3001/jobs \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Build my app", "project_id": "<project_id>"}'

# Wait for job to complete...

# Publish the preview
curl -X POST http://localhost:3001/projects/<project_id>/publish \
  -H "Content-Type: application/json" \
  -d '{"job_id": "<job_id>"}'

# Access the published site
curl http://localhost:3001/published/<project_id>/index.html
```

## Directory Structure

```
/data/
├── previews/           # Temporary previews per job
│   └── <job_id>/
│       └── index.html
├── published/          # Published versions per project
│   └── <project_id>/
│       └── index.html
└── repos/              # Git repositories per project
    └── <project_id>/
```

## Key Features

- **Stable URLs**: Published content always lives at `/published/<project_id>/`, regardless of which job generated it
- **Overwrite**: Publishing a new job overwrites the previous published version
- **Metadata Tracking**: Projects track `published_url`, `published_at`, and `published_job_id`
- **Static File Serving**: Published content is served via Express static middleware

## Database Schema

The `vibe_projects` table includes:

```sql
published_url TEXT        -- e.g., "/published/<project_id>/index.html"
published_at INTEGER      -- Unix timestamp in milliseconds
published_job_id TEXT     -- ID of the job that was published
```

## Workflow Integration

1. **Development**: Jobs create previews at `/previews/<job_id>/`
2. **Review**: Preview the changes at `/previews/<job_id>/index.html`
3. **Publish**: Promote approved changes via `POST /projects/:id/publish`
4. **Live**: Access stable published version at `/published/<project_id>/index.html`

## Testing

See `scripts/test-publish.js` for a complete manual test script that demonstrates the full workflow.

```bash
node scripts/test-publish.js
```

## Future Enhancements (v2+)

- Custom domains for published projects
- Version history and rollback
- A/B testing between published versions
- Analytics on published content access
- Automatic publishing on successful preflight checks
