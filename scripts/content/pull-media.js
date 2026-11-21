// Project images from the Drive kit. Each project's Media folder has four subfolders:
//   Key      the project card (3:2)            one image; the largest wins if there are several
//   Hero     the wide photo on the project page (21:9), from Key if empty
//   Poster   a vertical poster beside the project text (2:3)
//   Gallery  the stills, in file name order
// The kit's listImages lists them on the manifest's Images tab. This downloads what changed since the
// last run, crops and sizes it with ffmpeg into site/<year>/img/, and updates layout.json.
// top, bottom, left or right in a file name steers the crop.
//
// media-sources.json remembers which Drive files each image came from, so unchanged images are not
// downloaded again. Images the kit copied in from the site itself (01 Key art.jpg and so on) are
// recognised and left as they are.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, execSync } = require("child_process");
const Y = require("../year");

const LAYOUT = Y.file("layout.json");
const SOURCES = Y.file("media-sources.json");
const CROP = {
  key: { ratio: 3 / 2, w: 960 },
  hero: { ratio: 21 / 9, w: 1800 },
  poster: { ratio: 2 / 3, w: 800 },
};
const SEEDED = { key: /^01 Key art\./, hero: /^02 Banner\./, gallery: /^\d+ Still \d+\./ };
const MAX_BYTES = 40e6;
const MAX_GALLERY = 12;

let ready = false;
function tools() {
  if (ready) return;
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); }
  catch {
    // Installed only on runs that have images to process.
    if (!process.env.CI) throw new Error("ffmpeg is not installed");
    execSync("sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg", { stdio: "ignore" });
  }
  ready = true;
}
const ffmpeg = args => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
function dims(file) {
  const [w, h] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
    "-of", "csv=p=0", file]).toString().trim().split(",").map(Number);
  if (!w || !h) throw new Error("not a readable image");
  return [w, h];
}

