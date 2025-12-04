# CMO Module Deployment Checklist

Version: ai_cmo_v2.0.0  
Status: Pre-Production  
Last Updated: 2024-12-04

---

## 1. Environment Verification

### Database
- [ ] Supabase project connected (nyzgsizvtqhafoxixyrd)
- [ ] All `cmo_*` tables exist:
  - [ ] cmo_brand_profiles
  - [ ] cmo_icp_segments
  - [ ] cmo_offers
  - [ ] cmo_marketing_plans
  - [ ] cmo_funnels
  - [ ] cmo_funnel_stages
  - [ ] cmo_campaigns
  - [ ] cmo_campaign_channels
  - [ ] cmo_content_assets
  - [ ] cmo_content_variants
  - [ ] cmo_calendar_events
  - [ ] cmo_metrics_snapshots
  - [ ] cmo_weekly_summaries
  - [ ] cmo_recommendations
- [ ] RLS enabled on all tables with `tenant_isolation` policy
- [ ] Foreign keys validated

### Edge Functions
- [ ] cmo-kernel (router)
- [ ] cmo-brand-intake
- [ ] cmo-plan-90day
- [ ] cmo-funnel-architect
- [ ] cmo-campaign-designer
- [ ] cmo-content-engine
- [ ] cmo-optimization-analyst
- [ ] cmo-generate-content
- [ ] cmo-generate-funnel
- [ ] cmo-launch-campaign
- [ ] cmo-record-metrics
- [ ] cmo-summarize-weekly
- [ ] cmo-cron-weekly
- [ ] cmo-webhook-outbound

### Kernel Registration
- [ ] ai_cmo manifest registered in kernel/modules/index.ts
- [ ] All modes mapped: setup, strategy, funnels, campaigns, content, optimization
- [ ] Agent prompts exist in agents/cmo/

### Secrets
- [ ] GEMINI_API_KEY (Lovable AI)
- [ ] INTERNAL_FUNCTION_SECRET
- [ ] RESEND_API_KEY (optional, for email)
- [ ] FAL_API_KEY (optional, for images)

---

## 2. Tenant Test Run

### Test Sequence
Execute each mode sequentially for test tenant:

```typescript
import { runKernel } from '@/kernel';

const tenantId = 'test-tenant-uuid';
const workspaceId = 'test-workspace-uuid';

// 1. Setup - Brand Intake
await runKernel({
  module: 'ai_cmo',
  mode: 'setup',
  tenant_id: tenantId,
  workspace_id: workspaceId,
  payload: { brand_name: 'Test Brand', industry: 'Technology' }
});

// 2. Strategy - 90-Day Plan
await runKernel({
  module: 'ai_cmo',
  mode: 'strategy',
  tenant_id: tenantId,
  workspace_id: workspaceId,
  payload: { budget: 50000, goals: ['lead_generation'] }
});

// 3. Funnels - Funnel Architect
await runKernel({
  module: 'ai_cmo',
  mode: 'funnels',
  tenant_id: tenantId,
  workspace_id: workspaceId,
  payload: { funnel_type: 'marketing' },
  context: { plan_id: 'generated-plan-uuid' }
});

// 4. Campaigns - Campaign Designer
await runKernel({
  module: 'ai_cmo',
  mode: 'campaigns',
  tenant_id: tenantId,
  workspace_id: workspaceId,
  payload: {},
  context: { funnel_id: 'generated-funnel-uuid' }
});

// 5. Content - Content Engine
await runKernel({
  module: 'ai_cmo',
  mode: 'content',
  tenant_id: tenantId,
  workspace_id: workspaceId,
  payload: { content_type: 'email' },
  context: { campaign_id: 'generated-campaign-uuid' }
});

// 6. Optimization - Analyst
await runKernel({
  module: 'ai_cmo',
  mode: 'optimization',
  tenant_id: tenantId,
  workspace_id: workspaceId,
  payload: {}
});
```

### Verification
- [ ] All 6 modes complete without error
- [ ] agent_runs table has 6 new rows
- [ ] All rows share same tenant_id
- [ ] status = 'completed' for all
- [ ] duration_ms < 30000 for each
- [ ] No error_message values

---

## 3. Frontend Validation

### Routes
- [ ] /cmo → Dashboard loads
- [ ] /cmo/setup → Brand intake wizard
- [ ] /cmo/plan → 90-day plan view
- [ ] /cmo/funnels → Funnel architect
- [ ] /cmo/campaigns → Campaign list
- [ ] /cmo/content → Content library
- [ ] /cmo/calendar → Calendar view
- [ ] /cmo/analytics → Weekly summaries
- [ ] /cmo/settings → Module settings

