import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT=path.resolve(import.meta.dirname,"..");
const CHUNKS=path.join(ROOT,"discovery","chunks");
const CACHE_FILE=path.join(ROOT,"work","google-places-cache.json");
const NAVER_QUEUE_FILE=path.join(ROOT,"work","naver-manual-queue.json");
const ENDPOINT="https://places.googleapis.com/v1/places:searchText";
const args=new Set(process.argv.slice(2));
const dryRun=args.has("--dry-run");
const argValue=(name,fallback)=>{
  const exact=process.argv.find(value=>value.startsWith(`${name}=`));
  return exact?exact.slice(name.length+1):fallback;
};
const limit=Math.min(10000,Math.max(1,Number(argValue("--limit","25"))||25));
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

function queryFor(card){return card.mapQuery||card.locationLabel||card.title;}
function queryKey(card){return queryFor(card).normalize("NFKC").toLowerCase().replace(/\s+/g," ").trim();}

async function searchPlace(card,key){
  const response=await fetch(ENDPOINT,{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "X-Goog-Api-Key":key,
      // ID-only Text Search er den gratis Essentials-variant. Ingen Google-
      // navne, adresser eller andre Places-data hentes eller gemmes.
      "X-Goog-FieldMask":"places.id"
    },
    body:JSON.stringify({textQuery:queryFor(card),languageCode:"ko",regionCode:"KR",pageSize:3})
  });
  if(!response.ok)throw new Error(`Google Places ${response.status}: ${(await response.text()).slice(0,300)}`);
  const places=(await response.json()).places||[];
  return {
    checked:new Date().toISOString(),
    placeIds:places.map(place=>place.id).filter(Boolean)
  };
}

function priority(card){
  const categories={"Vandring & natur":8,"Shopping & markeder":8,"Events & pop-ups":8,"Mad & restauranter":7,"Kultur & historie":6,"Oplevelser & seværdigheder":6,"Caféer & bagerier":4,"Overnatning":2};
  const evidence={"Navn + adresse":5,"Præcis adresse":4,"Navngivet sted":3,"Navngivet listepunkt":2,"Specifikt søgbart navn":1};
  return (categories[card.category]||0)*100+(evidence[card.evidence]||0)*10+(card.sourceCount||0);
}

function buildNaverQueue(cards,cache){
  return cards.filter(card=>cache[card.id]).map(card=>({
    id:card.id,
    title:card.title,
    koreanName:card.koreanName,
    city:card.city,
    region:card.region,
    category:card.category,
    locationLabel:card.locationLabel,
    address:card.address,
    mapQuery:queryFor(card),
    evidence:card.evidence,
    sourceCount:card.sourceCount,
    googlePlaceIds:cache[card.id].placeIds,
    googleFound:Boolean(cache[card.id].placeIds?.length),
    googleChecked:cache[card.id].checked.slice(0,10),
    googleUrl:cache[card.id].placeIds?.[0]?`https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(cache[card.id].placeIds[0])}`:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryFor(card))}`,
    naverUrl:`https://map.naver.com/p/search/${encodeURIComponent(queryFor(card))}`,
    tiktokUrls:card.urls||[]
  })).sort((a,b)=>Number(b.googleFound)-Number(a.googleFound)||priority(b)-priority(a));
}

await loadEnv();
const cards=await loadCards();
const cache=await readJson(CACHE_FILE,{});
const groups=new Map();
for(const card of cards){
  const key=queryKey(card);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(card);
}
for(const group of groups.values()){
  const existing=group.find(card=>cache[card.id]);
  if(existing)for(const card of group)if(!cache[card.id])cache[card.id]=cache[existing.id];
}
const pendingGroups=[...groups.values()].filter(group=>!group.some(card=>cache[card.id])).sort((a,b)=>priority(b[0])-priority(a[0]));
const evidenceCounts=Object.fromEntries([...new Set(cards.map(card=>card.evidence))].sort().map(evidence=>[evidence,cards.filter(card=>card.evidence===evidence).length]));
console.log(`${cards.length} TikTok-stedkort fordelt på ${groups.size} unikke Google-søgninger.`);
console.log(`${Object.keys(cache).length} kort er allerede Google-kontrolleret; ${pendingGroups.length} unikke søgninger mangler.`);
console.log(`Evidens: ${JSON.stringify(evidenceCounts)}`);
console.log(`Næste batch: ${Math.min(limit,pendingGroups.length)} gratis ID-opslag. Maksimum pr. kørsel er 10.000.`);
if(dryRun)process.exit(0);
const key=process.env.GOOGLE_MAPS_API_KEY;
if(!key)throw new Error("GOOGLE_MAPS_API_KEY mangler. Kopiér .env.example til .env og indsæt en ny, begrænset nøgle.");
await fs.mkdir(path.dirname(CACHE_FILE),{recursive:true});
const batch=pendingGroups.slice(0,limit);
for(const [index,group] of batch.entries()){
  const card=group[0];
  const result=await searchPlace(card,key);
  for(const member of group)cache[member.id]=result;
  await fs.writeFile(CACHE_FILE,JSON.stringify(cache,null,2)+"\n");
  console.log(`${index+1}/${batch.length} ${result.placeIds.length?"GOOGLE-HIT":"INTET GOOGLE-HIT"} ${card.title}${group.length>1?` (+${group.length-1} dubletter)`:""}`);
  if(index<batch.length-1)await new Promise(resolve=>setTimeout(resolve,delayMs));
}
const queue=buildNaverQueue(cards,cache);
await fs.writeFile(NAVER_QUEUE_FILE,JSON.stringify(queue,null,2)+"\n");
console.log(`Gemte ${queue.length} Google-kontrollerede kort i ${path.relative(ROOT,NAVER_QUEUE_FILE)} til manuel Naver-gennemgang.`);
