const data = window.KOREA_SWIPE_DATA || [];
const state = JSON.parse(localStorage.getItem("koreaSpotSwipe.v1") || '{"choices":{},"history":[]}');
const $ = (id) => document.getElementById(id);
const els = {
  remaining:$("remaining"), yes:$("yesCount"), maybe:$("maybeCount"), no:$("noCount"), city:$("city"),
  title:$("title"), korean:$("koreanName"), caption:$("caption"), category:$("category"), creator:$("creator"),
  source:$("sourceLink"), signal:$("signal"), kind:$("kindBadge"), position:$("position"), location:$("location"),
  evidence:$("evidence"), sourceCount:$("sourceCount"), naver:$("naverLink"), google:$("googleLink"),
  sourceDetails:$("sourceDetails"), sourceLinks:$("sourceLinks")
};
let queue=[];
let index=0;

// Bevar gamle swipevalg: et samlet sted arver det stærkeste valg fra sine TikTok-kilder.
for(const card of data){
  if(state.choices[card.id]) continue;
  const old=(card.memberIds||[]).map(id=>state.choices[id]).filter(Boolean);
  if(old.includes("yes")) state.choices[card.id]="yes";
  else if(old.includes("maybe")) state.choices[card.id]="maybe";
  else if(old.includes("no")) state.choices[card.id]="no";
}

function save(){localStorage.setItem("koreaSpotSwipe.v1",JSON.stringify(state));}
function filters(){return {region:$("cityFilter").value,category:$("categoryFilter").value,kind:$("kindFilter").value,q:$("search").value.trim().toLowerCase()};}
function rebuild(){
  const f=filters();
  const categoryPriority={"Vandring & natur":8,"Shopping & markeder":8,"Events & pop-ups":8,"Mad & restauranter":7,"Kultur & historie":6,"Oplevelser & seværdigheder":6,"Caféer & bagerier":4,"Overnatning":2};
  const evidencePriority={"Navn + adresse":5,"Præcis adresse":4,"Navngivet sted":3,"Navngivet listepunkt":2,"Specifikt søgbart navn":1,"Kurateret og verificeret":6};
  queue=data.filter(x=>(!f.region||x.region===f.region)&&(!f.category||x.category===f.category)&&(!f.kind||x.kind===f.kind)&&(!f.q||`${x.title} ${x.locationLabel||""} ${x.caption} ${(x.hashtags||[]).join(" ")}`.toLowerCase().includes(f.q)))
    .sort((a,b)=>((categoryPriority[b.category]||0)*100+(evidencePriority[b.evidence]||0)*10+(b.sourceCount||0))-((categoryPriority[a.category]||0)*100+(evidencePriority[a.evidence]||0)*10+(a.sourceCount||0)));
  index=Math.min(index,Math.max(0,queue.length-1));
  render();
}
function current(){return queue[index];}
function render(){
  const x=current();
  const activeChoices=data.map(card=>state.choices[card.id]).filter(Boolean);
  const counts=activeChoices.reduce((a,v)=>(a[v]=(a[v]||0)+1,a),{});
  els.yes.textContent=counts.yes||0; els.maybe.textContent=counts.maybe||0; els.no.textContent=counts.no||0;
  els.remaining.textContent=queue.filter(card=>!state.choices[card.id]).length;
  els.position.textContent=queue.length?`${index+1} / ${queue.length}`:"0 / 0";
  if(!x){els.title.textContent="Ingen kort matcher filtrene";els.caption.textContent="Prøv at nulstille et filter.";return;}
  els.city.textContent=`${x.region} · ${x.city}`;
  els.title.textContent=x.title;
  els.korean.textContent=x.koreanName||"";
  els.caption.textContent=x.caption;
  els.location.textContent=x.locationLabel?`📍 ${x.locationLabel}`:"";
  els.category.textContent=x.category;
  els.creator.textContent=x.creator;
  els.evidence.textContent=x.evidence||"";
  els.sourceCount.textContent=x.kind==="tiktok"?`${x.sourceCount||1} TikTok-kilde${(x.sourceCount||1)===1?"":"r"}`:"Kurateret";
  els.signal.textContent=x.signal;
  els.kind.textContent=x.kind==="curated"?"KURATERET":"LOKALISERET";
  const q=encodeURIComponent(x.mapQuery||x.locationLabel||x.title);
  els.naver.href=`https://map.naver.com/p/search/${q}`;
  els.google.href=`https://www.google.com/maps/search/?api=1&query=${q}`;
  els.source.hidden=!x.url;
  els.source.href=x.url;
  els.source.textContent=x.sourceCount>1?`Åbn første af ${x.sourceCount} TikToks ↗`:"Åbn TikTok ↗";
  const sourceUrls=x.urls||[];
  els.sourceDetails.hidden=!sourceUrls.length;
  els.sourceLinks.innerHTML=sourceUrls.map((url,i)=>`<a href="${url}" target="_blank" rel="noopener">Mention ${i+1}</a>`).join("");
}
function choose(choice){const x=current();if(!x)return;state.history.push({id:x.id,previous:state.choices[x.id]||null});state.choices[x.id]=choice;save();if(index<queue.length-1)index++;else rebuild();render();}
function undo(){const h=state.history.pop();if(!h)return;if(h.previous)state.choices[h.id]=h.previous;else delete state.choices[h.id];const i=queue.findIndex(x=>x.id===h.id);if(i>=0)index=i;save();render();}
function exportChoices(){
  const selected=data.filter(x=>state.choices[x.id]).map(x=>({...x,choice:state.choices[x.id]}));
  const cols=["choice","kind","id","title","koreanName","region","city","category","locationLabel","address","evidence","sourceCount","mapQuery","url","caption"];
  const esc=v=>`"${String(v??"").replaceAll('"','""')}"`;
  const csv=[cols.join(","),...selected.map(r=>cols.map(c=>esc(r[c])).join(","))].join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="korea-swipe-valg.csv";a.click();URL.revokeObjectURL(a.href);
}

const regions=[...new Set(data.map(x=>x.region))].sort();
const categories=[...new Set(data.map(x=>x.category))].sort();
for(const v of regions)$("cityFilter").add(new Option(v,v));
for(const v of categories)$("categoryFilter").add(new Option(v,v));
document.querySelectorAll("[data-choice]").forEach(b=>b.addEventListener("click",()=>choose(b.dataset.choice)));
$("undoBtn").addEventListener("click",undo);
$("skipBtn").addEventListener("click",()=>{if(queue.length){index=(index+1)%queue.length;render();}});
$("exportBtn").addEventListener("click",exportChoices);
["cityFilter","categoryFilter","kindFilter"].forEach(id=>$(id).addEventListener("change",()=>{index=0;rebuild();}));
$("search").addEventListener("input",()=>{index=0;rebuild();});
addEventListener("keydown",e=>{if(e.target.matches("input,select"))return;if(e.key==="ArrowLeft")choose("no");if(e.key==="ArrowUp")choose("maybe");if(e.key==="ArrowRight")choose("yes");if(e.key.toLowerCase()==="z")undo();});
save();
rebuild();
