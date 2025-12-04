# AI CMO – Frontend Requirements (v2)

## Framework
- React / Next.js shell (Lovable)
- Supabase client, tenant-scoped
- React Query or equivalent

## Screens
- /cmo/dashboard
- /cmo/setup
- /cmo/plan
- /cmo/funnels
- /cmo/campaigns
- /cmo/content
- /cmo/calendar
- /cmo/analytics
- /cmo/settings

## Layout
- Left sidebar: Setup, Plan, Funnels, Campaigns, Content, Analytics
- Top bar: tenant selector, "Run AI CMO"
- Main panel: active mode
- Right panel: AI suggestions / recommendations

## Components to reuse
- AgentConsole
- AgentHistory
- TenantHeader
- ResourceTable

## Hooks
| Hook | Purpose |
|------|---------|
| `useCMO` | React Query hooks for all CMO data |
| `useCMOOptimistic` | Optimistic updates with rollback |
| `useCMORealtime` | Supabase realtime subscriptions |

## Context
- `CMOContext` - workspace/tenant state, workflow progress

## Data Flow
1. Supabase → React Query fetches (tenant_id scoped)
2. Actions → call Edge Functions → kernel logs
3. Kernel → AI gateway → agent prompts → DB updates
4. UI re-renders through live Supabase subscription

## Styling
- Tailwind CSS semantic tokens
- shadcn/ui components
- No direct colors (use design system)

## Lazy Loading
- Heavy components: FunnelBuilder, 90DayPlanner, BrandIntake
- Preload on route hover

## Error Handling
- Toast notifications for user feedback
- 429 → "Rate limit exceeded"
- 402 → "Payment required"
- Generic fallback for other errors
