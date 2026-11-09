# How the Nonfiction Hotlist sites run

## What's where

| Address | What | Built from | Edited in Drive (Nonfiction Hotlist CD) |
|---|---|---|---|
| nonfictionhotlist.com | Squarespace, until the switch-over below | | |
| new.nonfictionhotlist.com | The rebuilt website (preview, hidden from search) | Nonfiction-Hotlist/website | NFH Website |
| list.nonfictionhotlist.com/2025, /2026 | The Hotlist, one list per year | Nonfiction-Hotlist/list | NFH 2025, NFH 2026 |
| nfh2025.rdgnbl.com | Forwards every old link to the same page on the list site | matthewsmaglik/nonfictionhotlist (frozen) | |

Team dashboards (unlisted): list.nonfictionhotlist.com/dashboard/ (one year at a time) and new.nonfictionhotlist.com/dashboard/.

The website builds the top bar from its Menu tab; every list page shows that bar above its own controls.

## What runs on its own

| What | Where | How often | Does |
|---|---|---|---|
| Publish trigger (`check`) | Apps Script "NFH publish trigger", as matthew@ | every 10 min | Starts a publish of whichever site's kit was edited; asks the Hotlist for an hourly dashboard refresh |
| `renameProjects` | Apps Script "NFH 2025 kit", "NFH 2026 kit" | every 10 min | Follows a Copysheet's new Title to its folder, sheet and running order |
| `refreshKit` | Apps Script "NFH Website kit" | every 10 min | Makes a Doc for each new Pages or News row; lists Media's images and videos |
| Publish workflow | GitHub, both repos | every 15 min (backup to the trigger), on every push, on demand | Reads Drive, builds, checks every page, publishes |
| Forms script (`doPost`) | Apps Script "NFH website forms", web app as matthew@ | on each form entry | Saves to the private "Website sign-ups" Sheet, emails NOTIFY_EMAIL about contact entries, adds opt-ins to the Brevo list "Nonfiction Hotlist Website Sign-ups" |
| Link check | GitHub, list repo | daily | Finds broken outside links; shown on the dashboards |

On a push, each repo runs its kit tests first; a failing test stops the publish.

## Keys and settings that must stay in place

- **GitHub token** in the publish trigger's script property `GITHUB_TOKEN`: fine-grained, owner Nonfiction-Hotlist, repos list and website, Actions read and write. **Expires about November 2027.** Before then: make a new one the same way, paste it into the property, run `install`.
- **`DASHBOARD_PASSWORD`** secret in both repos: the team dashboards are encrypted with it when they build (scripts/lock.js, scripts/lib/lock.js in the website repo). To change the password, update the secret in both repos (Settings > Secrets and variables > Actions) and run each Publish workflow. The browser remembers it after the first visit.
- **`GOATCOUNTER_TOKEN`** secret in the list repo (read-only API key) for the dashboards' visit counts.
- **Drive sharing**: each kit folder is "Anyone with the link: Viewer" (the sites read it that way) and coreteam@ is Editor (the team edits that way). The Workspace setting that allows link sharing (Admin > Drive and Docs > Sharing) must stay on.
- **Brevo API key** in the forms script's property `BREVO_API_KEY` (with `BREVO_LIST_ID` and `NOTIFY_EMAIL`). Brevo's IP blocking is off **for API keys** (Security > Authorized IPs), because Apps Script runs from changing Google addresses; it's still on for SMTP keys. If the key ever leaks, delete it in Brevo (SMTP & API > API keys), make a new one and paste it into the property. The web app's address is `FORMS` in the website repo's `scripts/lib/address.js`; after changing the script, use Deploy > Manage deployments > edit > New version so that address stays the same.
- **Domain**: nonfictionhotlist.com is registered through Squarespace until 19 Dec 2027.

## When something goes wrong

- **Email: "skipped-edits" failed.** An edit broke a rule and was skipped; the site kept the previous text. The dashboard lists each one with the reason. Fix it in Drive; the next sync clears it.
- **Email: "drive-error" failed.** A kit couldn't be read at all (sharing changed, Google down). The site still published from what it had. Check the kit folder's sharing.
- **Edits aren't showing up.** Open the publish trigger's Triggers page: `check` should show a recent Last run. If it says "–", delete the trigger and run `install` again. The Actions tab of each repo shows every run.
- **GitHub stops the 15-minute schedule** in a repo with no commits for 60 days. The trigger keeps working regardless; to restart the schedule, open the repo's Actions tab and enable the workflow.

## Switching nonfictionhotlist.com from Squarespace

Do these together, in order:

1. **Website repo**: in `src/layout.html` remove the `<meta name="robots" content="noindex">` line; in `scripts/lib/address.js` set `PUBLIC` to `https://nonfictionhotlist.com`. Push and check the preview.
2. **List repo**: in `years.json`, set `website.header` to `https://nonfictionhotlist.com/shared/header.html`. Push.
3. **Visit counting**: add GoatCounter to the website (as on the list pages) so counting starts on day one.
4. **GitHub**: website repo > Settings > Pages > Custom domain: `nonfictionhotlist.com`.
5. **Squarespace DNS** (Domains > nonfictionhotlist.com > DNS): delete the "Squarespace Defaults" group (four A records, `www`, the HTTPS record). Add:
   - A, host `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (four records)
   - CNAME, host `www`: `nonfiction-hotlist.github.io`
   Leave every other record alone: MX (Google mail), `send` and `resend._domainkey` (the submission app's mail), `_domainconnect`, `list`, and the GitHub verification TXT.
6. Wait for GitHub's certificate (Settings > Pages), then tick **Enforce HTTPS**.
7. Remove the `new` CNAME at Squarespace (or keep it a while for anyone with the preview link).
8. Before cancelling, export Squarespace's contacts and any stored form entries (Contacts > Export). Then cancel the Squarespace **website** plan. Keep the **domain**.

Separately, any time: add SPF, DKIM and DMARC records for Google mail (DKIM key from Admin > Apps > Gmail > Authenticate email).
