# Phase A: Multi-Worker Horizontal Scaling

## Overview

This document describes the multi-worker horizontal scaling architecture for the job queue system. Multiple workers can process jobs concurrently without breaking exactly-once guarantees.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Job Queue                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  job_queue table (queued jobs)                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                    │
│              ┌──────────────┼──────────────┐                    │
│              ▼              ▼              ▼                    │
│         ┌────────┐    ┌────────┐    ┌────────┐                 │
│         │Worker 1│    │Worker 2│    │Worker N│                 │
│         └───┬────┘    └───┬────┘    └───┬────┘                 │
│             │             │             │                       │
│             └──────────────┼──────────────┘                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  channel_outbox (exactly-once delivery)                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Worker Pool

### Configuration
- **Default workers**: 2-4 identical workers
- **Each worker has**: Unique worker ID (`worker-{timestamp}-{random}`)
- **Tick interval**: 1 minute (via cron)

### Concurrency Model
Workers use PostgreSQL's `FOR UPDATE SKIP LOCKED` pattern:
1. Each worker atomically claims jobs
2. Claimed jobs are locked to that worker
3. Other workers skip locked jobs
4. No duplicate processing possible

## Fairness: Per-Tenant Caps

### Per-Tick Limits
| Limit | Value | Purpose |
|-------|-------|---------|
| `MAX_JOBS_PER_TICK` | 200 | Global cap per worker tick |
| `MAX_JOBS_PER_TENANT_PER_TICK` | 25 | Prevent noisy neighbor |

### Pass Criteria
- **FAIR1**: No single tenant can consume >25 jobs per tick even with 1000 queued
- **FAIR2**: Multiple tenants progress each minute via interleaved ordering

### Fair Distribution Algorithm
```sql
WITH ranked_jobs AS (
  SELECT id, tenant_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY scheduled_for, created_at) as tenant_rank
  FROM job_queue WHERE status = 'queued'
  FOR UPDATE SKIP LOCKED
),
fair_jobs AS (
  SELECT id FROM ranked_jobs
  WHERE tenant_rank <= 25  -- FAIR1: Max per tenant
  ORDER BY tenant_rank, scheduled_for  -- FAIR2: Interleave tenants
  LIMIT 200  -- Global cap
)
UPDATE job_queue SET status = 'locked', locked_by = p_worker_id ...
```

### Throttled Jobs
Jobs exceeding per-tenant limit are:
1. Released back to queue
2. Scheduled with backoff delay
3. Logged as `skipped_throttle: true`

## Observability

### Worker Tick Metrics Table
```sql
worker_tick_metrics
├── worker_id          -- Which worker
├── tick_started_at    -- When tick started
├── tick_duration_ms   -- Processing time
├── jobs_claimed       -- Jobs claimed this tick
├── jobs_processed     -- Jobs actually processed
├── jobs_succeeded     -- Successful completions
├── jobs_failed        -- Failed jobs
├── jobs_throttled     -- Throttled due to limits
├── lock_contention_count -- Lock contentions
├── tenant_jobs        -- Per-tenant breakdown
└── queue_depth_at_start -- Queue size at start
```

### Worker Health View
```sql
SELECT * FROM worker_health_summary;
-- Shows last 5 minutes per worker:
-- tick_count, avg_tick_duration_ms, total_jobs_claimed,
-- total_jobs_succeeded, total_lock_contentions, last_tick_at
```

### Key Metrics to Monitor
| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Tick duration | < 30s | 30-50s | > 50s |
| Lock contentions | 0 | 1-5 | > 5 |
| Jobs per tick | 10-50 | 50-100 | > 100 |
| Queue depth | < 100 | 100-500 | > 500 |

## Pass/No-Pass Criteria

### HS1: Concurrent Processing - No Duplicates
**Test**: Two workers claim same time window
**Pass**: Each job processed exactly once (idempotency key check)
**Verification**: 
```sql
SELECT idempotency_key, COUNT(*) 
FROM channel_outbox 
GROUP BY idempotency_key 
HAVING COUNT(*) > 1;
-- Should return 0 rows
```

### HS2: Worker Crash Recovery
**Test**: Kill worker mid-processing
**Pass**: Other workers continue, no resend
**Mechanism**: 
- Dead worker's locked jobs timeout after 5 minutes
- Recovery worker reclaims and checks outbox before resend
- Idempotency key prevents duplicate delivery

### HS3: Linear Throughput Scaling
**Test**: Measure throughput with 1, 2, 4 workers
**Pass**: Throughput scales ~linearly
**Expected**:
- 1 worker: ~50 jobs/minute
- 2 workers: ~100 jobs/minute
- 4 workers: ~200 jobs/minute

## Exit Criteria

✅ **Stable with 4 workers under load**:
- [ ] No duplicate outbox entries
- [ ] No stuck jobs (locked > 5 min)
- [ ] Queue depth stays bounded
- [ ] Tick duration < 30s average
- [ ] All tenants get fair share

## Deployment

### Running Multiple Workers
Workers are stateless - simply invoke the edge function concurrently:

```bash
# Worker 1
curl -X POST https://project.supabase.co/functions/v1/run-job-queue \
  -H "x-internal-secret: $SECRET"

# Worker 2 (concurrent)
curl -X POST https://project.supabase.co/functions/v1/run-job-queue \
  -H "x-internal-secret: $SECRET"
```

### Cron Configuration
```sql
-- Single cron entry triggers function
-- Supabase handles concurrent execution
SELECT cron.schedule(
  'run-job-queue',
  '* * * * *',  -- Every minute
  $$ SELECT net.http_post(...) $$
);
```

### Scaling Up/Down
1. **Scale up**: Deploy more concurrent invocations
2. **Scale down**: Reduce concurrent invocations
3. No code changes required - workers are identical

## Troubleshooting

### High Lock Contention
**Symptom**: `lock_contention_count > 0` in metrics
**Cause**: Too many workers competing for same jobs
**Fix**: Reduce worker count or increase job volume

### Uneven Tenant Distribution
**Symptom**: Some tenants get all capacity
**Cause**: Per-tenant limit not enforced
**Fix**: Check `tenant_jobs` in metrics, verify limit

### Stuck Jobs
**Symptom**: Jobs in `locked` status > 5 min
**Cause**: Worker crashed mid-processing
**Fix**: Manual unlock or wait for timeout recovery
```sql
UPDATE job_queue 
SET status = 'queued', locked_at = NULL, locked_by = NULL
WHERE status = 'locked' 
AND locked_at < now() - interval '5 minutes';
```

## Related Documents
- [EXECUTION_CONTRACT.md](./EXECUTION_CONTRACT.md) - Exactly-once guarantees
- [QA_GATES.md](./QA_GATES.md) - Testing requirements
