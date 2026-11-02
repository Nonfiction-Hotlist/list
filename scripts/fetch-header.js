// Copies the website's top bar (years.json website.header) into src/site-header.html, which
// build-site.js puts above every list page's own controls. The website builds the bar from its Menu tab,
// so menu edits reach the lists this way. If the website can't be reached, the saved copy is used.
// Run: node scripts/fetch-header.js   (the Publish workflow runs it on every run)
const fs = require("fs");
const path = require("path");
const Y = require("./year");

const FILE = path.join(Y.REPO, "src", "site-header.html");
const url = (Y.config.website || {}).header;

(async () => {
  let changed = false;
  if (!url) console.log("No website header address in years.json; list pages show their own bar only.");
  else {
    try {
      const res = await fetch(url, { redirect: "follow" });
      const html = await res.text();
      if (!res.ok || !html.includes('class="nfh-bar"')) throw new Error(`HTTP ${res.status}`);
      const before = fs.existsSync(FILE) ? fs.readFileSync(FILE, "utf8") : "";
      if (html !== before) { fs.writeFileSync(FILE, html); changed = true; }
      console.log(changed ? "Website top bar updated." : "Website top bar unchanged.");
    } catch (e) {
      console.log(`Couldn't fetch the website's top bar (${e.message}); using the saved copy.`);
    }
  }
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
})();
