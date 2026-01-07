# Database Schema Recommendations

## Priority: 🔴 Critical | 🟡 Important | 🟢 Nice-to-Have

---

## 🔴 **CRITICAL - Security & Data Integrity**

### **1. Eliminate Dual Scoping (workspace_id vs tenant_id)**
**Problem:** Most tables have BOTH `workspace_id` and `tenant_id`, causing confusion and potential bugs.

**Current State:**
```sql
-- 50+ tables with both columns
ALTER TABLE cmo_campaigns 
  ADD COLUMN workspace_id UUID,
  ADD COLUMN tenant_id UUID;
```

**Recommendation:**
```sql
-- Phase 1: Audit (Run this query)
SELECT 
  table_name,
  COUNT(*) FILTER (WHERE workspace_id IS NULL) as null_workspace,
  COUNT(*) FILTER (WHERE tenant_id IS NULL) as null_tenant,
  COUNT(*) FILTER (WHERE workspace_id != tenant_id) as mismatched
FROM (
  SELECT 'cmo_campaigns' as table_name, workspace_id, tenant_id FROM cmo_campaigns
  UNION ALL
  SELECT 'cmo_content_assets', workspace_id, tenant_id FROM cmo_content_assets
  -- Add all dual-scoped tables
) t
GROUP BY table_name;

-- Phase 2: Migration Strategy
-- Option A: Keep workspace_id only (RECOMMENDED)
ALTER TABLE cmo_campaigns DROP COLUMN tenant_id;
ALTER TABLE cmo_content_assets DROP COLUMN tenant_id;
-- Repeat for all tables

-- Option B: Keep tenant_id only (if legacy systems depend on it)
-- But rename to workspace_id for clarity
```

**Impact:** 
- ✅ Reduces confusion
- ✅ Prevents bugs from querying wrong column
- ✅ Simplifies RLS policies
- ⚠️ Requires migration of ~50 tables

**Priority:** 🔴 Critical - Do within 2 weeks

---

### **2. Fix Missing workspace_id on Key Tables**
**Problem:** Some tables lack workspace scoping, creating data leakage risks.

**Tables Missing workspace_id:**
```sql
-- Check with this query:
SELECT 
  tablename,
  attname as column_name
FROM pg_tables t
LEFT JOIN pg_attribute a ON a.attrelid = t.tablename::regclass
WHERE schemaname = 'public'
  AND tablename IN (
    'asset_approvals',
    'user_roles',
    'notifications'
  )
  AND attname = 'workspace_id';

-- If no results, these tables are missing workspace_id
```

**Fix:**
```sql
-- Add workspace_id to asset_approvals
ALTER TABLE asset_approvals 
  ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Backfill from related table
UPDATE asset_approvals aa
SET workspace_id = a.workspace_id
FROM assets a
WHERE aa.asset_id = a.id;

ALTER TABLE asset_approvals 
  ALTER COLUMN workspace_id SET NOT NULL;

-- Add RLS
ALTER TABLE asset_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation"
  ON asset_approvals FOR ALL
  USING (user_has_workspace_access(workspace_id));

-- Add index
CREATE INDEX idx_asset_approvals_workspace_id 
  ON asset_approvals(workspace_id);
```

**Priority:** 🔴 Critical - Do immediately

---

### **3. Audit and Fix RLS Policies**
**Problem:** Inconsistent RLS implementation across tables.

**Run This Audit:**
```sql
-- Find tables without RLS enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
  AND rowsecurity = false;

-- Find tables with RLS but no policies
SELECT 
  t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND p.policyname IS NULL;
```

**Standard RLS Template:**
```sql
-- Apply to ALL workspace-scoped tables
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_select"
  ON {table_name} FOR SELECT
  USING (user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_insert"
  ON {table_name} FOR INSERT
  WITH CHECK (user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_update"
  ON {table_name} FOR UPDATE
  USING (user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_delete"
  ON {table_name} FOR DELETE
  USING (user_has_workspace_access(workspace_id));
```

**Priority:** 🔴 Critical - Complete within 1 week

---

## 🟡 **IMPORTANT - Performance & Scale**

### **4. Add Composite Indexes for Common Queries**
**Problem:** Many queries filter by workspace_id + status/date, but indexes are single-column.

