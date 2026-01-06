import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

/**
 * Legacy compatibility hook.
 *
 * Workspace selection must come from `WorkspaceContext` (single source of truth).
 * Consumers should prefer `useActiveWorkspaceId()` or `useWorkspaceContext()` directly.
 */
export function useWorkspace() {
  return useWorkspaceContext();
}

export default useWorkspace;
