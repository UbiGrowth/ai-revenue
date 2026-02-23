const fs = require("fs");
let c = fs.readFileSync("C:/Users/bill/VIBE/apps/executor/src/index.ts", "utf8");

// Simple insertion right after "try {" in createPullRequest
const marker = "private async createPullRequest(task: VibeTask, mainGit: SimpleGit, repoUrl: string | null): Promise<void> {" + String.fromCharCode(10) + "    try {";

const insertion = String.fromCharCode(10) + "      // Check for remote first" + String.fromCharCode(10) + 
"      const remotes = await mainGit.getRemotes(true);" + String.fromCharCode(10) +
"      const origin = remotes.find(r => r.name === " + String.fromCharCode(34) + "origin" + String.fromCharCode(34) + ");" + String.fromCharCode(10) +
"      if (!origin || !origin.refs || !origin.refs.fetch) {" + String.fromCharCode(10) +
"        storage.logEvent(task.task_id, " + String.fromCharCode(34) + "No remote configured - task completed locally" + String.fromCharCode(34) + ", " + String.fromCharCode(34) + "info" + String.fromCharCode(34) + ");" + String.fromCharCode(10) +
"        storage.updateTaskState(task.task_id, " + String.fromCharCode(34) + "completed" + String.fromCharCode(34) + ");" + String.fromCharCode(10) +
"        return;" + String.fromCharCode(10) +
"      }";

c = c.replace(marker, marker + insertion);
fs.writeFileSync("C:/Users/bill/VIBE/apps/executor/src/index.ts", c, "utf8");
console.log("Done");