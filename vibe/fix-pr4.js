const fs = require("fs");
const lines = fs.readFileSync("C:/Users/bill/VIBE/apps/executor/src/index.ts", "utf8").split("
");

// Find the line with "private async createPullRequest"
let idx = lines.findIndex(l => l.includes("private async createPullRequest"));
if (idx === -1) { console.log("Method not found"); process.exit(1); }

// Insert after "try {" which should be 1 line down
const insertAt = idx + 2;

const newLines = [
  "      // Check for remote first",
  "      const remotes = await mainGit.getRemotes(true);",
  "      const origin = remotes.find(r => r.name === " + String.fromCharCode(39) + "origin" + String.fromCharCode(39) + ");",
  "      if (!origin || !origin.refs || !origin.refs.fetch) {",
  "        storage.logEvent(task.task_id, " + String.fromCharCode(39) + "No remote - completed locally" + String.fromCharCode(39) + ", " + String.fromCharCode(39) + "info" + String.fromCharCode(39) + ");",
  "        storage.updateTaskState(task.task_id, " + String.fromCharCode(39) + "completed" + String.fromCharCode(39) + ");",
  "        return;",
  "      }",
  ""
];

lines.splice(insertAt, 0, ...newLines);
fs.writeFileSync("C:/Users/bill/VIBE/apps/executor/src/index.ts", lines.join("
"), "utf8");
console.log("Inserted at line " + insertAt);