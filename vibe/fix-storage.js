const fs = require("fs");
const file = "C:/Users/bill/VIBE/apps/executor/src/storage.ts";
const bt = String.fromCharCode(96);
let c = fs.readFileSync(file, "utf8");
c = c.split("vibeDb.prepare" + bt).join("vibeDb.prepare(" + bt);
fs.writeFileSync(file, c, "utf8");
const remaining = (c.match(/vibeDb\.prepare[^(]/g) || []).length;
console.log("Done. Unfixed remaining: " + remaining);
