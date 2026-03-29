const fs = require("fs");
let c = fs.readFileSync("C:/Users/bill/VIBE/apps/executor/src/index.ts", "utf8");
c = c.split("project.repo_dir").join("project.local_path");
c = c.split("project.repo_source").join("project.repository_url");
fs.writeFileSync("C:/Users/bill/VIBE/apps/executor/src/index.ts", c, "utf8");
console.log("Done");