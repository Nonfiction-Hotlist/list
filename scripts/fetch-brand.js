// Copies the website's brand kit (/brand/v1/: styles, fonts, logos, menu script) and its shared top bar and
// footer (/shared/bar.html, /shared/footer.html) into src/brand/. build-site.js puts the bar and footer
// around every list page and loads the kit, so the lists look and move like nonfictionhotlist.com; the
// website builds both from its Menu and Footer tabs, so menu edits reach the lists this way too.
// If the website can't be reached, the saved copy in src/brand/ is used.
// Run: node scripts/fetch-brand.js   (the Publish workflow runs it on every run)
//   BRAND_SOURCE=~/projects/website/site node scripts/fetch-brand.js   copies from a local website build
const fs = require("fs");
const path = require("path");
const Y = require("./year");

const DEST = path.join(Y.REPO, "src", "brand");
const source = (process.env.BRAND_SOURCE || (Y.config.website || {}).origin || "").replace(/\/$/, "");

async function get(rel, binary) {
  if (!/^https?:/.test(source)) {
    const f = path.join(source.replace(/^~/, process.env.HOME), rel);
    return binary ? fs.readFileSync(f) : fs.readFileSync(f, "utf8");
  }
  const res = await fetch(`${source}/${rel}`, { redirect: "follow" });
  if (!res.ok) throw new Error(`${rel}: HTTP ${res.status}`);
  return binary ? Buffer.from(await res.arrayBuffer()) : res.text();
}

(async () => {
  let changed = false;
  const put = (rel, data) => {
    const f = path.join(DEST, rel);
    const before = fs.existsSync(f) ? fs.readFileSync(f) : null;
    if (before && Buffer.compare(before, Buffer.from(data)) === 0) return;
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, data);
    changed = true;
  };
  if (!source) console.log("No website address in years.json (website.origin); using the saved brand kit.");
  else {
    try {
      const bar = await get("shared/bar.html"), footer = await get("shared/footer.html");
      if (!bar.includes('class="nfh-bar"') || !footer.includes('class="nfh-footer')) throw new Error("the bar or footer doesn't look right");
      const files = JSON.parse(await get("brand/v1/files.json"));
      const kit = {};
      for (const f of files) kit[f] = await get(`brand/v1/${f}`, true);
      if (!kit["nfh.css"] || !kit["nfh.js"]) throw new Error("the kit is missing nfh.css or nfh.js");
      // Everything fetched: now write (a failed fetch leaves the saved copy as it was).
      put("bar.html", bar); put("footer.html", footer);
      for (const [f, data] of Object.entries(kit)) put(`v1/${f}`, data);
      put("v1/files.json", JSON.stringify(files, null, 1) + "\n");
      console.log(changed ? `Brand kit, top bar and footer updated from ${source}.` : "Brand kit, top bar and footer unchanged.");
    } catch (e) {
      console.log(`Couldn't copy the brand kit from ${source} (${e.message}); using the saved copy.`);
    }
  }
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
})();
