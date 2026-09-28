import fs from "node:fs/promises";
import path from "node:path";

const ROOT=path.resolve(import.meta.dirname,"..");
const decisions=JSON.parse(await fs.readFile(path.join(ROOT,"data","location-review-decisions.json"),"utf8"));
const queue=JSON.parse(await fs.readFile(path.join(ROOT,"work","naver-manual-queue.json"),"utf8"));
let googleAddress={};
try{googleAddress=JSON.parse(await fs.readFile(path.join(ROOT,"work","google-address-verification.json"),"utf8"));}catch(error){if(error.code!=="ENOENT")throw error;}
const verified={};
const isTimeSensitive=card=>/(\ud31d\uc5c5|popup|pop-up|\ucd95\uc81c|festival|\uc804\uc2dc|exhibition|\uc774\ubca4\ud2b8|event|\ucf5c\ub77c\ubcf4)/i.test(card.caption||"");
for(const card of queue){
  const match=googleAddress[card.id];
  if(!match?.accepted||isTimeSensitive(card))continue;
  verified[card.id]={
    checked:match.checked.slice(0,10),
    placeId:match.placeId,
    score:match.score,
    method:"google_address",
    source:`https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(match.placeId)}`
  };
}
for(const [id,item] of Object.entries(decisions.verified||{})){
  if(!item.naverUrl)throw new Error(`${id}: verified kræver naverUrl`);
  verified[id]={
    checked:item.checked||new Date().toISOString().slice(0,10),
    placeId:item.placeId||null,
    score:1,
    method:"naver_manual",
    source:item.googleUrl||(item.placeId?`https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(item.placeId)}`:null),
    naverSource:item.naverUrl,
    title:item.title||null,
    address:item.address||null
  };
}
const rejected=Object.keys(decisions.rejected||{});
for(const id of rejected)delete verified[id];
const js=`// Genereret af scripts/apply-location-decisions.mjs.\nwindow.KOREA_GOOGLE_PLACE_VERIFICATIONS=${JSON.stringify(verified,null,2)};\nwindow.KOREA_REMOVED_LOCATION_IDS=${JSON.stringify(rejected,null,2)};\n`;
await fs.writeFile(path.join(ROOT,"discovery","google-place-verifications.js"),js);
await fs.writeFile(path.join(ROOT,"discovery","removed-after-map-review.json"),JSON.stringify(decisions.rejected||{},null,2)+"\n");
const unresolved=queue.filter(card=>!verified[card.id]&&!decisions.rejected?.[card.id]);
await fs.writeFile(path.join(ROOT,"work","naver-manual-unresolved.json"),JSON.stringify(unresolved,null,2)+"\n");
console.log(`${Object.keys(verified).length} kortlokaliserede; ${rejected.length} frasorteret uden lokation; ${unresolved.length} afventer Naver.`);
