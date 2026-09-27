import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT=path.resolve(import.meta.dirname,"..");
const CHUNKS=path.join(ROOT,"discovery","chunks");
const CACHE_FILE=path.join(ROOT,"work","google-places-cache.json");
const OUTPUT_FILE=path.join(ROOT,"discovery","google-place-verifications.js");
const ENDPOINT="https://places.googleapis.com/v1/places:searchText";
const args=new Set(process.argv.slice(2));
const dryRun=args.has("--dry-run");
const argValue=(name,fallback)=>{
  const exact=process.argv.find(value=>value.startsWith(`${name}=`));
  return exact?exact.slice(name.length+1):fallback;
};
const limit=Math.min(100,Math.max(1,Number(argValue("--limit","25"))||25));
const delayMs=Math.max(100,Number(argValue("--delay-ms","250"))||250);

async function loadEnv(){
  try{
    const text=await fs.readFile(path.join(ROOT,".env"),"utf8");
    for(const line of text.split(/\r?\n/)){
      const match=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if(match&&!process.env[match[1]]) process.env[match[1]]=match[2].replace(/^['\"]|['\"]$/g,"");
    }
  }catch(error){if(error.code!=="ENOENT")throw error;}
}

async function readJson(file,fallback){
  try{return JSON.parse(await fs.readFile(file,"utf8"));}
  catch(error){if(error.code==="ENOENT")return fallback;throw error;}
}

async function loadCards(){
  const files=(await fs.readdir(CHUNKS)).filter(name=>/^data-\d+\.js$/.test(name)).sort();
  const cards=[];
  for(const file of files){
    const text=await fs.readFile(path.join(CHUNKS,file),"utf8");
    const match=text.match(/push\(\.\.\.(\[[\s\S]*\])\);?\s*$/);
    if(!match)throw new Error(`Kunne ikke læse ${file}`);
    cards.push(...JSON.parse(match[1]));
  }
  return cards.filter(card=>card.kind==="tiktok");
}

function tokens(value){
  return [...new Set(String(value||"").toLowerCase().match(/[\p{L}\p{N}]{2,}/gu)||[])];
}

function matchScore(card,place){
  const source=tokens(`${card.title} ${card.koreanName} ${card.locationLabel} ${card.address}`);
  const target=new Set(tokens(`${place.displayName?.text} ${place.formattedAddress}`));
  const useful=source.filter(token=>token!=="south"&&token!=="korea");
  const overlap=useful.filter(token=>target.has(token));
  const addressNumbers=tokens(card.address).filter(token=>/^\d/.test(token));
  const numberMatches=addressNumbers.filter(token=>target.has(token)).length;
  const name=String(place.displayName?.text||"").toLowerCase();
  const exactName=[card.title,card.koreanName].some(value=>value&&String(value).toLowerCase().includes(name)&&name.length>=3);
  return Math.min(1,(exactName?0.55:0)+(overlap.length/Math.max(3,Math.min(useful.length,8)))*0.45+(numberMatches?0.2:0));
}

function isKoreanAddress(place){
  return /korea|south korea|대한민국|한국/i.test(place.formattedAddress||"");
}

async function searchPlace(card,key){
  const response=await fetch(ENDPOINT,{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "X-Goog-Api-Key":key,
      "X-Goog-FieldMask":"places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.businessStatus"
    },
    body:JSON.stringify({textQuery:card.mapQuery||card.locationLabel||card.title,languageCode:"ko",regionCode:"KR",pageSize:3})
  });
  if(!response.ok)throw new Error(`Google Places ${response.status}: ${(await response.text()).slice(0,300)}`);
  const places=(await response.json()).places||[];
  const ranked=places.map(place=>({...place,score:matchScore(card,place)})).sort((a,b)=>b.score-a.score);
  const best=ranked[0];
  const accepted=Boolean(best&&isKoreanAddress(best)&&best.businessStatus!=="CLOSED_PERMANENTLY"&&best.score>=0.72);
  // Google Places-indhold må ikke gemmes permanent. Bevar kun vores egen
  // afgørelse samt Place ID, som er undtaget fra cachingbegrænsningen.
  return {
    checked:new Date().toISOString(),
    accepted,
    placeId:accepted?best.id:null,
    score:best?Number(best.score.toFixed(2)):0
  };
}

function priority(card){
  const categories={"Vandring & natur":8,"Shopping & markeder":8,"Events & pop-ups":8,"Mad & restauranter":7,"Kultur & historie":6,"Oplevelser & seværdigheder":6,"Caféer & bagerier":4,"Overnatning":2};
  const evidence={"Navn + adresse":5,"Præcis adresse":4,"Navngivet sted":3,"Navngivet listepunkt":2,"Specifikt søgbart navn":1};
  return (categories[card.category]||0)*100+(evidence[card.evidence]||0)*10+(card.sourceCount||0);
}

function publicResults(cache){
  const result={};
  for(const [id,item] of Object.entries(cache)){
    if(!item.accepted||!item.placeId)continue;
    result[id]={
      checked:item.checked.slice(0,10),
      placeId:item.placeId,
      score:item.score,
      source:`https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(item.placeId)}`
    };
  }
  return result;
}

await loadEnv();
const cards=await loadCards();
const cache=await readJson(CACHE_FILE,{});
const pending=cards.filter(card=>!cache[card.id]).sort((a,b)=>priority(b)-priority(a));
console.log(`${cards.length} TikTok-stedkort, ${Object.keys(cache).length} allerede kontrolleret, ${pending.length} mangler.`);
console.log(`Næste batch: ${Math.min(limit,pending.length)}. Maksimum pr. kørsel er 100.`);
if(dryRun)process.exit(0);
const key=process.env.GOOGLE_MAPS_API_KEY;
if(!key)throw new Error("GOOGLE_MAPS_API_KEY mangler. Kopiér .env.example til .env og indsæt en ny, begrænset nøgle.");
await fs.mkdir(path.dirname(CACHE_FILE),{recursive:true});
for(const [index,card] of pending.slice(0,limit).entries()){
  cache[card.id]=await searchPlace(card,key);
  await fs.writeFile(CACHE_FILE,JSON.stringify(cache,null,2)+"\n");
  console.log(`${index+1}/${Math.min(limit,pending.length)} ${cache[card.id].accepted?"MATCH":"AFVENTER"} ${card.title}`);
  if(index<Math.min(limit,pending.length)-1)await new Promise(resolve=>setTimeout(resolve,delayMs));
}
const output=`// Genereret ${new Date().toISOString()} af scripts/verify-google-places.mjs.\nwindow.KOREA_GOOGLE_PLACE_VERIFICATIONS=${JSON.stringify(publicResults(cache),null,2)};\n`;
await fs.writeFile(OUTPUT_FILE,output);
console.log(`Gemte ${Object.keys(publicResults(cache)).length} konservative Google Maps-match i ${path.relative(ROOT,OUTPUT_FILE)}.`);
