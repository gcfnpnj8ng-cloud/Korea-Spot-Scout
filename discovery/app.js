const data = window.KOREA_SWIPE_DATA || [];
const locationVerifications=window.KOREA_LOCATION_VERIFICATIONS||{};
const googlePlaceVerifications=window.KOREA_GOOGLE_PLACE_VERIFICATIONS||{};
const removedLocationIds=new Set(window.KOREA_REMOVED_LOCATION_IDS||[]);
for(const card of data){
  const verification=locationVerifications[card.id];
  const googleVerification=googlePlaceVerifications[card.id];
  card.locationStatus=verification
    ?"verified"
    :googleVerification?.method==="naver_manual"
      ?"naver_verified"
      :googleVerification
        ?"google_checked"
        :removedLocationIds.has(card.id)?"removed":"unverified";
  if(verification){
    card.title=verification.name;
    card.koreanName=verification.koreanName;
    card.locationLabel=verification.locationLabel;
    card.address=verification.locationLabel;
    card.mapQuery=verification.mapQuery;
    if(verification.category) card.category=verification.category;
    if(verification.region) card.region=verification.region;
    if(verification.city) card.city=verification.city;
    card.locationChecked=verification.checked;
    card.locationSources=verification.sources;
  }else if(googleVerification){
    if(googleVerification.title){
      card.title=googleVerification.title;
      card.koreanName=googleVerification.title;
    }
    if(googleVerification.address){
      card.locationLabel=googleVerification.address;
      card.address=googleVerification.address;
      card.mapQuery=`${googleVerification.title||card.title} ${googleVerification.address} South Korea`;
    }
    card.locationChecked=googleVerification.checked;
    card.locationSources=[googleVerification.source,googleVerification.naverSource].filter(Boolean);
    card.googlePlaceId=googleVerification.placeId;
    card.googleMatchScore=googleVerification.score;
  }
}
const $ = (id) => document.getElementById(id);
const els = {
  remaining:$("remaining"), yes:$("yesCount"), maybe:$("maybeCount"), no:$("noCount"), city:$("city"),
  title:$("title"), korean:$("koreanName"), caption:$("caption"), category:$("category"), creator:$("creator"),
  source:$("sourceLink"), signal:$("signal"), kind:$("kindBadge"), position:$("position"), location:$("location"),
  evidence:$("evidence"), sourceCount:$("sourceCount"), naver:$("naverLink"), google:$("googleLink"),
  sourceDetails:$("sourceDetails"), sourceLinks:$("sourceLinks"), thumbnail:$("thumbnail"),
  thumbnailStatus:$("thumbnailStatus"), media:$("media"), locationStatus:$("locationStatus"),
  locationDetails:$("locationDetails"), locationLinks:$("locationLinks")
};
const votes=JSON.parse(localStorage.getItem("kss-votes")||'{"Mikkel":{},"Louise":{}}');
votes.Mikkel=votes.Mikkel||{};
votes.Louise=votes.Louise||{};
let person=localStorage.getItem("kss-person")||"Louise";
let queue=[];
let index=0;
const history=[];
const thumbnailCache=new Map();
let thumbnailRequest=0;
const dataWarning=$("dataWarning");
if(data.length!==window.KOREA_SWIPE_EXPECTED){
  dataWarning.hidden=false;
  dataWarning.textContent=data.length?`Kun ${data.length.toLocaleString("da-DK")} af ${window.KOREA_SWIPE_EXPECTED.toLocaleString("da-DK")} kort blev indlæst. Genindlæs siden for at hente resten.`:"TikTok-kortene kunne ikke indlæses. Genindlæs siden; dine valg er stadig gemt.";
}

// Flyt eventuelle valg fra den tidligere, separate TikTok-bunke ind på den aktive profil.
try{
  const legacy=JSON.parse(localStorage.getItem("koreaSpotSwipe.v1")||'{"choices":{}}');
  const mapping={yes:"LIKE",maybe:"MAYBE",no:"NO"};
  for(const [id,choice] of Object.entries(legacy.choices||{})) if(!votes[person][id]&&mapping[choice]) votes[person][id]=mapping[choice];
}catch(_){/* Ugyldige gamle lokale data ignoreres. */}

// Et samlet sted arver det stærkeste tidligere valg fra sine underliggende TikTok-mentions.
for(const card of data){
  if(votes[person][card.id]) continue;
  const old=(card.memberIds||[]).map(id=>votes[person][id]).filter(Boolean);
  if(old.includes("LIKE")) votes[person][card.id]="LIKE";
  else if(old.includes("MAYBE")) votes[person][card.id]="MAYBE";
  else if(old.includes("NO")) votes[person][card.id]="NO";
}

