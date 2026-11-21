// Project editor passwords. Each project's password comes from a secret (EDITOR_SECRET, a GitHub secret
// and a Secrets file in each kit's Apps Script), the year and the project's web address, so nothing has
// to be stored and the kit and the dashboard always agree. The kit has the same function (passwordFor_).
const crypto = require("crypto");
const { EDIT } = require("../content/spec");

function passwordFor(secret, year, slug) {
  const b = crypto.createHmac("sha256", secret).update(`${year}:${slug}`).digest();
  const W = EDIT.words;
  return `${W[b[0] % W.length]}-${W[b[1] % W.length]}-${10 + (b[2] % 90)}`;
}

module.exports = { passwordFor };
