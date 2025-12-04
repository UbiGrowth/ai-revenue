# CMO Module Frontend Specification

## Overview
The AI CMO frontend is a React-based UI that provides marketing automation capabilities through shared components, hooks, and realtime data synchronization.

## Technology Stack
- **Framework**: React 18 with TypeScript
- **State Management**: React Query (TanStack Query)
- **Data Layer**: Supabase client (tenant-scoped)
- **Styling**: Tailwind CSS + shadcn/ui
- **Realtime**: Supabase Realtime subscriptions

## Directory Structure
```
src/
├── components/cmo/
│   ├── CMO90DayPlanner.tsx      # 90-day plan generation UI
│   ├── CMOBrandIntake.tsx       # Brand setup wizard
│   ├── CMOFunnelArchitect.tsx   # Funnel design interface
│   ├── shared/
│   │   ├── TenantHeader.tsx     # Workspace context display
│   │   ├── AgentConsole.tsx     # Prompt testing interface
│   │   ├── AgentHistory.tsx     # Agent run logs viewer
│   │   └── ResourceTable.tsx    # Generic data table
│   └── lazy/
│       └── index.tsx            # Lazy-loaded components
├── contexts/
│   └── CMOContext.tsx           # Workspace/tenant state
├── hooks/
│   ├── useCMO.ts                # React Query hooks for CMO data
│   ├── useCMOOptimistic.ts      # Optimistic update hooks
│   └── useCMORealtime.ts        # Realtime subscription hooks
└── lib/cmo/
    ├── types.ts                 # TypeScript interfaces
    └── api.ts                   # Supabase API operations
```

## Core Hooks

### useCMO.ts
React Query hooks for all CMO data operations:
```typescript
// Brand Profiles
useBrandProfiles(workspaceId)
useBrandProfile(profileId)
useCreateBrandProfile()
useUpdateBrandProfile()

// ICP Segments
useICPSegments(workspaceId)
useCreateICPSegment()
useUpdateICPSegment()

// Offers
useOffers(workspaceId)
useCreateOffer()

// Marketing Plans
useMarketingPlans(workspaceId)
useMarketingPlan(planId)
useCreateMarketingPlan()

// Funnels
useFunnels(workspaceId)
useFunnel(funnelId)
useFunnelStages(funnelId)
useCreateFunnel()

// Campaigns
useCampaigns(workspaceId)
useCampaign(campaignId)
useCreateCampaign()

// Content
useContentAssets(workspaceId)
useContentVariants(assetId)
useCreateContentAsset()

// Analytics
useMetricsSnapshots(workspaceId)
useRecommendations(workspaceId)
useWeeklySummaries(workspaceId)
useCalendarEvents(workspaceId)
```

### useCMOOptimistic.ts
Optimistic updates for snappy UI:
```typescript
useOptimisticCampaignUpdate()  // Campaign CRUD with rollback
useOptimisticContentUpdate()   // Content asset updates
useOptimisticRecommendation()  // Recommendation status changes
```

### useCMORealtime.ts
Live Supabase subscriptions:
```typescript
useCMORealtime(workspaceId, table)      // Generic table subscription
useAgentRunsRealtime(workspaceId)       # Agent execution status
useCalendarRealtime(workspaceId)        # Calendar updates
useMetricsRealtime(workspaceId)         # Metrics changes
```

## Shared Components

### TenantHeader
Displays workspace context and navigation:
- Current workspace name
- Workflow progress indicator
- Module navigation tabs

### AgentConsole
Interactive prompt testing:
- Mode selector (setup, strategy, funnels, etc.)
- JSON payload editor
- Stream response display
- Error handling with retry

### AgentHistory
Agent run log viewer:
- Filterable by agent/mode/status
- Expandable input/output JSON
- Duration and error tracking
- Realtime updates

### ResourceTable
Generic data table component:
- Column configuration
- Sorting/filtering
- Row actions (edit, delete, view)
- Pagination support

## Context

### CMOContext
Provides workspace and workflow state:
```typescript
interface CMOContextValue {
  tenantId: string | null;
  workspaceId: string | null;
  currentStep: CMOWorkflowStep;
  setCurrentStep: (step: CMOWorkflowStep) => void;
  completedSteps: CMOWorkflowStep[];
  markStepComplete: (step: CMOWorkflowStep) => void;
}
```

## Lazy Loading
Heavy components are lazy-loaded for performance:
```typescript
const SuspenseFunnelBuilder = lazy(() => import('./CMOFunnelArchitect'));
const Suspense90DayPlanner = lazy(() => import('./CMO90DayPlanner'));
const SuspenseBrandIntake = lazy(() => import('./CMOBrandIntake'));
```

Preloading utility for route transitions:
```typescript
preloadCMOComponent('funnels');  // Preload funnel builder
```

## Data Flow
1. **Fetch**: React Query fetches from Supabase (tenant-scoped via RLS)
2. **Action**: User triggers action → calls edge function
3. **Kernel**: `cmo-kernel` routes to appropriate agent
4. **AI**: Agent processes with AI gateway → updates DB
5. **Realtime**: Supabase subscription pushes update
6. **UI**: React Query cache invalidates → UI re-renders

## UI Routes
| Route | Component | Description |
|-------|-----------|-------------|
| `/cmo` | Dashboard | Overview & quick actions |
| `/cmo/brand` | BrandSetup | Brand intake wizard |
| `/cmo/plan` | Plan90Day | 90-day plan generator |
| `/cmo/funnels` | Funnels | Funnel architect |
| `/cmo/campaigns` | Campaigns | Campaign manager |
| `/cmo/content` | ContentStudio | Content generation |
| `/cmo/analytics` | Analytics | Performance dashboard |

## Testing
- **Unit**: Vitest for hooks and utilities
- **Integration**: Vitest for API flows
- **E2E**: Cypress for user journeys