async function download(f, dir) {
  const dest = path.join(dir, f.id);
  if (fs.existsSync(dest)) return dest;
  if (f.bytes > MAX_BYTES) throw new Error(`"${f.name}" is over 40 MB`);
  const res = await fetch(`https://drive.usercontent.google.com/download?id=${f.id}&export=download&confirm=t`, { redirect: "follow" });
  const type = res.headers.get("content-type") || "";
  if (!res.ok || type.includes("text/html")) throw new Error(`couldn't download "${f.name}" (is it shared by link?)`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

// Crop anchor from the file name: 0 = top/left, 1 = bottom/right. The project editor writes the framing
// a filmmaker picked as "focus-40-25" (percent across, percent down); otherwise top, bottom, left or right.
function anchor(name) {
  const n = name.toLowerCase(), has = w => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(n);
  const fx = n.match(/focus-(\d{1,3})-(\d{1,3})/);
  if (fx) return { x: Math.min(100, +fx[1]) / 100, y: Math.min(100, +fx[2]) / 100 };
  return { x: has("left") ? 0 : has("right") ? 1 : 0.5, y: has("top") ? 0 : has("bottom") ? 1 : 0.5 };
}

function cropTo(src, dest, ratio, width, a) {
  const r = ratio.toFixed(5);
  ffmpeg(["-i", src, "-frames:v", "1", "-update", "1", "-q:v", "3", "-vf",
    `crop=w='min(iw,ih*${r})':h='min(ih,iw/${r})':x='(iw-ow)*${a.x}':y='(ih-oh)*${a.y}',scale=w='min(${width},iw)':h=-2`, dest]);
}
function fitTo(src, dest, max) {
  ffmpeg(["-i", src, "-frames:v", "1", "-update", "1", "-q:v", "3", "-vf",
    `scale=w='min(${max},iw)':h='min(${max},ih)':force_original_aspect_ratio=decrease`, dest]);
  return dims(dest);
}

/**
 * rows: [{ slug, slot, id, name, bytes, updated }] from the Images tab.
 * titles: { slug: title } for the projects on the site. renamed: { oldSlug: newSlug }.
 * removed: slugs of projects taken out of the kit.
 * Returns the titles of projects whose images changed.
 */
async function syncMedia({ rows, titles, renamed = {}, removed = [], warn }) {
  const layout = JSON.parse(fs.readFileSync(LAYOUT, "utf8"));
  layout.projects = layout.projects || {};
  const sources = fs.existsSync(SOURCES) ? JSON.parse(fs.readFileSync(SOURCES, "utf8")) : {};
  const before = JSON.stringify([layout, sources]);
  for (const [old, key] of Object.entries(renamed)) {
    if (layout.projects[old]) { layout.projects[key] = layout.projects[old]; delete layout.projects[old]; }
    if (sources[old]) { sources[key] = sources[old]; delete sources[old]; }
  }

  // Projects taken out of the kit: their framing, sources and image files go too.
  const img0 = path.join(Y.OUT, "img");
  for (const slug of removed) {
    delete layout.projects[slug]; delete sources[slug];
    if (fs.existsSync(img0)) for (const f of fs.readdirSync(img0)) if (f.startsWith(slug + "-") && /^(key|hero|poster|g\d+)\.jpg$/.test(f.slice(slug.length + 1))) fs.rmSync(path.join(img0, f));
  }

  // rows null: the image list couldn't be read, so only carry renames over.
  const by = {};
  for (const r of rows || []) {
    if (!titles[r.slug] || !["key", "hero", "poster", "gallery"].includes(r.slot)) continue;
    const p = by[r.slug] || (by[r.slug] = { key: [], hero: [], poster: [], gallery: [] });
    p[r.slot].push(r);
  }
  // A project whose folders were emptied still needs a look, so a removed poster or gallery goes away.
  if (rows) for (const slug of Object.keys(sources)) if (titles[slug] && !by[slug]) by[slug] = { key: [], hero: [], poster: [], gallery: [] };

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nfh-media-"));
  const img = path.join(Y.OUT, "img");
  fs.mkdirSync(img, { recursive: true });
  const changed = new Set();
  // A new framing renames the file, so names with a focus count too (others are left out, so older images
  // aren't processed again).
  const sig = list => list.map(f => `${f.id}@${f.updated}${/focus-\d/i.test(f.name) ? "#" + f.name : ""}`).sort().join("|");

  try {
    for (const [slug, slots] of Object.entries(by)) {
      const L = layout.projects[slug] || (layout.projects[slug] = {});
      const S = sources[slug] || (sources[slug] = {});
      const title = titles[slug];

      const run = async (slot, list, fresh, emptied, prefix = "") => {
        const s = list.length ? prefix + sig(list) : "";
        if (S[slot] === s) return;
        if (!list.length) {
          if (S[slot] !== undefined && emptied) { emptied(); changed.add(title); }
          S[slot] = s; return;
        }
        // Copies of what the site already shows, put there when the kit was built.
        const seeded = !prefix && SEEDED[slot] && list.every(f => SEEDED[slot].test(f.name));
        if (S[slot] === undefined && seeded && (slot === "gallery" ? L.stills : L[slot])) { S[slot] = s; return; }
        try {
          tools();
          for (const f of list) { f.path = await download(f, tmp); [f.w, f.h] = dims(f.path); }
          await fresh(list);
          S[slot] = s; changed.add(title);
        } catch (e) { warn(`${title} images`, `${slot}: ${String(e.message).split("\n")[0]}; kept the current image`); }
      };
      const largest = list => list.slice().sort((a, b) => b.w * b.h - a.w * a.h || b.bytes - a.bytes)[0];
      const single = slot => async list => {
        const f = largest(list), file = `img/${slug}-${slot}.jpg`, a = anchor(f.name);
        cropTo(f.path, path.join(Y.OUT, file), CROP[slot].ratio, CROP[slot].w, a);
        L[slot] = file;
        if (slot === "hero") { L.focus = a.x * 100; L.focusY = a.y * 100; }
      };

      await run("key", slots.key, single("key"));
      // Hero falls back to the key image ("key:" in the signature tells the two apart).
      if (slots.hero.length) await run("hero", slots.hero, single("hero"));
      else await run("hero", slots.key, single("hero"), null, "key:");
      await run("poster", slots.poster, single("poster"), () => { delete L.poster; });
      await run("gallery", slots.gallery.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).slice(0, MAX_GALLERY),
        async list => {
          L.gallery = list.map((f, i) => {
            const file = `img/${slug}-g${i + 1}.jpg`;
            const [w, h] = fitTo(f.path, path.join(Y.OUT, file), 1400);
            return [file, w, h];
          });
        }, () => { delete L.gallery; });
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }

  if (JSON.stringify([layout, sources]) !== before) {
    fs.writeFileSync(LAYOUT, JSON.stringify(layout, null, 1) + "\n");
    fs.writeFileSync(SOURCES, JSON.stringify(sources, null, 1) + "\n");
  }
  return [...changed];
}

module.exports = { syncMedia };
