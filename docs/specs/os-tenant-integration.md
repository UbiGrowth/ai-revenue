# OS Tenant Integration Specification

## Overview

The OS Tenant Integration allows AI CMO to work with external tenants registered in the UbiGrowth OS without duplicating logic in their instances.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AI CMO Module                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Kernel    │  │   Agents    │  │  Tenant Registry    │  │
│  │   Router    │──│  (6 modes)  │──│  (os_tenant_registry)│  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         │                                    │               │
│         ▼                                    ▼               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Shared Supabase Tables                      ││
│  │  cmo_brand_profiles | cmo_campaigns | cmo_funnels | etc  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              │ tenant_id scoping
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    External OS Tenants                       │
│  ┌─────────────────────┐  ┌─────────────────────┐           │
│  │  First Touch        │  │  Future Tenant B    │           │
│  │  Coaching           │  │                     │           │
│  │  (tenant_id: ...)   │  │                     │           │
│  └─────────────────────┘  └─────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## Tenant Registry Table

```sql
os_tenant_registry (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE,         -- e.g., "first-touch-coaching"
  name TEXT,                -- e.g., "First Touch Coaching"
  tenant_id UUID UNIQUE,    -- UUID for all tenant-scoped operations
  description TEXT,
  is_active BOOLEAN,
  config JSONB,             -- { source, funnels, channels, integration_type }
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

## First Touch Coaching (FTS) Integration

### Tenant Details
- **Slug**: `first-touch-coaching`
- **Tenant ID**: `4161ee82-be97-4fa8-9017-5c40be3ebe19`
- **Funnels**: Camp Registration, Private Lessons
- **Channels**: Email, SMS

### Data Created for FTS

1. **Brand Profile**
   - Brand: First Touch Coaching
   - Industry: Youth Sports / Soccer Coaching
   - Voice: Encouraging, Energetic, Supportive

2. **ICP Segments**
   - Camp Parents (primary): Parents of kids 6-14 seeking summer camps
   - Private Lesson Seekers: Parents wanting personalized 1-on-1 training

3. **Funnels**
   - Camp Registration: Lead nurture for summer camp conversions
   - Private Lessons: Conversion funnel for lesson bookings

4. **AI CMO-Driven Campaigns**
   - **Camp Interest Nurture**: Email/SMS nurture for camp inquiries
   - **Private Lesson Follow-up**: Follow-up sequence for lesson inquiries

### Campaign Identification

AI CMO-driven campaigns are marked in their description with "AI CMO Driven" prefix, allowing FTS UI to clearly distinguish them from manually created campaigns.

## Data Access Pattern

All AI CMO reads/writes for external tenants filter by `tenant_id`:

```typescript
// Reading campaigns for FTS
const { data } = await supabase
  .from("cmo_campaigns")
  .select("*")
  .eq("tenant_id", FTS_TENANT.tenant_id);

// Writing new campaign
await supabase
  .from("cmo_campaigns")
  .insert({
    tenant_id: FTS_TENANT.tenant_id,
    workspace_id: FTS_TENANT.tenant_id,
    campaign_name: "New AI Campaign",
    description: "AI CMO Driven: ...",
    // ...
  });
```

## Agent Run Logging

All AI CMO executions for external tenants are logged to `agent_runs`:

```typescript
await supabase.from("agent_runs").insert({
  tenant_id: tenantId,
  workspace_id: tenantId,
  agent: "cmo-campaign-designer",
  mode: "campaigns",
  status: "completed",
  input: { ... },
  output: { ... }
});
```

## Integration Principles

1. **No Code in FTS**: All AI CMO logic remains in the AI CMO module
2. **Tenant Isolation**: All data operations scoped by `tenant_id`
3. **Clear Attribution**: AI CMO campaigns clearly marked for UI distinction
4. **Execution Logging**: All agent runs tracked with tenant context
5. **Module Access Control**: `tenant_module_access` gates feature availability

## Future Expansion

To add a new OS tenant:

1. Insert into `os_tenant_registry` with unique slug and tenant_id
2. Create workspace record with matching tenant_id
3. Add `user_tenants` mapping for authorized users
4. Enable module access via `tenant_module_access`
5. Create initial brand profile and campaigns as needed