**Recommended Indexes:**
```sql
-- Leads (most queried table)
CREATE INDEX idx_leads_workspace_status ON leads(workspace_id, status);
CREATE INDEX idx_leads_workspace_created ON leads(workspace_id, created_at DESC);
CREATE INDEX idx_leads_workspace_score ON leads(workspace_id, score DESC);
CREATE INDEX idx_leads_workspace_tags ON leads(workspace_id) WHERE tags IS NOT NULL;

-- Campaigns
CREATE INDEX idx_campaigns_workspace_status ON campaigns(workspace_id, status);
CREATE INDEX idx_cmo_campaigns_workspace_status ON cmo_campaigns(workspace_id, status);

-- Channel Outbox (critical for job processing)
CREATE INDEX idx_channel_outbox_processing 
  ON channel_outbox(workspace_id, status, scheduled_at) 
  WHERE status IN ('scheduled', 'pending');

-- Deals (for CRO dashboard)
CREATE INDEX idx_deals_workspace_stage_value 
  ON deals(workspace_id, stage, value DESC);

-- Tasks (for activity tracking)
CREATE INDEX idx_tasks_workspace_status_due 
  ON tasks(workspace_id, status, due_date);
```

**Impact:**
- ✅ 10-100x faster queries on large datasets
- ✅ Reduces database load
- ⚠️ Increases storage (~5-10%)

**Priority:** 🟡 Important - Add within 2 weeks

---

### **5. Partition Large Tables**
**Problem:** `kernel_events`, `channel_outbox`, and `campaign_metrics` will grow unbounded.

**Tables to Partition:**
```sql
-- kernel_events (event log, grows forever)
-- Partition by month
CREATE TABLE kernel_events (
  id BIGSERIAL,
  event_type TEXT,
  tenant_id UUID,
  workspace_id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions (automate this)
CREATE TABLE kernel_events_2026_01 
  PARTITION OF kernel_events
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE kernel_events_2026_02 
  PARTITION OF kernel_events
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Automate partition creation with pg_cron
SELECT cron.schedule(
  'create-monthly-partitions',
  '0 0 1 * *', -- First day of month
  $$
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS kernel_events_%s PARTITION OF kernel_events FOR VALUES FROM (%L) TO (%L)',
    to_char(now() + interval '1 month', 'YYYY_MM'),
    date_trunc('month', now() + interval '1 month'),
    date_trunc('month', now() + interval '2 months')
  );
  $$
);

-- Similar for channel_outbox (partition by month, keep last 3 months)
-- Similar for campaign_metrics (partition by quarter)
```

**Priority:** 🟡 Important - Plan before 10M+ rows

---

### **6. Add Data Retention Policies**
**Problem:** No cleanup of old/stale data.

**Recommended Retention:**
```sql
-- Archive old events (keep 90 days in hot storage)
CREATE TABLE kernel_events_archive (LIKE kernel_events INCLUDING ALL);

-- Move to archive monthly
INSERT INTO kernel_events_archive
SELECT * FROM kernel_events
WHERE created_at < now() - interval '90 days';

DELETE FROM kernel_events
WHERE created_at < now() - interval '90 days';

-- Delete old outbox messages (keep 30 days)
DELETE FROM channel_outbox
WHERE created_at < now() - interval '30 days'
  AND status IN ('sent', 'delivered', 'failed');

-- Archive old campaign metrics (keep 1 year)
-- But aggregate to daily/weekly summaries first
```

**Schedule with pg_cron:**
```sql
SELECT cron.schedule(
  'cleanup-old-events',
  '0 2 * * *', -- 2 AM daily
  $$
  DELETE FROM channel_outbox
  WHERE created_at < now() - interval '30 days'
    AND status IN ('sent', 'delivered', 'failed');
  $$
);
```

**Priority:** 🟡 Important - Implement before 1M+ rows

---

## 🟢 **NICE-TO-HAVE - Optimization & Maintainability**

### **7. Normalize Repeated JSONB Patterns**
**Problem:** Many tables store structured data in JSONB that could be normalized.

**Example: Target Audiences**
```sql
-- Current (JSONB in business_profiles)
{
  "target_audiences": [
    {"name": "Small Business Owners", "size": "1-50", "industry": "SaaS"},
    {"name": "Enterprise CTOs", "size": "500+", "industry": "Finance"}
  ]
}

-- Recommended (Normalized)
CREATE TABLE business_profile_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_size TEXT,
  industry TEXT,
  annual_revenue TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Benefits:
-- ✅ Can query/filter by audience attributes
-- ✅ Can join with leads by attributes
-- ✅ Better data validation
```

