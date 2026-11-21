// The core team's guide (list.<domain>/guide/): how the sites, dashboards and project edit pages work.
// Written from src/guide/ to <DASHBOARD_OUT or site>/guide/ and locked behind the team password
// (DASHBOARD_PASSWORD), like the dashboards. Run: node scripts/build-guide.js
const fs = require("fs");
const path = require("path");
const { REPO } = require("./year");

const src = path.join(REPO, "src", "guide");
const out = path.join(REPO, process.env.DASHBOARD_OUT || "site", "guide");
fs.mkdirSync(path.join(out, "img"), { recursive: true });
for (const f of fs.readdirSync(path.join(src, "img"))) fs.copyFileSync(path.join(src, "img", f), path.join(out, "img", f));
const html = fs.readFileSync(path.join(src, "index.html"), "utf8");
fs.writeFileSync(path.join(out, "index.html"), require("./lock").lockPage(html, "team guide"));
console.log(`guide written to ${path.relative(REPO, out)}/${process.env.DASHBOARD_PASSWORD ? " (locked)" : ""}`);
