"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Home,
  FolderKanban,
  MessageSquare,
  Settings,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  CreditCard,
  HelpCircle,
  User,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { createProject } from "@/lib/api"

const navItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: FolderKanban, label: "Projects", href: "/projects" },
  { icon: MessageSquare, label: "Chat", href: "/chat" },
  { icon: Settings, label: "Settings", href: "/settings" },
]

const bottomItems = [
  { icon: HelpCircle, label: "Help & Support", href: "/help" },
  { icon: CreditCard, label: "Billing", href: "/billing" },
]

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const handleNewProject = async () => {
    if (!newProjectName.trim() || creating) return
    setCreating(true)
    setCreateError(null)
    try {
      const result = await createProject(newProjectName.trim())
      if (result.error) {
        setCreateError(result.error)
      } else {
        setDialogOpen(false)
        setNewProjectName("")
        router.refresh()
      }
    } catch {
      setCreateError("Failed to create project. Is the API running?")
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
    <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setNewProjectName(""); setCreateError(null) } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Input
            placeholder="Project name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleNewProject() }}
            disabled={creating}
            autoFocus
          />
          {createError && (
            <p className="text-xs text-red-400 mt-2">{createError}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            onClick={handleNewProject}
            disabled={!newProjectName.trim() || creating}
            className="bg-gradient-to-r from-[#4F8EFF] to-[#A855F7] text-white border-0"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out flex-shrink-0",
          collapsed ? "w-[68px]" : "w-[240px]"
        )}
      >
        {/* Logo / Brand */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border flex-shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#4F8EFF] via-[#A855F7] to-[#EC4899]">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-lg font-semibold text-sidebar-foreground tracking-tight">
              VIBE
            </span>
          )}
        </div>

        {/* New Project Button */}
        <div className="px-3 pt-4 pb-2 flex-shrink-0">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  onClick={() => setDialogOpen(true)}
                  className="w-full h-9 bg-gradient-to-r from-[#4F8EFF] to-[#A855F7] hover:opacity-90 text-primary-foreground border-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">New Project</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              onClick={() => setDialogOpen(true)}
              className="w-full h-9 bg-gradient-to-r from-[#4F8EFF] to-[#A855F7] hover:opacity-90 text-primary-foreground border-0 justify-start gap-2"
            >
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          )}
        </div>

        {/* Search */}
        {!collapsed && (
          <div className="px-3 pb-2 flex-shrink-0">
            <button className="flex items-center gap-2 w-full h-9 px-3 rounded-lg bg-sidebar-accent text-muted-foreground text-sm hover:bg-sidebar-accent/80 transition-colors">
              <Search className="w-4 h-4" />
              <span>Search...</span>
              <kbd className="ml-auto text-[10px] bg-sidebar-border px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                {"/"}</kbd>
            </button>
          </div>
        )}

        {/* Main Nav */}
        <nav className="flex-1 px-3 py-2 flex flex-col gap-1 overflow-y-auto">
          <span className={cn(
            "text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-3 mb-1",
            collapsed && "sr-only"
          )}>
            Navigation
          </span>
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const linkContent = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 h-9 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                  collapsed && "justify-center px-0"
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              )
            }
            return linkContent
          })}
        </nav>

        {/* Bottom Section */}
        <div className="px-3 py-2 border-t border-sidebar-border flex flex-col gap-1 flex-shrink-0">
          {bottomItems.map((item) => {
            const linkContent = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 h-9 rounded-lg text-sm font-medium text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors",
                  collapsed && "justify-center px-0"
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              )
            }
            return linkContent
          })}

          {/* User Avatar */}
          <div className={cn(
            "flex items-center gap-3 px-3 h-10 rounded-lg mt-1",
            collapsed && "justify-center px-0"
          )}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4F8EFF] to-[#A855F7] flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-sidebar-foreground truncate">Demo User</span>
                <span className="text-[10px] text-muted-foreground truncate">Free Plan</span>
              </div>
            )}
          </div>
        </div>

        {/* Collapse Toggle */}
        <div className="px-3 py-2 border-t border-sidebar-border flex-shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCollapsed(!collapsed)}
                className={cn(
                  "flex items-center gap-3 px-3 h-9 rounded-lg text-sm font-medium text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors w-full",
                  collapsed && "justify-center px-0"
                )}
              >
                {collapsed ? (
                  <ChevronRight className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <>
                    <ChevronLeft className="w-4 h-4 flex-shrink-0" />
                    <span>Collapse</span>
                  </>
                )}
              </button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Expand</TooltipContent>}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
    </>
  )
}
