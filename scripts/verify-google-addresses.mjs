import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT=path.resolve(import.meta.dirname,"..");
const QUEUE_FILE=path.join(ROOT,"work","naver-manual-queue.json");
const RESULT_FILE=path.join(ROOT,"work","google-address-verification.json");
const ENDPOINT="https://places.googleapis.com/v1/places";
const argValue=(name,fallback)=>process.argv.find(value=>value.startsWith(`${name}=`))?.slice(name.length+1)??fallback;
const limit=Math.min(10000,Math.max(1,Number(argValue("--limit","25"))||25));
const delayMs=Math.max(100,Number(argValue("--delay-ms","125"))||125);
const concurrency=Math.min(10,Math.max(1,Number(argValue("--concurrency","8"))||8));
const progressEvery=Math.max(1,Number(argValue("--progress-every","100"))||100);
const dryRun=process.argv.includes("--dry-run");

async function loadEnv(){
  const text=await fs.readFile(path.join(ROOT,".env"),"utf8");
  for(const line of text.split(/\r?\n/)){
    const match=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if(match&&!process.env[match[1]])process.env[match[1]]=match[2].replace(/^['\"]|['\"]$/g,"");
  }
}

async function readJson(file,fallback){
  try{return JSON.parse(await fs.readFile(file,"utf8"));}
  catch(error){if(error.code==="ENOENT")return fallback;throw error;}
}

function unique(values){return [...new Set(values)];}
function addressSignals(value){
  const text=String(value||"").normalize("NFKC").toLowerCase();
  return {
    numbers:unique(text.match(/\d+(?:-\d+)?/g)||[]),
    areas:unique(text.match(/[\p{L}\p{N}]+(?:대로|번길|로|길|특별시|광역시|자치시|시|군|구|읍|면|동|리)/gu)||[])
  };
}

function compareAddress(card,formattedAddress){
  const source=addressSignals(`${card.address} ${card.locationLabel}`);
  const target=addressSignals(formattedAddress);
  const numberMatches=source.numbers.filter(value=>target.numbers.includes(value));
  const areaMatches=source.areas.filter(value=>target.areas.includes(value));
  const score=Math.min(1,(numberMatches.length?0.6:0)+(areaMatches.length?0.25:0)+(areaMatches.length>=2?0.15:0));
  return {accepted:score>=0.85,score:Number(score.toFixed(2)),numberMatches:numberMatches.length,areaMatches:areaMatches.length};
}

async function fetchAddress(placeId,key){
  const response=await fetch(`${ENDPOINT}/${encodeURIComponent(placeId)}?languageCode=ko`,{
    headers:{"X-Goog-Api-Key":key,"X-Goog-FieldMask":"id,formattedAddress"}
  });
  if(response.status===404)return null;
  if(!response.ok)throw new Error(`Google Places ${response.status}: ${(await response.text()).slice(0,300)}`);
  return (await response.json()).formattedAddress||"";
}

await loadEnv();
const key=process.env.GOOGLE_MAPS_API_KEY;
if(!key)throw new Error("GOOGLE_MAPS_API_KEY mangler.");
const queue=await readJson(QUEUE_FILE,[]);
const results=await readJson(RESULT_FILE,{});
const eligible=queue.filter(card=>card.googlePlaceIds?.[0]&&card.address&&["Navn + adresse","Præcis adresse"].includes(card.evidence));
const groups=new Map();
for(const card of eligible){
  const placeId=card.googlePlaceIds[0];
  if(!groups.has(placeId))groups.set(placeId,[]);
  groups.get(placeId).push(card);
}
const pending=[...groups.entries()].filter(([,cards])=>cards.some(card=>!results[card.id]));
console.log(`${eligible.length} adressekort fordelt på ${groups.size} unikke Place IDs.`);
console.log(`${eligible.length-pending.reduce((sum,[,cards])=>sum+cards.filter(card=>!results[card.id]).length,0)} kort er allerede adressekontrolleret; ${pending.length} Place IDs mangler.`);
console.log(`Næste batch: ${Math.min(limit,pending.length)} Places Details Essentials-opslag.`);
if(dryRun)process.exit(0);
const batch=pending.slice(0,limit);
let processed=0;
for(let offset=0;offset<batch.length;offset+=concurrency){
  const chunk=batch.slice(offset,offset+concurrency);
  const fetched=await Promise.all(chunk.map(async([placeId,cards],index)=>{
    if(index)await new Promise(resolve=>setTimeout(resolve,index*delayMs));
    return {placeId,cards,address:await fetchAddress(placeId,key)};
  }));
  for(const {placeId,cards,address} of fetched){
    for(const card of cards){
      const comparison=address?compareAddress(card,address):{accepted:false,score:0,numberMatches:0,areaMatches:0};
      results[card.id]={checked:new Date().toISOString(),placeId,...comparison};
    }
    processed++;
    if(processed===1||processed%progressEvery===0||processed===batch.length){
      const accepted=cards.filter(card=>results[card.id].accepted).length;
      console.log(`${processed}/${batch.length} ${accepted}/${cards.length} stærke adresse-match`);
    }
  }
  await fs.writeFile(RESULT_FILE,JSON.stringify(results,null,2)+"\n");
}
const accepted=Object.values(results).filter(result=>result.accepted).length;
console.log(`${Object.keys(results).length} adressekort kontrolleret; ${accepted} har et stærkt Google-adressematch.`);
