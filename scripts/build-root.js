// Writes the files at the top of the website, outside any year:
//   site/index.html   sends visitors to the latest live year (keeping any #page in the link)
//   site/404.html     sends an unknown address to its year, or to the latest year
//   site/dashboard/   sends the team to the dashboard for the year they viewed last, or the latest year
//   site/CNAME        the custom domain, from years.json
//   site/favicon.svg  the latest year's icon
//   site/brand/v1/    the brand kit (styles, fonts, logos, menu script), copied from src/brand/ (scripts/fetch-brand.js)
// Run: npm run root
const fs = require("fs");
const path = require("path");
const Y = require("./year");

const SITE = path.join(Y.REPO, "site");
const latest = Y.config.latest;
const years = Object.keys(Y.config.years);
const live = years.filter(y => Y.config.years[y].status === "live");

const shell = (title, script, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script>${script}</script>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#2e4a3b;color:#ebe6d7;font:16px Georgia,serif;text-align:center}a{color:inherit}p{margin:.4em}</style>
</head>
<body><div>${body}</div></body>
</html>
`;
const list = live.slice().reverse().map(y => `<p><a href="/${y}/">The ${y} Nonfiction Hotlist</a></p>`).join("");

fs.writeFileSync(path.join(SITE, "index.html"), shell("nonfiction hotlist.",
  `location.replace("/${latest}/" + location.hash);`,
  list));

fs.writeFileSync(path.join(SITE, "404.html"), shell("nonfiction hotlist.",
  `var y = (location.pathname.match(/^\\/(${years.join("|")})(\\/|$)/) || [])[1]; location.replace("/" + (y || "${latest}") + "/");`,
  `<p>Page not found.</p>${list}`));

const KIT = path.join(Y.REPO, "src", "brand", "v1");
if (fs.existsSync(KIT)) { fs.rmSync(path.join(SITE, "brand"), { recursive: true, force: true }); fs.cpSync(KIT, path.join(SITE, "brand", "v1"), { recursive: true }); }

fs.mkdirSync(path.join(SITE, "dashboard"), { recursive: true });
fs.writeFileSync(path.join(SITE, "dashboard", "index.html"), shell("Team dashboard",
  `var y; try { y = localStorage.getItem("nfhDashYear"); } catch (e) {} if (!/^(${years.join("|")})$/.test(y || "")) y = "${latest}"; location.replace("/" + y + "/dashboard/");`,
  years.slice().reverse().map(y => `<p><a href="/${y}/dashboard/">${y} team dashboard</a></p>`).join("")).replace("<title>", '<meta name="robots" content="noindex">\n<title>'));

fs.writeFileSync(path.join(SITE, "CNAME"), Y.config.domain + "\n");
fs.writeFileSync(path.join(SITE, "favicon.svg"), fs.readFileSync(path.join(Y.REPO, "src", "favicon.svg"), "utf8").replace("__YY__", latest.slice(-2)));
console.log(`site root written: ${Y.config.domain} -> /${latest}/ (live: ${live.join(", ")})`);