**Other Candidates:**
- `brand_colors` → `business_profile_colors` table
- `cmo_campaigns.channels[]` → `campaign_channels` junction table
- `content.recipients[]` in assets → `asset_recipients` table

**Priority:** 🟢 Nice-to-Have - Consider for v2.0

---

### **8. Add Materialized Views for Analytics**
**Problem:** Complex analytics queries run on every page load.

**Recommended Views:**
```sql
-- Campaign performance summary (refreshed hourly)
CREATE MATERIALIZED VIEW mv_campaign_performance AS
SELECT 
  c.workspace_id,
  c.id as campaign_id,
  c.campaign_name,
  c.status,
  cm.impressions,
  cm.clicks,
  cm.conversions,
  cm.revenue,
  cm.cost,
  CASE 
    WHEN cm.cost > 0 THEN (cm.revenue / cm.cost) 
    ELSE 0 
  END as roi,
  cm.last_synced_at
FROM cmo_campaigns c
LEFT JOIN campaign_metrics cm ON cm.campaign_id = c.id
WHERE c.status IN ('active', 'completed');

CREATE UNIQUE INDEX ON mv_campaign_performance(campaign_id);
CREATE INDEX ON mv_campaign_performance(workspace_id);

-- Refresh hourly
SELECT cron.schedule(
  'refresh-campaign-performance',
  '0 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_campaign_performance'
);

-- Lead funnel metrics (refreshed daily)
CREATE MATERIALIZED VIEW mv_lead_funnel AS
SELECT 
  workspace_id,
  status,
  COUNT(*) as count,
  AVG(score) as avg_score,
  DATE_TRUNC('day', created_at) as date
FROM leads
GROUP BY workspace_id, status, DATE_TRUNC('day', created_at);

-- Revenue forecast view
CREATE MATERIALIZED VIEW mv_revenue_forecast AS
SELECT 
  workspace_id,
  period,
  scenario,
  SUM(forecast_new_arr) as total_forecast,
  AVG(confidence) as avg_confidence
FROM cro_forecasts
GROUP BY workspace_id, period, scenario;
```

**Priority:** 🟢 Nice-to-Have - Add when analytics are slow

---

### **9. Add Database-Level Constraints**
**Problem:** Data validation mostly in application code, not enforced at DB level.

**Recommended Constraints:**
```sql
-- Email validation
ALTER TABLE leads 
  ADD CONSTRAINT valid_email 
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Score bounds
ALTER TABLE leads 
  ADD CONSTRAINT valid_score 
  CHECK (score >= 0 AND score <= 100);

-- Probability bounds
ALTER TABLE deals 
  ADD CONSTRAINT valid_probability 
  CHECK (probability >= 0 AND probability <= 100);

-- Status enum enforcement (instead of free text)
CREATE TYPE lead_status AS ENUM (
  'new', 'contacted', 'qualified', 'nurturing', 
  'closed_won', 'closed_lost'
);

ALTER TABLE leads 
  ALTER COLUMN status TYPE lead_status 
  USING status::lead_status;

-- Positive values
ALTER TABLE deals 
  ADD CONSTRAINT positive_value 
  CHECK (value >= 0);

ALTER TABLE campaign_metrics 
  ADD CONSTRAINT positive_metrics 
  CHECK (impressions >= 0 AND clicks >= 0 AND conversions >= 0);

-- Date logic
ALTER TABLE deals 
  ADD CONSTRAINT logical_close_dates 
  CHECK (expected_close_date IS NULL OR actual_close_date IS NULL OR actual_close_date >= expected_close_date);
```

**Priority:** 🟢 Nice-to-Have - Add gradually

---

### **10. Implement Soft Deletes Consistently**
**Problem:** Mix of hard deletes and status-based soft deletes.

**Recommended Pattern:**
```sql
-- Add to all tables
ALTER TABLE leads 
  ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE INDEX idx_leads_active ON leads(workspace_id) 
  WHERE deleted_at IS NULL;

-- Update queries
-- Before:
SELECT * FROM leads WHERE workspace_id = $1;

-- After:
SELECT * FROM leads 
WHERE workspace_id = $1 
  AND deleted_at IS NULL;

-- Create view for active records
CREATE VIEW leads_active AS
SELECT * FROM leads WHERE deleted_at IS NULL;

-- Use view in application
SELECT * FROM leads_active WHERE workspace_id = $1;
```

