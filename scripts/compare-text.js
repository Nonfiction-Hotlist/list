// Compares the text two built pages carry (their SITE and PROJECTS data), ignoring image paths.
// Each argument is a URL or a local file. Exits 1 if any text differs.
//   node scripts/compare-text.js https://nfh2025.rdgnbl.com/ site/2025/index.html
const fs = require("fs");
const vm = require("vm");

async function load(src) {
  const html = /^https?:/.test(src) ? await (await fetch(src)).text() : fs.readFileSync(src, "utf8");
  const a = html.indexOf("const SITE ="), b = html.indexOf("];", html.indexOf("const PROJECTS =", a));
  if (a < 0 || b < 0) throw new Error(`${src}: no data block`);
  return vm.runInNewContext(html.slice(a, b + 2) + "\n({ SITE, PROJECTS })");
}

// Image paths and framing live in layout.json, not Drive, and are prefixed differently per address.
const isImage = (k, v) => typeof v === "string" && /\.(jpe?g|png|webp|svg)$/i.test(v) || /^(img|image|images|focus|fy|fx|crop)$/i.test(k);

function diff(x, y, path, out) {
  if (x && y && typeof x === "object" && typeof y === "object") {
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
      if (isImage(k, x[k]) || isImage(k, y[k])) continue;
      diff(x[k], y[k], `${path}.${k}`, out);
    }
  } else if (JSON.stringify(x) !== JSON.stringify(y)) out.push(`${path}\n  A: ${JSON.stringify(x)}\n  B: ${JSON.stringify(y)}`);
  return out;
}

(async () => {
  const [A, B] = process.argv.slice(2);
  const [a, b] = await Promise.all([load(A), load(B)]);
  const out = diff(a, b, "", []);
  console.log(`A: ${A}\nB: ${B}\n${a.PROJECTS.length} vs ${b.PROJECTS.length} projects`);
  console.log(out.length ? `${out.length} differences:\n${out.join("\n")}` : "Same text.");
  process.exit(out.length ? 1 : 0);
})();
