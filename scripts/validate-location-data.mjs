import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(import.meta.dirname, "..");
const decisions = JSON.parse(
  await fs.readFile(path.join(ROOT, "data", "location-review-decisions.json"), "utf8"),
);
const generatedSource = await fs.readFile(
  path.join(ROOT, "discovery", "google-place-verifications.js"),
  "utf8",
);
const removed = JSON.parse(
  await fs.readFile(path.join(ROOT, "discovery", "removed-after-map-review.json"), "utf8"),
);

if (/AIza[0-9A-Za-z_-]{20,}/.test(generatedSource)) {
  throw new Error("En Google API-nøgle er kommet med i den genererede fil");
}

const context = { window: {} };
vm.runInNewContext(generatedSource, context);
const generated = context.window.KOREA_GOOGLE_PLACE_VERIFICATIONS;
if (!generated || typeof generated !== "object") {
  throw new Error("Den genererede verifikationsfil kan ikke indlæses");
}

for (const id of Object.keys(decisions.rejected || {})) {
  if (decisions.verified?.[id]) throw new Error(`${id} er både godkendt og afvist`);
  if (generated[id]) throw new Error(`${id} er både lokaliseret og frasorteret`);
  if (!removed[id]) throw new Error(`${id} mangler i removed-after-map-review.json`);
}

for (const [id, item] of Object.entries(decisions.verified || {})) {
  if (!/^https:\/\/(map\.)?naver\.com\//i.test(item.naverUrl || "")) {
    throw new Error(`${id} mangler et gyldigt Naver Map-link`);
  }
  if (generated[id]?.method !== "naver_manual") {
    throw new Error(`${id} mangler som manuel Naver-verifikation`);
  }
}

console.log(
  `OK: ${Object.keys(generated).length} lokaliserede, ${Object.keys(decisions.verified || {}).length} manuelt Naver-kontrollerede og ${Object.keys(removed).length} frasorterede.`,
);