### Console Checks
- [ ] No errors on any route
- [ ] No 401/403 responses
- [ ] No CORS errors
- [ ] No undefined/null render errors

### Data Binding
- [ ] Plan screen shows plan data from cmo_marketing_plans
- [ ] Campaign list shows cmo_campaigns
- [ ] Content library shows cmo_content_assets
- [ ] Analytics shows cmo_weekly_summaries markdown

### Button Actions
- [ ] "Generate Plan" → calls cmo-plan-90day
- [ ] "Create Funnel" → calls cmo-funnel-architect
- [ ] "Design Campaign" → calls cmo-campaign-designer
- [ ] "Generate Content" → calls cmo-content-engine
- [ ] "Run Analysis" → calls cmo-optimization-analyst

---

## 4. Performance & Security

### Performance Benchmarks
| Metric | Target | Measured |
|--------|--------|----------|
| Brand intake response | < 5s | ___ |
| Plan generation | < 10s | ___ |
| Funnel generation | < 8s | ___ |
| Campaign design | < 8s | ___ |
| Content generation | < 15s | ___ |
| Optimization analysis | < 5s | ___ |
| Average agent call | < 3s | ___ |

### Security Checklist
- [ ] All cmo_* tables have RLS enabled
- [ ] No public SELECT without auth
- [ ] tenant_id validated in all edge functions
- [ ] Service role only used in cron/internal functions
- [ ] JWT verified on all user-facing endpoints
- [ ] No sensitive data in client bundle

### Rate Limiting
- [ ] Per-minute limit: 60 requests/tenant
- [ ] Per-hour limit: 500 requests/tenant
- [ ] Per-day limit: 2000 requests/tenant
- [ ] 429 response on limit exceeded

### Audit Coverage
- [ ] agent_runs captures all executions
- [ ] Input/output logged (sanitized)
- [ ] Duration tracked
- [ ] Error messages captured
- [ ] Coverage ≥ 95%

---

## 5. Staging → Production

### Pre-Release
- [ ] All tests pass
- [ ] Security scan clean
- [ ] Performance benchmarks met
- [ ] Documentation updated

### Release Process
```bash
# 1. Tag release
git tag ai_cmo_v2.0.0
git push origin ai_cmo_v2.0.0

# 2. Edge functions deploy automatically via Lovable

# 3. Verify deployment
curl https://nyzgsizvtqhafoxixyrd.supabase.co/functions/v1/cmo-kernel \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode":"setup","tenant_id":"test","workspace_id":"test","payload":{}}'
```

### Kernel Sync
- [ ] manifest version = 2.0.0
- [ ] kernel/modules/index.ts imports cmo.manifest.json
- [ ] getModule('ai_cmo') returns manifest

### Dashboard Visibility
- [ ] Module appears in OS module list
- [ ] Status shows "active"
- [ ] All screens accessible

### Progressive Rollout
1. [ ] Enable for internal testing (UbiGrowth team)
2. [ ] Enable for Playkout tenant
3. [ ] Enable for 10% of tenants
4. [ ] Enable for 50% of tenants
5. [ ] Enable for all tenants

---

## 6. Post-Launch Monitoring

### Daily Health Check
```sql
-- Agent run success rate (last 24h)
SELECT 
  agent,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'completed') as success,
  ROUND(COUNT(*) FILTER (WHERE status = 'completed')::numeric / COUNT(*)::numeric * 100, 2) as success_rate
FROM agent_runs
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND agent LIKE 'cmo-%'
GROUP BY agent;

-- Average duration by agent
SELECT 
  agent,
  ROUND(AVG(duration_ms)::numeric, 0) as avg_ms,
  MAX(duration_ms) as max_ms
FROM agent_runs
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND agent LIKE 'cmo-%'
  AND status = 'completed'
GROUP BY agent;

-- Error summary
SELECT 
  agent,
  error_message,
  COUNT(*)
FROM agent_runs
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND agent LIKE 'cmo-%'
  AND status = 'error'
GROUP BY agent, error_message;
```

### Weekly Summary Generation
Automated via cmo-cron-weekly edge function:
- Generates cmo_weekly_summaries entry
- Aggregates metrics from cmo_metrics_snapshots
- Identifies top performing content
- Creates recommendations

### Alert Thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| Error rate | > 1% | > 5% |
| Avg response | > 5s | > 10s |
| Failed runs | > 10/hr | > 50/hr |

### Feedback Collection
- [ ] Pilot tenant feedback form deployed
- [ ] NPS survey scheduled (week 2)
- [ ] Feature request tracking enabled
- [ ] Bug report channel active

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering | | | |
| QA | | | |
| Product | | | |
| Security | | | |
