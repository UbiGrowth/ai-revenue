# VIBE Scripts

Utility scripts for managing VIBE projects.

## Prerequisites

- `curl` - For making API requests
- `jq` - For JSON parsing (install with `apt-get install jq` or `brew install jq`)

## Scripts

### create-project.sh

Create a new VIBE project.

**Usage:**
```bash
./scripts/create-project.sh <project-name> <repository-url>
```

**Example:**
```bash
./scripts/create-project.sh my-app https://github.com/myorg/my-app
```

**Environment Variables:**
- `VIBE_API_URL` - API URL (default: `http://localhost:3001`)

### list-projects.sh

List all registered VIBE projects.

**Usage:**
```bash
./scripts/list-projects.sh
```

**Example Output:**
```
✓ Found 2 project(s)

Projects:
  • my-app (abc-123-def)
    Repository: https://github.com/myorg/my-app
    Local path: /data/repos/abc-123-def
    Last synced: 2026-02-10 22:30:45

  • another-project (xyz-789-ghi)
    Repository: https://github.com/myorg/another-project
    Local path: /data/repos/xyz-789-ghi
    Last synced: Never
```

## API Reference

For more details about the projects API, see the main [README](../README.md).

### Create Project

```bash
curl -X POST http://localhost:3001/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-project",
    "repository_url": "https://github.com/owner/repo"
  }'
```

### List Projects

```bash
curl http://localhost:3001/projects
```

### Get Project Details

```bash
curl http://localhost:3001/projects/{project_id}
```

### Delete Project

```bash
curl -X DELETE http://localhost:3001/projects/{project_id}
```