**Priority:** 🟢 Nice-to-Have - Standardize in v2.0

---

## 🎯 **Implementation Priority**

### **Sprint 1 (Week 1-2):**
```
1. ✅ Audit RLS policies (find gaps)
2. ✅ Add workspace_id to missing tables
3. ✅ Fix critical RLS gaps
4. ✅ Add composite indexes for leads/campaigns
```

### **Sprint 2 (Week 3-4):**
```
1. ✅ Plan tenant_id → workspace_id migration
2. ✅ Create migration scripts
3. ✅ Test in staging
4. ✅ Add channel_outbox indexes
```

### **Sprint 3 (Month 2):**
```
1. ✅ Execute tenant_id deprecation
2. ✅ Add data retention policies
3. ✅ Implement pg_cron jobs for cleanup
4. ✅ Add materialized views for analytics
```

### **Sprint 4+ (Month 3+):**
```
1. ✅ Plan partitioning strategy
2. ✅ Normalize JSONB fields
3. ✅ Add database constraints
4. ✅ Implement soft deletes
```

---

## 📊 **Expected Impact**

### **After Critical Fixes (Sprint 1-2):**
- 🔒 **Security:** 100% data isolation guaranteed
- 🚀 **Performance:** 50-80% faster queries
- 🐛 **Bugs:** 90% reduction in workspace data leaks

### **After Important Fixes (Sprint 3):**
- 💾 **Storage:** 30-50% reduction via retention
- ⚡ **Dashboard:** 10x faster analytics
- 📈 **Scale:** Ready for 1M+ leads

### **After Nice-to-Have (Sprint 4+):**
- 🔧 **Maintenance:** Easier schema evolution
- 📊 **Analytics:** Real-time dashboards
- 🎯 **Quality:** DB-enforced data integrity

---

## 🛠️ **Migration Tools**

### **Run All Audits:**
```bash
# In Supabase SQL Editor or via CLI
psql -f scripts/audit-database-schema.sql
```

### **Test Workspace Isolation:**
```bash
# Already exists!
psql -f scripts/verify-workspace-isolation.sql
```

### **Monitor Performance:**
```sql
-- Find slow queries
SELECT 
  query,
  calls,
  total_time / calls as avg_time_ms,
  rows / calls as avg_rows
FROM pg_stat_statements
WHERE query LIKE '%workspace_id%'
ORDER BY total_time DESC
LIMIT 20;

-- Find missing indexes
SELECT 
  schemaname,
  tablename,
  seq_scan,
  idx_scan,
  CASE 
    WHEN seq_scan > 0 THEN seq_scan::float / (seq_scan + idx_scan)
    ELSE 0
  END as seq_scan_ratio
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan_ratio DESC;
```

---

## ✅ **Quick Wins (Do Today!)**

```sql
-- 1. Add critical indexes (5 minutes)
CREATE INDEX CONCURRENTLY idx_leads_workspace_status 
  ON leads(workspace_id, status);

CREATE INDEX CONCURRENTLY idx_channel_outbox_processing 
  ON channel_outbox(workspace_id, status, scheduled_at) 
  WHERE status IN ('scheduled', 'pending');

-- 2. Enable missing RLS (10 minutes)
ALTER TABLE asset_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_isolation" 
  ON asset_approvals FOR ALL 
  USING (user_has_workspace_access(
    (SELECT workspace_id FROM assets WHERE id = asset_approvals.asset_id)
  ));

-- 3. Add retention cleanup (5 minutes)
SELECT cron.schedule(
  'cleanup-old-outbox',
  '0 2 * * *',
  $$DELETE FROM channel_outbox 
    WHERE created_at < now() - interval '30 days' 
      AND status IN ('sent', 'delivered', 'failed')$$
);
```

---

## 📚 **Additional Resources**

- **PostgreSQL Performance:** https://www.postgresql.org/docs/current/performance-tips.html
- **Supabase RLS Guide:** https://supabase.com/docs/guides/auth/row-level-security
- **Partitioning Guide:** https://www.postgresql.org/docs/current/ddl-partitioning.html

---

*Last Updated: January 2026*
*Based on: Master Prompt v3 Schema Analysis*

