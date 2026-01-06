import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..");

describe("Revenue OS Kernel contracts are frozen + versioned", () => {
  it("contract version constant matches docs", () => {
    const typesPath = path.join(REPO_ROOT, "supabase/functions/_shared/revenue_os_kernel/types.ts");
    const docsPath = path.join(REPO_ROOT, "docs/REVENUE_OS_KERNEL_CONTRACTS.md");

    const types = fs.readFileSync(typesPath, "utf8");
    const docs = fs.readFileSync(docsPath, "utf8");

    const m = types.match(/REVENUE_OS_KERNEL_CONTRACT_VERSION\s*=\s*["'](v\d+)["']/);
    expect(m).toBeTruthy();

    const version = m![1];
    expect(docs).toMatch(new RegExp(String.raw`\*\*Contract version:\*\*\s+\`${version}\``));
  });

  it("docs reference kernel tables", () => {
    const docsPath = path.join(REPO_ROOT, "docs/REVENUE_OS_KERNEL_CONTRACTS.md");
    const docs = fs.readFileSync(docsPath, "utf8");

    expect(docs).toContain("kernel_events");
    expect(docs).toContain("kernel_decisions");
    expect(docs).toContain("kernel_actions");
  });

  it("event-bus inserts to kernel_events table (not agent_runs)", () => {
    const eventBusPath = path.join(REPO_ROOT, "supabase/functions/_shared/revenue_os_kernel/event-bus.ts");
    const eventBus = fs.readFileSync(eventBusPath, "utf8");

    expect(eventBus).toContain('.from("kernel_events")');
    expect(eventBus).not.toContain('.from("agent_runs")');
  });

  it("orchestrator emits to kernel_events (not just audit)", () => {
    const orchestratorPath = path.join(REPO_ROOT, "supabase/functions/cmo-campaign-orchestrate/index.ts");
    const orchestrator = fs.readFileSync(orchestratorPath, "utf8");

    expect(orchestrator).toContain('.from(\'kernel_events\')');
    expect(orchestrator).toContain("tenant_id: tenantId");
    expect(orchestrator).toContain("workspace_id: workspaceId");
  });

  it("tenant_id and workspace_id are kept separate in orchestrator", () => {
    const orchestratorPath = path.join(REPO_ROOT, "supabase/functions/cmo-campaign-orchestrate/index.ts");
    const orchestrator = fs.readFileSync(orchestratorPath, "utf8");

    // Must have distinct tenantId and workspaceId variables
    expect(orchestrator).toMatch(/const tenantId = tenant_id/);
    expect(orchestrator).toMatch(/const workspaceId = workspace_id \|\| tenant_id/);
  });
});

