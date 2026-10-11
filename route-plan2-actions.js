// İlke Saha - Rut Planı2 çalışma alanı
// v5: yol ağı / sürüş süresi bazlı optimizasyon (OSRM), kuş uçuşu yalnızca yedek.
(()=>{
 const K='ilkeSahaRoute2DraftsV4', OSRM='https://router.project-osrm.org', esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 let map=null,line=null,markers=[];
 const key=()=>String(route2Week?.value||1)+'|'+String(route2Day?.value||'Pazartesi');
 const all=()=>{try{return JSON.parse(localStorage.getItem(K)||'{}')||{}}catch(_){return{}}};
 const draft=()=>all()[key()]||null;
 function save(items,opt=false,extra={}){const a=all();a[key()]={items,optimized:opt,updatedAt:new Date().toISOString(),...extra};localStorage.setItem(K,JSON.stringify(a))}
 function del(){const a=all();delete a[key()];localStorage.setItem(K,JSON.stringify(a))}
 const nums=()=>typeof route2CurrentSourceIds==='function'?route2CurrentSourceIds():[...document.querySelectorAll('#route2List .route-stop')].map(r=>Number(r.dataset.route2Source)).filter(Number.isFinite);
 const dealer=n=>typeof route2DealerBySource==='function'?route2DealerBySource(n):null;
 const srcItems=()=>nums().map(n=>{const d=dealer(n);return d?{source:n,dealerId:d.id}:null}).filter(Boolean);
 const drows=(d=draft())=>d?.items?.map(x=>({source:x.source,dealer:(state.dealers||[]).find(z=>z.id===x.dealerId)||dealer(x.source)})).filter(x=>x.dealer)||[];
 const status=t=>{const e=document.getElementById('route2PublishStatus');if(e)e.textContent=t};
 const vis=id=>(state.visits||[]).some(v=>v.dealerId===id&&String(v.date||'').slice(0,10)===todayStr());
 const coord=d=>`${Number(d.lng)},${Number(d.lat)}`;
 const finite=v=>Number.isFinite(Number(v));

 function renderDraft(){
   const d=draft();if(!d?.items?.length)return false;
   const list=document.getElementById('route2List'),sum=document.getElementById('route2Summary'),rows=drows(d);if(!list||!sum)return false;
   const loc=rows.map(x=>x.dealer).filter(x=>isValidDealerCoordinate(x.lat,x.lng)),miss=rows.length-loc.length;
   const roadKm=finite(d.roadDistanceMeters)?Number(d.roadDistanceMeters)/1000:null;
   const roadMin=finite(d.roadDurationSeconds)?Math.round(Number(d.roadDurationSeconds)/60):null;
   const km=roadKm??(typeof routeDistance==='function'&&loc.length?routeDistance(loc):0);
   const mode=d.optimized?(d.optimizationMode==='road'?'Yol bazlı optimize edilmiş sıra':'Optimize edilmiş günlük sıra'):'Yüklenen Excel sırası';
   sum.innerHTML='<strong>'+mode+'</strong><div class="muted" style="margin-top:5px">'+rows.length+' bayi'+(miss?' • <span class="badge b-warn">'+miss+' koordinatsız</span>':'')+(km?' • '+km.toFixed(1)+' km':'')+(roadMin?' • yaklaşık '+roadMin+' dk sürüş':'')+'</div>'+(d.optimizationMode==='road'?'<div class="muted" style="margin-top:5px">Sıralama kuş uçuşuna göre değil, yol ağı üzerindeki tahmini sürüş sürelerine göre yapıldı.</div>':'');
   list.innerHTML=rows.map((x,i)=>{const z=x.dealer,v=vis(z.id);return '<div class="item route-stop" data-route2-source="'+x.source+'"><div class="num">'+(i+1)+'</div><div class="route-info"><strong>'+esc(z.name)+'</strong><span class="muted">'+esc(z.district||'-')+(z.phone?' • '+esc(z.phone):'')+'</span>'+(z.address?'<span class="muted" style="margin-top:3px">'+esc(z.address)+'</span>':'')+'<div style="margin-top:6px">'+(isValidDealerCoordinate(z.lat,z.lng)?'<span class="badge b-ok">Konum var</span>':'<span class="badge b-warn">Koordinat eksik</span>')+(z.isZCode?' <span class="badge b-zcode">Z KODLU</span>':'')+(v?' <span class="badge b-ok">Ziyaret edildi</span>':'')+'</div></div><div class="toolbar route-actions"><button class="btn btn-ghost" onclick="route2Dealer('+x.source+')">Bayi Aç</button><button class="btn btn-primary" onclick="route2Visit('+x.source+')">Görüşme Notu</button>'+(v?'<button class="btn btn-ghost" onclick="undoRoute2Visited(\''+z.id+'\')">Ziyareti Geri Al</button>':'<button class="btn btn-ghost" onclick="markRoute2Visited(\''+z.id+'\')">Ziyaret Edildi</button>')+'<button class="btn btn-accent" onclick="route2Directions('+x.source+')">Yol Tarifi</button></div></div>'}).join('');
   return true;
 }
 function routeDealers(){const d=draft();return d?.items?.length?drows(d).map(x=>x.dealer):nums().map(dealer).filter(Boolean)}
 function ensureMap(){const e=document.getElementById('route2Map');if(!e||typeof L==='undefined')return;if(!map){const h=isValidDealerCoordinate(state.home?.lat,state.home?.lng),c=h?[+state.home.lat,+state.home.lng]:[41.0082,28.9784];map=L.map('route2Map').setView(c,10);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map)}setTimeout(()=>map?.invalidateSize(),30)}
 function renderMap(){
   ensureMap();if(!map)return;markers.forEach(m=>{try{map.removeLayer(m)}catch(_){}});markers=[];if(line){try{map.removeLayer(line)}catch(_){}line=null}
   const d=draft(),ds=routeDealers(),loc=ds.filter(x=>isValidDealerCoordinate(x.lat,x.lng)),pts=[],h=isValidDealerCoordinate(state.home?.lat,state.home?.lng);
   if(h){const p=[+state.home.lat,+state.home.lng];markers.push(L.marker(p).addTo(map).bindPopup('<strong>Ev</strong>'));pts.push(p)}
   loc.forEach((z,i)=>{const p=[+z.lat,+z.lng],m=L.marker(p).addTo(map).bindPopup('<strong>'+(i+1)+'. '+esc(z.name)+'</strong>');try{m.bindTooltip(String(i+1),{permanent:true,direction:'top',offset:[0,-12]})}catch(_){}markers.push(m);pts.push(p)});
   if(d?.optimizationMode==='road'&&Array.isArray(d.roadGeometry)&&d.roadGeometry.length>1){
     const roadPts=d.roadGeometry.map(p=>[Number(p[1]),Number(p[0])]).filter(p=>finite(p[0])&&finite(p[1]));
     if(roadPts.length>1)line=L.polyline(roadPts).addTo(map);
   }else{
     if(h&&loc.length)pts.push([+state.home.lat,+state.home.lng]);if(pts.length>1)line=L.polyline(pts).addTo(map);
   }
   const bounds=[];if(h)bounds.push([+state.home.lat,+state.home.lng]);loc.forEach(z=>bounds.push([+z.lat,+z.lng]));if(bounds.length)map.fitBounds(bounds,{padding:[30,30]});
   const e=document.getElementById('route2MapInfo');if(e)e.innerHTML='<strong>'+ds.length+' bayi</strong> • '+loc.length+' konumlu'+(ds.length-loc.length?' • <span class="badge b-warn">'+(ds.length-loc.length)+' koordinatsız</span>':'')+(d?.optimizationMode==='road'?'<div class="muted" style="margin-top:4px">Çizgi gerçek yol ağı güzergâhını gösterir (canlı trafik dahil değildir).</div>':'');
 }
 function render(){renderDraft();renderMap()}
 function load(show=true){const ns=nums(),it=srcItems();if(!ns.length){alert('Seçili gün için bayi yok.');return false}if(!it.length){alert('Seçili plandaki bayiler ana bayi listesiyle eşleşmedi.');return false}save(it,false);render();status('Seçili Excel sırası günlük çalışma alanına yüklendi. Henüz yöneticiyle paylaşılmadı.');if(show&&it.length!==ns.length)alert('Plan yüklendi. '+it.length+' bayi eşleşti; '+(ns.length-it.length)+' bayi eşleşmedi.');return true}

 function routeCost(order,m){let total=0,prev=0;for(const idx of order){const v=m[prev]?.[idx];if(!finite(v))return Infinity;total+=Number(v);prev=idx}const back=m[prev]?.[0];return finite(back)?total+Number(back):Infinity}
 function roadOrder(matrix,n){
   if(n<=0)return[];
   // Saha mantığı: güne evden en uzak (yol süresiyle) bayiyle başla; dönüşe yaklaşırken eve yakın bitir.
   const remaining=new Set(Array.from({length:n},(_,i)=>i+1));
   let first=1,max=-1;for(const i of remaining){const v=matrix[0]?.[i];if(finite(v)&&Number(v)>max){max=Number(v);first=i}}
   const order=[first];remaining.delete(first);let cur=first;
   while(remaining.size){let best=null,bestScore=Infinity;for(const j of remaining){const to=matrix[cur]?.[j],home=matrix[j]?.[0];if(!finite(to))continue;const left=remaining.size;const homeWeight=left<=3?0.20:0.03;const score=Number(to)+homeWeight*(finite(home)?Number(home):0);if(score<bestScore){bestScore=score;best=j}}if(best==null)best=[...remaining][0];order.push(best);remaining.delete(best);cur=best}
   // 2-opt: ilk durağı sabit tutarak toplam ev->...->ev sürüş süresini iyileştir.
   let best=order.slice(),bestCost=routeCost(best,matrix),changed=true,passes=0;
   while(changed&&passes<8){changed=false;passes++;for(let i=1;i<best.length-1;i++){for(let k=i+1;k<best.length;k++){const cand=best.slice(0,i).concat(best.slice(i,k+1).reverse(),best.slice(k+1));const c=routeCost(cand,matrix);if(c+1<bestCost){best=cand;bestCost=c;changed=true}}}}
   return best;
 }
 async function fetchRoadMatrix(home,dealers){
   const coords=[`${Number(home.lng)},${Number(home.lat)}`,...dealers.map(coord)].join(';');
   const url=OSRM+'/table/v1/driving/'+coords+'?annotations=duration,distance';
   const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('Yol matrisi alınamadı ('+r.status+')');const j=await r.json();if(j.code!=='Ok'||!Array.isArray(j.durations))throw new Error(j.message||'Yol matrisi alınamadı');return j;
 }
 async function fetchRoadGeometry(home,dealers){
   const coords=[`${Number(home.lng)},${Number(home.lat)}`,...dealers.map(coord),`${Number(home.lng)},${Number(home.lat)}`].join(';');
   const url=OSRM+'/route/v1/driving/'+coords+'?overview=simplified&geometries=geojson&steps=false';
   const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('Yol çizgisi alınamadı ('+r.status+')');const j=await r.json();const rr=j.routes?.[0];if(j.code!=='Ok'||!rr)throw new Error(j.message||'Yol çizgisi alınamadı');return rr;
 }
 function fallbackOptimize(rows,missingRows,msg){
   const opt=typeof optimizeDayRoute==='function'?optimizeDayRoute(rows.map(x=>x.dealer)):rows.map(x=>x.dealer),m=new Map(rows.concat(missingRows).map(x=>[x.dealer.id,x.source]));
   save(opt.map(z=>({source:m.get(z.id),dealerId:z.id})).concat(missingRows.map(x=>({source:x.source,dealerId:x.dealer.id}))),true,{optimizationMode:'air'});render();status('Yol servisi kullanılamadı; geçici olarak kuş uçuşu optimizasyon uygulandı.');alert('Yol bazlı optimizasyon şu anda alınamadı. Kuş uçuşu yedek sıralama uygulandı.\n\n'+msg);
 }
 async function optimize(){
   let d=draft();if(!d?.items?.length){if(!load(false))return;d=draft()}
   const r=drows(d),located=r.filter(x=>isValidDealerCoordinate(x.dealer.lat,x.dealer.lng)),missing=r.filter(x=>!isValidDealerCoordinate(x.dealer.lat,x.dealer.lng));
   if(!located.length){alert('Yol bazlı rut için koordinatı olan bayi bulunamadı.');return}
   if(!isValidDealerCoordinate(state.home?.lat,state.home?.lng)){alert('Yol bazlı optimizasyon için önce Ayarlar / Rut Planı tarafında ev konumunu kaydetmen gerekiyor.');return}
   const btn=[...document.querySelectorAll('#route2ActionPanel button')].find(b=>b.getAttribute('onclick')==='optimizeRoute2()');const old=btn?.textContent;if(btn){btn.disabled=true;btn.textContent='Yollar hesaplanıyor…'}status('Gerçek yol süreleri hesaplanıyor…');
   try{
     const home={lat:Number(state.home.lat),lng:Number(state.home.lng)},matrix=await fetchRoadMatrix(home,located.map(x=>x.dealer));
     const order=roadOrder(matrix.durations,located.length),orderedRows=order.map(i=>located[i-1]),m=new Map(r.map(x=>[x.dealer.id,x.source]));
     const orderedDealers=orderedRows.map(x=>x.dealer),road=await fetchRoadGeometry(home,orderedDealers);
     const items=orderedRows.map(x=>({source:m.get(x.dealer.id),dealerId:x.dealer.id})).concat(missing.map(x=>({source:x.source,dealerId:x.dealer.id})));
     save(items,true,{optimizationMode:'road',roadDistanceMeters:Number(road.distance||0),roadDurationSeconds:Number(road.duration||0),roadGeometry:road.geometry?.coordinates||null});
     render();status('Rut Planı2 gerçek yol sürelerine göre optimize edildi. Canlı trafik hesaba katılmaz.');
     if(missing.length)alert('Yol bazlı rut oluşturuldu. '+missing.length+' koordinatsız bayi yol hesabına katılamadığı için listenin sonuna bırakıldı.');
   }catch(e){console.warn('OSRM road optimization failed',e);fallbackOptimize(located,missing,e?.message||String(e))}
   finally{if(btn){btn.disabled=false;btn.textContent=old||'En Mantıklı Rutu Oluştur'}}
 }
 async function publish(){let d=draft();if(!d?.items?.length){if(!load(false))return;d=draft()}const ids=drows(d).map(x=>x.dealer.id),prev=(state.todayRoute||[]).slice();try{state.todayRoute=ids;const r=publishTodayRoute();if(r?.then)await r;status('Rut Planı2 sırası yöneticiye gönderildi.')}catch(e){alert('Rut yayınlanamadı: '+(e?.message||e))}finally{state.todayRoute=prev;try{localStorage.setItem(storeKey,JSON.stringify(state))}catch(_){}if(typeof renderAll==='function')renderAll();render()}}
 function clear(){if(!draft()?.items?.length){status('Günlük taslak zaten boş.');return}if(!confirm('Rut Planı2 günlük taslağı temizlensin mi? Excel kaynak planı silinmez.'))return;del();renderRoute2();renderMap();status('Günlük taslak temizlendi.')}
 async function mark(id){if(typeof markRouteVisited==='function')await markRouteVisited(id);render()}
 async function undo(id){if(typeof undoRouteVisited==='function')await undoRouteVisited(id);render()}
 function install(){
   const sec=document.getElementById('route2'),left=sec?.querySelector('.card.span-4');if(!sec||!left)return false;
   if(!document.getElementById('route2ActionPanel')){const p=document.createElement('div');p.id='route2ActionPanel';p.innerHTML='<button class="btn btn-primary" style="margin-top:12px;width:100%" onclick="openOutOfRouteVisit()">+ Rota Dışı Ziyaret Ekle</button><div class="muted" style="margin-top:6px">Rutunda olmayan yeni bir firmayı ziyaret ettiysen buradan kaydet.</div><hr style="border:0;border-top:1px solid #e2e8f0;margin:16px 0"><button class="btn btn-ghost" style="width:100%" onclick="loadRoute2Today()">Seçili Planı Bugüne Yükle</button><button class="btn btn-accent" style="margin-top:12px;width:100%" onclick="optimizeRoute2()">En Mantıklı Rutu Oluştur</button><div class="muted" style="margin-top:6px">Bu buton artık bayi koordinatları arasındaki gerçek yol ağı ve tahmini sürüş sürelerini kullanır. Canlı trafik dahil değildir.</div><div id="route2PublishStatus" class="muted" style="margin-top:12px">Bugünkü rut henüz yöneticiyle paylaşılmadı.</div><button class="btn btn-primary" style="margin-top:8px;width:100%" onclick="publishRoute2()">✓ Bugünkü Rutu Onayla ve Yöneticiye Gönder</button><button class="btn btn-ghost" style="margin-top:8px;width:100%" onclick="clearRoute2Today()">Bugünkü rutu temizle</button>';left.appendChild(p)}
   if(!document.getElementById('route2Map')){const c=document.createElement('div');c.className='card span-12';c.innerHTML='<div id="route2MapInfo" class="muted" style="margin-bottom:10px"></div><div id="route2Map" style="height:420px;border-radius:12px"></div>';sec.querySelector('.grid')?.appendChild(c)}render();return true
 }
 window.renderRoute2Workspace=render;window.loadRoute2Today=load;window.optimizeRoute2=optimize;window.publishRoute2=publish;window.clearRoute2Today=clear;window.markRoute2Visited=mark;window.undoRoute2Visited=undo;
 let t=setInterval(()=>{if(install())clearInterval(t)},100);
})();