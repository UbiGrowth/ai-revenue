// Tenant Header - Workspace context display

import { Building2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCMOContext } from "@/contexts/CMOContext";
import { Skeleton } from "@/components/ui/skeleton";

interface TenantHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function TenantHeader({ title, subtitle, actions }: TenantHeaderProps) {
  const { workspaceId, tenantId, isLoading } = useCMOContext();

  if (isLoading) {
    return (
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {title || "CMO Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {subtitle || `Workspace: ${workspaceId?.slice(0, 8)}...`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {actions}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <span className="text-xs text-muted-foreground">Tenant</span>
              <span className="font-mono text-xs">{tenantId?.slice(0, 8)}...</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-xs">
              <span className="text-muted-foreground">Tenant ID:</span>
              <span className="ml-2 font-mono">{tenantId}</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs">
              <span className="text-muted-foreground">Workspace:</span>
              <span className="ml-2 font-mono">{workspaceId}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
