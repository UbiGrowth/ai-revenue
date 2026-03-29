# Checkpoint and Revert Feature

## Overview

VIBE automatically creates checkpoint tags after each successful job completion. These tags allow you to track the state of your repository at each successful job iteration and potentially revert to previous states if needed.

## Checkpoint Tag Format

Each successful job creates a git tag in the format:
```
vibe/job-<task_id>
```

For example, if a job with task ID `abc123` completes successfully, VIBE will create a tag named `vibe/job-abc123` pointing to the destination branch at the time of completion.

## When Checkpoints Are Created

Checkpoint tags are created in the following scenarios:

1. **Successful PR Creation**: After a pull request is successfully created and pushed to GitHub
2. **Local-Only Completion**: When a project has no remote URL and changes are committed locally only
3. **No Remote Configuration**: When the repository has no configured remote and changes are committed locally
4. **Remote URL Resolution Failure**: When the remote URL cannot be determined but changes are committed locally
5. **No Changes Scenario**: When the job completes successfully but no actual code changes were made

## Benefits

- **Audit Trail**: Track all successful job completions with permanent git tags
- **Version History**: Maintain a clear history of automated changes made by VIBE
- **Rollback Capability**: Git tags provide reference points for potential rollbacks or comparisons
- **Debugging**: Easier to identify and investigate specific job results

## Viewing Checkpoints

To list all VIBE checkpoint tags in a repository:

```bash
git tag -l "vibe/job-*"
```

To view the commit associated with a specific checkpoint:

```bash
git show vibe/job-<task_id>
```

## Implementation Details

The checkpoint functionality is implemented in the `VibeExecutor` class:

- **Method**: `createCheckpointTag(mainGit, taskId, branch)`
- **Location**: `apps/executor/src/index.ts`
- **Error Handling**: Tag creation failures are logged as warnings but do not fail the job
- **Repository**: Tags are created in the project's main repository (not the worktree)

## Future Enhancements

Potential future improvements to the checkpoint system:

- **Automatic Revert**: CLI command to revert a project to a specific checkpoint
- **Checkpoint Cleanup**: Automatic removal of old checkpoint tags after a configurable retention period
- **Checkpoint Metadata**: Store additional job metadata in tag annotations
- **Web UI Integration**: Display checkpoints in the VIBE web interface
