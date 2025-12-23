# CRM v1 – Shippable Scope

This document defines the tight scope for CRM v1 release. Features outside this scope are deferred to prevent QA spiral.

## ✅ In Scope (Shipping)

### 1. Lead Capture + Import
- [x] Manual lead creation form
- [x] CSV import with column mapping
- [x] Segment assignment on import
- [x] Workspace isolation (leads scoped to workspace_id)

### 2. Pipeline Stages + Drag/Drop
- [x] Visual lead pipeline (LeadPipeline component)
- [x] Status-based stages: new → contacted → qualified → converted → lost
- [x] Drag-and-drop status changes
- [x] Real-time UI updates

### 3. Deal Creation + Close Won/Lost
- [x] DealsPipeline component with Kanban view
- [x] Deal stages: prospecting → discovery → proposal → negotiation → closed_won → closed_lost
- [x] Deal value tracking
- [x] Revenue verification via revenue_verified flag

### 4. Activity Timeline (Append-Only)
- [x] lead_activities table for timeline events
- [x] EnhancedTimeline component for display
- [x] Email/voice events append via:
  - email_events table (normalized from webhook)
  - voice_call_records table
- [x] Activity logging via crm_log_activity() function

### 5. Views Powering Dashboards (No Fake Metrics)
- [x] v_pipeline_metrics_by_workspace – pipeline KPIs
- [x] v_crm_source_of_truth – unified CRM metrics
- [x] v_impressions_clicks_by_workspace – engagement metrics
- [x] v_revenue_by_workspace – revenue metrics
- [x] v_campaign_metrics_gated – campaign metrics with demo_mode filter

### 6. Demo Mode Gating
- [x] demo_mode toggle for admins/owners only
- [x] data_mode column on all metrics tables
- [x] Views filter by data_mode based on workspace.demo_mode
- [x] Banner shows when in demo mode or missing providers

## ❌ Deferred (Not in v1)

- Email editor/builder
- Multi-touch attribution modeling
- Lead scoring AI model training
- Custom pipeline stage configuration
- Webhooks for external CRM sync
- Bulk email sending from CRM
- Lead deduplication wizard
- Advanced segmentation rules engine

## Data Flow

```
Lead Sources → leads table → v_pipeline_metrics_by_workspace
                          ↓
                    lead_activities
                          ↓
                    Timeline Display

Deals → deals table → v_pipeline_metrics_by_workspace
                   ↓
              Dashboard KPIs

Email Events → email_events → v_impressions_clicks_by_workspace
                           ↓
                      Email Analytics

Voice Calls → voice_call_records → voice analytics
```

## Security Invariants

1. All tables use workspace_id for RLS
2. Views respect demo_mode gating
3. Only source='user' deals count in live metrics
4. revenue_verified required for verified_revenue

## Testing Checklist

- [ ] Import 10 leads via CSV → appear in pipeline
- [ ] Drag lead from 'new' to 'contacted' → status persists
- [ ] Create deal, mark closed_won → appears in v_pipeline_metrics
- [ ] Toggle demo_mode ON → dashboards show demo badge
- [ ] Toggle demo_mode OFF → zeros if no live data
