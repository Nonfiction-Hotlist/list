// Runs drive-kit/publish-trigger.gs against stand-ins: an edit in one site's kit must start a publish
// of that site only; the Hotlist also gets its hourly refresh.   node drive-kit/test/trigger-test.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const props = { GITHUB_TOKEN: "t" }, sent = [], edited = {};
let now = Date.parse("2026-11-02T12:00:00Z");
const box = {
  Logger: { log: () => {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
  ScriptApp: { newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => {} }) }) }), getProjectTriggers: () => [], deleteTrigger: () => {} },
  // Each manifest lists one file, named after the manifest; its edit time is in `edited`.
  SpreadsheetApp: { openById: id => ({ getSheets: () => [{ getDataRange: () => ({ getValues: () => [["Kind"], ["x", "", "", "file-" + id]] }) }] }) },
  DriveApp: { getFileById: id => ({ getLastUpdated: () => new Date(edited[id] || 0) }) },
  UrlFetchApp: { fetch: url => { sent.push(url.match(/repos\/(.+?)\/actions/)[1]); return { getResponseCode: () => 204, getContentText: () => "" }; } },
  Date: Object.assign(function (...a) { return new Date(...a); }, { now: () => now })
};
vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "publish-trigger.gs"), "utf8") + "\nthis.SITES = SITES;", box);
const sites = box.SITES, list = sites[0], web = sites[1];
const expect = (what, want) => { const got = sent.splice(0).join(","); if (got !== want) { console.log(`FAIL ${what}: sent [${got}], expected [${want}]`); process.exitCode = 1; } else console.log(`ok  ${what}`); };

box.install(); expect("install publishes both", sites.map(s => s.repo).join(","));
now += 10 * 60e3; box.check(); expect("no edits: nothing", "");
edited["file-" + web.manifests.website] = now; now += 10 * 60e3; box.check(); expect("website edit: website only", web.repo);
edited["file-" + list.manifests["2026"]] = now; now += 10 * 60e3; box.check(); expect("2026 kit edit: Hotlist only", list.repo);
now += 61 * 60e3; box.check(); expect("an hour later: Hotlist refresh only", list.repo);
