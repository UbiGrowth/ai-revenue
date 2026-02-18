import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

interface DemoModeState {
  demoMode: boolean;
  loading: boolean;
  workspaceId: string | null;
}

/**
 * Hook to get the centralized demo_mode state from the workspace.
 * All sample/demo data gating should use this hook instead of local toggles.
 */
export function useDemoMode(): DemoModeState {
  const { demoMode, isLoading: loading, workspaceId } = useWorkspaceContext();
  return { demoMode, loading, workspaceId };
}
