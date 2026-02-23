const fs = require("fs");
let c = fs.readFileSync("C:/Users/bill/VIBE/apps/executor/src/index.ts", "utf8");

const oldMethod = `private async createPullRequest(task: VibeTask, mainGit: SimpleGit, repoUrl: string | null): Promise<void> {
    try {
      storage.updateTaskState(task.task_id, "creating_pr");
      storage.logEvent(task.task_id, "Pushing branch to remote...", "info");

      await mainGit.push("origin", task.destination_branch, ["--force"]);`;

const newMethod = `private async createPullRequest(task: VibeTask, mainGit: SimpleGit, repoUrl: string | null): Promise<void> {
    try {
      // Check if remote exists
      const remotes = await mainGit.getRemotes(true);
      const origin = remotes.find(r => r.name === "origin");
      
      if (!origin || !origin.refs || !origin.refs.fetch) {
        storage.logEvent(task.task_id, "No GitHub remote configured - skipping PR creation", "info");
        storage.updateTaskState(task.task_id, "completed");
        storage.logEvent(task.task_id, "Task completed successfully (local changes only)", "success");
        return;
      }

      storage.updateTaskState(task.task_id, "creating_pr");
      storage.logEvent(task.task_id, "Pushing branch to remote...", "info");

      await mainGit.push("origin", task.destination_branch, ["--force"]);`;

c = c.replace(oldMethod, newMethod);
fs.writeFileSync("C:/Users/bill/VIBE/apps/executor/src/index.ts", c, "utf8");
console.log("Done");