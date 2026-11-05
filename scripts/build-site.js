// Builds site/<year>/index.html from years/<year>/page.html.
// The year's page is the page body as published to the Claude artifact (no <html>/<head>);
// this wraps it in a full document with metadata for the public website.
// Run: npm run build   (NFH_YEAR=2026 npm run build for another year)
const fs = require("fs");
const path = require("path");
const Y = require("./year");

const SITE_URL = Y.SITE_URL;
const src = fs.readFileSync(Y.PAGE, "utf8");
const content = JSON.parse(fs.readFileSync(Y.file("content.json"), "utf8"));
const count = Object.keys(content.projects).length;

// Everything up to the end of the first <style> block (title, font links, styles) belongs in <head>.
const cut = src.indexOf("</style>") + "</style>".length;
const headPart = src.slice(0, cut).replace(/<meta name="claude:[^>]*>\n?/g, "");
const bodyPart = src.slice(cut).trim();

// The website's top bar and footer (src/brand/, copied in by scripts/fetch-brand.js) go around the list, and
// the brand kit's styles and menu script load from the site's own copy (/brand/v1/, written by build-root.js),
// so the list reads as part of nonfictionhotlist.com with the same menu. The list's own bar then names the
// list ("2025 hotlist"). The kit hosts the fonts, so the Google Fonts links (kept for the Claude artifact
// version, years/<year>/page.html) are dropped here.
const BRAND = path.join(Y.REPO, "src", "brand");
const has = f => fs.existsSync(path.join(BRAND, f));
const siteHeader = has("bar.html") && has("v1/nfh.css") ? fs.readFileSync(path.join(BRAND, "bar.html"), "utf8") : "";
const siteFooter = siteHeader && has("footer.html") ? fs.readFileSync(path.join(BRAND, "footer.html"), "utf8") : "";
const listBody = siteHeader
  ? bodyPart.replace(/<a class="wordmark" href="#cover">[\s\S]*?<\/a>/, `<a class="wordmark" href="#cover">${Y.Y} hotlist</a>`)
  : bodyPart;
const brandHead = siteHeader ? `<link rel="preload" href="/brand/v1/fonts/LeagueSpartan-Bold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/brand/v1/fonts/RobotoSerif-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/brand/v1/nfh.css">
<script src="/brand/v1/nfh.js" defer></script>` : "";

const title = (headPart.match(/<title>([^<]*)<\/title>/) || [, "Nonfiction Hotlist"])[1];
const description = count
  ? `The ${Y.Y} Nonfiction Hotlist: ${count} exceptional unproduced nonfiction projects, what each needs, and how to help.`
  : `The ${Y.Y} Nonfiction Hotlist.`;

// Visit counting for the website only (the Claude version has no window.nfhTrack, so it counts nothing).
// GoatCounter: no cookies, no personal data. Automatic counting is off because the site routes with the
// URL hash; page.html calls nfhTrack(path, title[, event]) itself. Calls made before the script loads queue up.
// A browser with localStorage "skipgc" set (the dashboard's "don't count me" switch, and the smoke tests) is skipped.
// Each year counts under its own prefix ("/2026/manhood", "pdf-download-2026"); 2025 keeps its original paths.
// A draft year counts nothing.
const GOATCOUNTER = `${Y.config.goatcounter}/count`;
const ANALYTICS = Y.isDraft ? "" : `<script>
window.nfhTrack = function (path, title, event) {
  try { if (localStorage.getItem("skipgc") === "t") return; } catch (e) {}
  path = event ? (path === "pdf-download" ? ${JSON.stringify(Y.pdfEvent)} : path) : ${JSON.stringify(Y.info.trackPrefix)} + path;
  var go = function () { window.goatcounter.count({ path: path, title: title || path, event: !!event }); };
  if (window.goatcounter && window.goatcounter.count) go(); else (window.nfhQueue = window.nfhQueue || []).push(go);
};
</script>
<script data-goatcounter="${GOATCOUNTER}" data-goatcounter-settings='{"no_onload": true}' async src="https://gc.zgo.at/count.js"
  onload="(window.nfhQueue || []).forEach(function (f) { f(); }); window.nfhQueue = [];"></script>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${description}">
<meta name="theme-color" content="#ffffff">${Y.isDraft ? '\n<meta name="robots" content="noindex, nofollow">' : ""}
<link rel="canonical" href="${SITE_URL}/">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:site_name" content="nonfiction hotlist.">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${SITE_URL}/">
<meta property="og:image" content="${SITE_URL}/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<style>
:root { padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
body { margin: 0; font: 14px system-ui, -apple-system, sans-serif; }
img { max-width: 100%; }
[hidden] { display: none !important; }
</style>
${brandHead}
${siteHeader ? headPart.replace(/<link rel="(preconnect|stylesheet)" href="https:\/\/fonts\.(googleapis|gstatic)\.com[^>]*>\n?/g, "") : headPart}
${ANALYTICS}
</head>
<body>
${siteHeader}${listBody}${siteFooter ? "\n" + siteFooter : ""}
</body>
</html>
`;

fs.mkdirSync(Y.OUT, { recursive: true });
fs.writeFileSync(path.join(Y.OUT, "index.html"), html);
// The tab icon carries the year's last two digits.
fs.writeFileSync(path.join(Y.OUT, "favicon.svg"), fs.readFileSync(path.join(Y.REPO, "src", "favicon.svg"), "utf8").replace("__YY__", Y.Y.slice(-2)));
console.log(`wrote site/${Y.Y}/index.html`, (html.length / 1024).toFixed(0) + " KB");
