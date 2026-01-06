import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Plus, Check, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
}

interface WorkspaceSelectorProps {
  onWorkspaceChange?: (workspaceId: string | null) => void;
}

export default function WorkspaceSelector({ onWorkspaceChange }: WorkspaceSelectorProps) {
  const { workspaces, workspaceId, workspace, isLoading, selectWorkspace, createWorkspace } = useWorkspaceContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({ name: "", slug: "" });

  const handleCreateWorkspace = async () => {
    if (!newWorkspace.name || !newWorkspace.slug) {
      return;
    }

    const created = await createWorkspace(
      newWorkspace.name,
      newWorkspace.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-")
    );

    if (created) {
      setDialogOpen(false);
      setNewWorkspace({ name: "", slug: "" });
      onWorkspaceChange?.(created.id);
    }
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  };

  const currentWorkspace = workspaceId
    ? (workspace ?? workspaces.find((w) => w.id === workspaceId) ?? null)
    : null;

  const handleSelectWorkspace = async (ws: Workspace) => {
    await selectWorkspace(ws.id);
    onWorkspaceChange?.(ws.id);
  };

  if (isLoading) {
    return (
      <Button variant="outline" disabled className="w-[200px]">
        <Building2 className="h-4 w-4 mr-2" />
        Loading...
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="w-[200px] justify-between"
            data-workspace-selector
          >
            <span className="flex items-center">
              <Building2 className="h-4 w-4 mr-2" />
              {currentWorkspace?.name || "Select Workspace"}
            </span>
            <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          {workspaces.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              onClick={() => handleSelectWorkspace(ws)}
              className="flex items-center justify-between"
            >
              {ws.name}
              {currentWorkspace?.id === ws.id && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
          {workspaces.length > 0 && <DropdownMenuSeparator />}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Plus className="h-4 w-4 mr-2" />
                Create Workspace
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Workspace</DialogTitle>
                <DialogDescription>
                  Create a separate workspace for a different business or team
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Workspace Name</Label>
                  <Input
                    value={newWorkspace.name}
                    onChange={(e) => {
                      setNewWorkspace({
                        name: e.target.value,
                        slug: generateSlug(e.target.value),
                      });
                    }}
                    placeholder="e.g., Acme Corp"
                  />
                </div>
                <div>
                  <Label>Workspace URL</Label>
                  <div className="flex items-center">
                    <span className="text-sm text-muted-foreground mr-2">ubigrowth.app/</span>
                    <Input
                      value={newWorkspace.slug}
                      onChange={(e) => setNewWorkspace({ ...newWorkspace, slug: e.target.value })}
                      placeholder="acme-corp"
                    />
                  </div>
                </div>
                <Button onClick={handleCreateWorkspace} className="w-full">
                  Create Workspace
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
