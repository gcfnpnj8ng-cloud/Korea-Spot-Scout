import fs from "node:fs/promises";
import path from "node:path";

const ROOT=path.resolve(import.meta.dirname,"..");
const decisions=JSON.parse(await fs.readFile(path.join(ROOT,"data","location-review-decisions.json"),"utf8"));
const verified={};
for(const [id,item] of Object.entries(decisions.verified||{})){
  if(!item.placeId||!item.naverUrl)throw new Error(`${id}: verified kræver placeId og naverUrl`);
  verified[id]={
    checked:item.checked||new Date().toISOString().slice(0,10),
    placeId:item.placeId,
    score:1,
    source:`https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(item.placeId)}`,
    naverSource:item.naverUrl
  };
}
const rejected=Object.keys(decisions.rejected||{});
const js=`// Genereret af scripts/apply-location-decisions.mjs.\nwindow.KOREA_GOOGLE_PLACE_VERIFICATIONS=${JSON.stringify(verified,null,2)};\nwindow.KOREA_REMOVED_LOCATION_IDS=${JSON.stringify(rejected,null,2)};\n`;
await fs.writeFile(path.join(ROOT,"discovery","google-place-verifications.js"),js);
await fs.writeFile(path.join(ROOT,"discovery","removed-after-map-review.json"),JSON.stringify(decisions.rejected||{},null,2)+"\n");
console.log(`${Object.keys(verified).length} Naver+Google-verificerede; ${rejected.length} frasorteret uden lokation.`);

