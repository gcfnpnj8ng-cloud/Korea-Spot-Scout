import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const [id, verdict, sourceOrReason, note = "", title = "", address = ""] = process.argv.slice(2);

if (!id || !["verified", "rejected"].includes(verdict) || !sourceOrReason) {
  console.error(
    "Brug: node scripts/record-location-decision.mjs <kort-id> <verified|rejected> <naver-url|årsag> [note] [korrekt titel] [korrekt adresse]",
  );
  process.exit(1);
}

const decisionsPath = path.join(ROOT, "data", "location-review-decisions.json");
const queuePath = path.join(ROOT, "work", "naver-manual-queue.json");
const decisions = JSON.parse(await fs.readFile(decisionsPath, "utf8"));
const queue = JSON.parse(await fs.readFile(queuePath, "utf8"));
const card = queue.find((item) => item.id === id);

if (!card) {
  throw new Error(`${id}: kortet findes ikke i Naver-køen`);
}

decisions.verified ||= {};
decisions.rejected ||= {};
delete decisions.verified[id];
delete decisions.rejected[id];

if (verdict === "verified") {
  if (!/^https:\/\/(map\.)?naver\.com\//i.test(sourceOrReason)) {
    throw new Error(`${id}: verificering kræver et Naver Map-link`);
  }
  decisions.verified[id] = {
    checked: new Date().toISOString().slice(0, 10),
    naverUrl: sourceOrReason,
    note,
    ...(title ? { title } : {}),
    ...(address ? { address } : {}),
  };
} else {
  decisions.rejected[id] = {
    checked: new Date().toISOString().slice(0, 10),
    reason: sourceOrReason,
    note,
    googleUrl: card.googleUrl,
    naverUrl: card.naverUrl,
  };
}

await fs.writeFile(decisionsPath, `${JSON.stringify(decisions, null, 2)}\n`);
console.log(`${id}: ${verdict === "verified" ? "Naver-verificeret" : "frasorteret"}`);
