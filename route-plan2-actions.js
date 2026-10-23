// İlke Saha - Rut Planı2 çalışma alanı
// v8: günlük sıralama, harita ve Excel aksiyonları aynı sabit panelde tutulur.
(()=>{
 const K='ilkeSahaRoute2DraftsV4', esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 let map=null,line=null,markers=[],mapSeq=0;
 const key=()=>String(document.getElementById('route2Week')?.value||1)+'|'+String(document.getElementById('route2Day')?.value||'Pazartesi');
 const all=()=>{try{return JSON.parse(localStorage.getItem(K)||'{}')||{}}catch(_){return{}}};
 const draft=()=>all()[key()]||null;
 function save(items,meta={}){const a=all();a[key()]={items,optimized:!!meta.optimized,optimizationMode:meta.optimizationMode||null,roadKm:Number(meta.roadKm||0),roadMinutes:Number(meta.roadMinutes||0),updatedAt:new Date().toISOString()};localStorage.setItem(K,JSON.stringify(a));}
 function del(){const a=all();delete a[key()];localStorage.setItem(K,JSON.stringify(a));}
 const nums=()=>typeof window.route2CurrentSourceIds==='function'?window.route2CurrentSourceIds():[...document.querySelectorAll('#route2List .route-stop')].map(r=>Number(r.dataset.route2Source)).filter(Number.isFinite);
 const dealer=n=>typeof window.route2DealerBySource==='function'?window.route2DealerBySource(n):null;
 const srcItems=()=>nums().map(n=>{const d=dealer(n);return d?{source:n,dealerId:d.id}:null}).filter(Boolean);
 const drows=(d=draft())=>d?.items?.map(x=>({source:x.source,dealer:(state.dealers||[]).find(z=>z.id===x.dealerId)||dealer(x.source)})).filter(x=>x.dealer)||[];
 const status=t=>{const e=document.getElementById('route2PublishStatus');if(e)e.textContent=t};
 const vis=id=>(state.visits||[]).some(v=>v.dealerId===id&&String(v.date||'').slice(0,10)===todayStr());
 function renderDraft(){
   const d=draft();if(!d?.items?.length)return false;
   const list=document.getElementById('route2List'),sum=document.getElementById('route2Summary'),rows=drows(d);if(!list||!sum)return false;
   const miss=rows.filter(x=>!isValidDealerCoordinate(x.dealer.lat,x.dealer.lng)).length;
   const road=String(d.optimizationMode||'').startsWith('road');
   sum.innerHTML='<strong>'+(d.optimized?(road?'Karayolu sürüşüne göre optimize edilmiş günlük sıra':'Yedek sıralama kullanıldı'):'Seçili plan yüklendi')+'</strong><div class="muted" style="margin-top:5px">'+rows.length+' bayi'+(miss?' • <span class="badge b-warn">'+miss+' koordinatsız</span>':'')+(d.roadKm?' • '+d.roadKm.toFixed(1)+' km • '+Math.round(d.roadMinutes)+' dk':'')+'</div>';
   list.innerHTML=rows.map((x,i)=>{const z=x.dealer,v=vis(z.id);return '<div class="item route-stop" data-route2-source="'+x.source+'"><div class="num">'+(i+1)+'</div><div class="route-info"><strong>'+esc(z.name)+'</strong><span class="muted">'+esc(z.district||'-')+(z.phone?' • '+esc(z.phone):'')+'</span>'+(z.address?'<span class="muted" style="margin-top:3px">'+esc(z.address)+'</span>':'')+'<div style="margin-top:6px">'+(isValidDealerCoordinate(z.lat,z.lng)?'<span class="badge b-ok">Konum var</span>':'<span class="badge b-warn">Koordinat eksik</span>')+(z.isZCode?' <span class="badge b-zcode">Z KODLU</span>':'')+(v?' <span class="badge b-ok">Ziyaret edildi</span>':'')+'</div></div><div class="toolbar route-actions"><button class="btn btn-ghost" onclick="route2Dealer('+x.source+')">Bayi Aç</button><button class="btn btn-primary" onclick="route2Visit('+x.source+')">Görüşme Notu</button>'+(v?'<button class="btn btn-ghost" onclick="undoRoute2Visited(\''+z.id+'\')">Ziyareti Geri Al</button>':'<button class="btn btn-ghost" onclick="markRoute2Visited(\''+z.id+'\')">Ziyaret Edildi</button>')+'<button class="btn btn-accent" onclick="route2Directions('+x.source+')">Yol Tarifi</button></div></div>'}).join('');
   return true;
 }
 function routeDealers(){const d=draft();return d?.items?.length?drows(d).map(x=>x.dealer):nums().map(dealer).filter(Boolean)}
 function ensureMap(){const e=document.getElementById('route2Map');if(!e||typeof L==='undefined')return;if(!map){const h=isValidDealerCoordinate(state.home?.lat,state.home?.lng),c=h?[+state.home.lat,+state.home.lng]:[41.0082,28.9784];map=L.map('route2Map').setView(c,10);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map)}setTimeout(()=>map?.invalidateSize(),30)}
 async function renderMap(){
   ensureMap();if(!map)return;const seq=++mapSeq;
   markers.forEach(m=>{try{map.removeLayer(m)}catch(_){}});markers=[];if(line){try{map.removeLayer(line)}catch(_){}line=null}
   const ds=routeDealers(),loc=ds.filter(d=>isValidDealerCoordinate(d.lat,d.lng)),h=isValidDealerCoordinate(state.home?.lat,state.home?.lng),home={lat:h?+state.home.lat:41.0082,lng:h?+state.home.lng:28.9784};
   markers.push(L.marker([home.lat,home.lng]).addTo(map).bindPopup('<strong>Ev</strong>'));
   loc.forEach((d,i)=>{const m=L.marker([+d.lat,+d.lng]).addTo(map).bindPopup('<strong>'+(i+1)+'. '+esc(d.name)+'</strong>');try{m.bindTooltip(String(i+1),{permanent:true,direction:'top',offset:[0,-12]})}catch(_){}markers.push(m)});
   const e=document.getElementById('route2MapInfo');
   if(!loc.length){if(e)e.innerHTML='<strong>'+ds.length+' bayi</strong> • konumlu bayi yok';map.setView([home.lat,home.lng],10);return;}
   const bounds=[[home.lat,home.lng],...loc.map(d=>[+d.lat,+d.lng])];
   if(!window.ilkeRoadRouting?.routeGeometry){map.fitBounds(bounds,{padding:[30,30],maxZoom:15});if(e)e.innerHTML='<strong>'+ds.length+' bayi</strong> • '+loc.length+' konumlu<div class="muted" style="margin-top:4px">Yol motoru hazırlanıyor. Düz çizgi gösterilmiyor.</div>';return;}
   if(e)e.innerHTML='<strong>'+ds.length+' bayi</strong> • '+loc.length+' konumlu<div class="muted" style="margin-top:4px">Gerçek sürüş yolu hazırlanıyor…</div>';
   const g=await window.ilkeRoadRouting.routeGeometry([home,...loc.map(d=>({lat:+d.lat,lng:+d.lng})),home]);if(seq!==mapSeq)return;
   if(g?.latlngs?.length){line=L.polyline(g.latlngs,{weight:5,color:'#e30613',opacity:.82,lineJoin:'round'}).addTo(map);try{map.fitBounds(line.getBounds(),{padding:[30,30],maxZoom:15})}catch(_){ }if(e)e.innerHTML='<strong>'+ds.length+' bayi</strong> • '+loc.length+' konumlu'+(ds.length-loc.length?' • <span class="badge b-warn">'+(ds.length-loc.length)+' koordinatsız</span>':'')+'<div class="muted" style="margin-top:4px">✓ Gerçek sürüş yolu • '+Number(g.km||0).toFixed(1)+' km • '+Math.round(Number(g.minutes||0))+' dk</div>';}
   else{map.fitBounds(bounds,{padding:[30,30],maxZoom:15});if(e)e.innerHTML='<strong>'+ds.length+' bayi</strong> • '+loc.length+' konumlu<div class="note" style="margin-top:4px"><span class="badge b-warn">Yol alınamadı</span> Kuş uçuşu çizgi göstermiyoruz.</div>';}
 }
 function render(){renderDraft();renderMap();}
 function load(show=true){const ns=nums(),it=srcItems();if(!ns.length){alert('Seçili gün için bayi yok.');return false}if(!it.length){alert('Seçili plandaki bayiler ana bayi listesiyle eşleşmedi.');return false}save(it,{optimized:false});render();status('Seçili plan günlük çalışma alanına yüklendi.');if(show&&it.length!==ns.length)alert('Plan yüklendi. '+it.length+' bayi eşleşti; '+(ns.length-it.length)+' bayi eşleşmedi.');return true}
 async function optimize(){
   let d=draft();if(!d?.items?.length){if(!load(false))return;d=draft()}const rows=drows(d),dealers=rows.map(x=>x.dealer);if(!dealers.length)return;
   if(!window.ilkeRoadRouting?.optimizeDealers){status('Yol motoru henüz hazır değil.');return;}
   status('Karayolu sürüş sırası hesaplanıyor…');
   const home={lat:Number(state.home?.lat||41.0074),lng:Number(state.home?.lng||28.5379)};
   const r=await window.ilkeRoadRouting.optimizeDealers(dealers,home,(a,b)=>status('Yol ağı hesaplanıyor: '+a+' / '+b));
   const sourceById=new Map(rows.map(x=>[x.dealer.id,x.source]));
   save(r.dealers.map(z=>({source:sourceById.get(z.id),dealerId:z.id})).filter(x=>Number.isFinite(x.source)),{optimized:true,optimizationMode:r.mode,roadKm:r.roadKm,roadMinutes:r.roadMinutes});
   render();status(String(r.mode).startsWith('road')?'Rut Planı2 karayolu sürüşüne göre optimize edildi.':'Yol servisi kullanılamadı; yedek sıralama kullanıldı.');
 }
 async function publish(){let d=draft();if(!d?.items?.length){if(!load(false))return;d=draft()}const ids=drows(d).map(x=>x.dealer.id),prev=(state.todayRoute||[]).slice();try{state.todayRoute=ids;const r=publishTodayRoute();if(r?.then)await r;status('Rut Planı2 sırası yöneticiye gönderildi.')}catch(e){alert('Rut yayınlanamadı: '+(e?.message||e))}finally{state.todayRoute=prev;try{localStorage.setItem(storeKey,JSON.stringify(state))}catch(_){}if(typeof renderAll==='function')renderAll();render()}}
 function clear(){if(!draft()?.items?.length){status('Günlük taslak zaten boş.');return}if(!confirm('Rut Planı2 günlük taslağı temizlensin mi? Kaynak plan silinmez.'))return;del();if(typeof renderRoute2==='function')renderRoute2();renderMap();status('Günlük taslak temizlendi.')}
 async function mark(id){if(typeof markRouteVisited==='function')await markRouteVisited(id);render()}
 async function undo(id){if(typeof undoRouteVisited==='function')await undoRouteVisited(id);render()}
 function install(){
   const sec=document.getElementById('route2'),left=sec?.querySelector('.card.span-4');if(!sec||!left)return false;
   if(!document.getElementById('route2ActionPanel')){
     const p=document.createElement('div');p.id='route2ActionPanel';
     p.innerHTML='<button class="btn btn-primary" style="margin-top:12px;width:100%" onclick="openOutOfRouteVisit()">+ Rota Dışı Ziyaret Ekle</button><div class="muted" style="margin-top:6px">Rutunda olmayan yeni bir firmayı ziyaret ettiysen buradan kaydet.</div><hr style="border:0;border-top:1px solid #e2e8f0;margin:16px 0"><button class="btn btn-ghost" style="width:100%" onclick="loadRoute2Today()">Seçili Planı Bugüne Yükle</button><button class="btn btn-accent" style="margin-top:12px;width:100%" onclick="optimizeRoute2()">En Mantıklı Rutu Oluştur</button><div id="route2PublishStatus" class="muted" style="margin-top:12px">Bugünkü rut henüz yöneticiyle paylaşılmadı.</div><button class="btn btn-primary" style="margin-top:8px;width:100%" onclick="publishRoute2()">✓ Bugünkü Rutu Onayla ve Yöneticiye Gönder</button><button class="btn btn-ghost" style="margin-top:8px;width:100%" onclick="clearRoute2Today()">Bugünkü rutu temizle</button><hr style="border:0;border-top:1px solid #e2e8f0;margin:16px 0"><div class="muted"><strong>Excel Çıktıları</strong></div><button id="route2ExcelExportBtn" class="btn btn-primary" style="margin-top:8px;width:100%" onclick="exportLoadedRouteExcel(\'route2\')">Seçili Günü Excel İndir</button><button id="route2FullExcelExportBtn" class="btn btn-accent" style="margin-top:8px;width:100%" onclick="exportFullRoute2Excel()">Komple Rut Planı2’yi Excel İndir</button>';
     left.appendChild(p);
   }
   if(!document.getElementById('route2Map')){const c=document.createElement('div');c.className='card span-12';c.innerHTML='<div id="route2MapInfo" class="muted" style="margin-bottom:10px"></div><div id="route2Map" style="height:420px;border-radius:12px"></div>';sec.querySelector('.grid')?.appendChild(c)}
   render();return true;
 }
 window.renderRoute2Workspace=render;window.loadRoute2Today=load;window.optimizeRoute2=optimize;window.publishRoute2=publish;window.clearRoute2Today=clear;window.markRoute2Visited=mark;window.undoRoute2Visited=undo;let t=setInterval(()=>{if(install())clearInterval(t)},100);
})();