function save(){localStorage.setItem("kss-votes",JSON.stringify(votes));localStorage.setItem("kss-person",person);}
function isMatch(id){return votes.Mikkel[id]==="LIKE"&&votes.Louise[id]==="LIKE";}
function filters(){return {region:$("cityFilter").value,category:$("categoryFilter").value,location:$("locationFilter").value,kind:$("kindFilter").value,status:$("statusFilter").value,q:$("search").value.trim().toLowerCase()};}
function matchesStatus(card,status){
  if(status==="unreviewed") return !votes[person][card.id];
  if(status==="matches") return isMatch(card.id);
  if(status==="all") return true;
  return votes[person][card.id]===status;
}
function matchesLocation(card,location){
  if(location==="all")return true;
  if(location==="reviewable")return card.locationStatus==="verified"||card.locationStatus==="naver_verified"||card.locationStatus==="google_checked";
  if(location==="usable")return card.locationStatus==="verified"||card.locationStatus==="naver_verified";
  return card.locationStatus===location;
}
function rebuild(){
  const f=filters();
  const categoryPriority={"Vandring & natur":8,"Shopping & markeder":8,"Events & pop-ups":8,"Mad & restauranter":7,"Kultur & historie":6,"Oplevelser & seværdigheder":6,"Caféer & bagerier":4,"Overnatning":2};
  const evidencePriority={"Navn + adresse":5,"Præcis adresse":4,"Navngivet sted":3,"Navngivet listepunkt":2,"Specifikt søgbart navn":1,"Kurateret og verificeret":6};
  queue=data.filter(x=>(!f.region||x.region===f.region)&&(!f.category||x.category===f.category)&&matchesLocation(x,f.location)&&(!f.kind||x.kind===f.kind)&&matchesStatus(x,f.status)&&(!f.q||`${x.title} ${x.locationLabel||""} ${x.caption} ${(x.hashtags||[]).join(" ")}`.toLowerCase().includes(f.q)))
    .sort((a,b)=>((categoryPriority[b.category]||0)*100+(evidencePriority[b.evidence]||0)*10+(b.sourceCount||0))-((categoryPriority[a.category]||0)*100+(evidencePriority[a.evidence]||0)*10+(a.sourceCount||0)));
  index=Math.min(index,Math.max(0,queue.length-1));
  render();
}
function current(){return queue[index];}
async function loadThumbnail(card){
  const request=++thumbnailRequest;
  els.thumbnail.hidden=true;
  els.thumbnail.removeAttribute("src");
  els.thumbnailStatus.hidden=false;
  els.thumbnailStatus.textContent=card.url?"Henter TikTok-billede…":"Intet TikTok-billede";
  if(!card.url)return;
  try{
    let thumbnail=thumbnailCache.get(card.url);
    if(!thumbnail){
      const response=await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(card.url)}`);
      if(!response.ok)throw new Error("TikTok preview unavailable");
      thumbnail=(await response.json()).thumbnail_url;
      if(!thumbnail)throw new Error("No thumbnail");
      thumbnailCache.set(card.url,thumbnail);
    }
    if(request!==thumbnailRequest||current()?.id!==card.id)return;
    els.thumbnail.alt=`TikTok-preview for ${card.title}`;
    els.thumbnail.src=thumbnail;
    els.thumbnail.hidden=false;
    els.thumbnailStatus.hidden=true;
  }catch(_){
    if(request!==thumbnailRequest)return;
    els.thumbnailStatus.textContent="Previewbillede ikke tilgængeligt";
  }
}
function render(){
  const x=current();
  const tikTok=data.filter(card=>card.kind==="tiktok"&&(card.locationStatus==="verified"||card.locationStatus==="naver_verified"||card.locationStatus==="google_checked"));
  const choices=tikTok.map(card=>votes[person][card.id]).filter(Boolean);
  const counts=choices.reduce((a,v)=>(a[v]=(a[v]||0)+1,a),{});
  els.yes.textContent=counts.LIKE||0; els.maybe.textContent=counts.MAYBE||0; els.no.textContent=counts.NO||0;
  els.remaining.textContent=data.length?queue.length:"—";
  els.position.textContent=queue.length?`${index+1} / ${queue.length}`:"0 / 0";
  document.querySelectorAll(".profiles button").forEach(b=>b.classList.toggle("active",b.dataset.person===person));
  if(!x){els.title.textContent="Ingen kort matcher filtrene";els.korean.textContent="";els.caption.textContent="Prøv en anden vurdering, region eller kategori.";els.location.textContent="";els.sourceDetails.hidden=true;els.locationDetails.hidden=true;els.media.hidden=true;return;}
  els.media.hidden=false;
  els.city.textContent=`${x.region} · ${x.city}`;
  els.title.textContent=x.title;
  els.korean.textContent=x.koreanName||"";
  els.caption.textContent=x.caption;
  els.location.textContent=x.locationLabel?`📍 ${x.locationLabel}`:"";
  els.category.textContent=x.category;
  els.creator.textContent=x.creator;
  els.evidence.textContent=x.evidence||"";
  els.sourceCount.textContent=x.kind==="tiktok"?`${x.sourceCount||1} TikTok-kilde${(x.sourceCount||1)===1?"":"r"}`:"Kurateret";
  els.locationStatus.textContent=x.locationStatus==="verified"?`Fuldt verificeret ${x.locationChecked} · TikTok-indhold kan være ældre`:x.locationStatus==="naver_verified"?`Lokation kontrolleret manuelt på Naver ${x.locationChecked}`:x.locationStatus==="google_checked"?`Adresse matchet via Google ${x.locationChecked} · afventer manuel Naver-kontrol`:x.locationStatus==="removed"?"Frasorteret: ingen sikker lokation":"Afventer lokationskontrol";
  els.signal.textContent=isMatch(x.id)?"♥ MATCH":x.signal;
  els.kind.textContent=x.kind==="curated"?"VERIFICERET":x.locationStatus==="verified"?"TIKTOK-VERIFICERET":x.locationStatus==="naver_verified"?"TIKTOK-NAVER-KONTROLLERET":x.locationStatus==="google_checked"?"AFVENTER NAVER":"TIKTOK-LEAD";
  const q=encodeURIComponent(x.mapQuery||x.locationLabel||x.title);
  els.naver.href=`https://map.naver.com/p/search/${q}`;
  els.google.href=`https://www.google.com/maps/search/?api=1&query=${q}`;
  els.source.hidden=!x.url;
  els.source.href=x.url;
  els.source.textContent=x.sourceCount>1?`Åbn første af ${x.sourceCount} TikToks ↗`:"Åbn TikTok ↗";
  const sourceUrls=x.urls||[];
  els.sourceDetails.hidden=!sourceUrls.length;
  els.sourceLinks.innerHTML=sourceUrls.map((url,i)=>`<a href="${url}" target="_blank" rel="noopener">Mention ${i+1}</a>`).join("");
  const locationSources=x.locationSources||[];
  els.locationDetails.hidden=!locationSources.length;
  els.locationLinks.innerHTML=locationSources.map((url,i)=>`<a href="${url}" target="_blank" rel="noopener">Kontrolkilde ${i+1}</a>`).join("");
  loadThumbnail(x);
}

els.thumbnail.addEventListener("error",()=>{els.thumbnail.hidden=true;els.thumbnailStatus.hidden=false;els.thumbnailStatus.textContent="Previewbillede ikke tilgængeligt";});
function choose(choice){
  const x=current();if(!x)return;
  history.push({id:x.id,previous:votes[person][x.id]||null,person});
  votes[person][x.id]=choice;save();
  if($("statusFilter").value==="unreviewed") rebuild(); else {if(index<queue.length-1)index++;render();}
}
function undo(){
  const h=history.pop();if(!h)return;
  if(h.previous)votes[h.person][h.id]=h.previous;else delete votes[h.person][h.id];
  person=h.person;save();rebuild();
}
function exportChoices(){
  const selected=data.filter(x=>votes[person][x.id]).map(x=>({...x,choice:votes[person][x.id],person}));
  const cols=["person","choice","kind","id","title","koreanName","region","city","category","locationLabel","address","evidence","sourceCount","mapQuery","url","caption"];
  const esc=v=>`"${String(v??"").replaceAll('"','""')}"`;
  const csv=[cols.join(","),...selected.map(r=>cols.map(c=>esc(r[c])).join(","))].join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`korea-swipe-${person.toLowerCase()}.csv`;a.click();URL.revokeObjectURL(a.href);
}

for(const v of [...new Set(data.map(x=>x.region))].sort()) $("cityFilter").add(new Option(v,v));
for(const v of [...new Set(data.map(x=>x.category))].sort()) $("categoryFilter").add(new Option(v,v));
document.querySelectorAll("[data-choice]").forEach(b=>b.addEventListener("click",()=>choose({yes:"LIKE",maybe:"MAYBE",no:"NO"}[b.dataset.choice])));
document.querySelectorAll(".profiles button").forEach(b=>b.addEventListener("click",()=>{person=b.dataset.person;index=0;save();rebuild();}));
$("undoBtn").addEventListener("click",undo);
$("skipBtn").addEventListener("click",()=>{if(queue.length){index=(index+1)%queue.length;render();}});
$("exportBtn").addEventListener("click",exportChoices);
["cityFilter","categoryFilter","locationFilter","kindFilter","statusFilter"].forEach(id=>$(id).addEventListener("change",()=>{index=0;rebuild();}));
$("search").addEventListener("input",()=>{index=0;rebuild();});
addEventListener("keydown",e=>{if(e.target.matches("input,select"))return;if(e.key==="ArrowLeft")choose("NO");if(e.key==="ArrowUp")choose("MAYBE");if(e.key==="ArrowRight")choose("LIKE");if(e.key.toLowerCase()==="z")undo();});
save();
rebuild();
