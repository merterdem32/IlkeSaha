const storeKey='ilkeSahaPrototypeV02';
const seededDealers=window.SEED_DEALERS||[];
let state=JSON.parse(localStorage.getItem(storeKey)||'null')||{
  home:{lat:41.0082,lng:28.9784},
  dealers:seededDealers, visits:[], payments:[], todayRoute:[]
};

// Veri göçü: daha önce site 138 bayiyle açıldıysa localStorage eski listeyi tutuyordu.
// Seed listesindeki eksik bayileri mevcut kullanıcı verisini bozmadan ekle.
if(!Array.isArray(state.dealers)) state.dealers=[];
const existingDealerIds=new Set(state.dealers.map(d=>d.id));
for(const seeded of seededDealers){
  if(!existingDealerIds.has(seeded.id)) state.dealers.push(seeded);
}
localStorage.setItem(storeKey,JSON.stringify(state));
let map,routeMap,miniMap,miniMarker,homeMap,homeMarker,mainMarkers=[],routeLayer;

function persist(){localStorage.setItem(storeKey,JSON.stringify(state)); renderAll();}

function fmtMoney(n){return new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(Number(n||0))}

function todayStr(){
  const d=new Date();
  d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
}

function dtLocalNow(){
  const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,16)
}

function daysSince(dateStr){
  if(!dateStr)return 9999; return Math.floor((new Date()-new Date(dateStr))/86400000)
}

function distanceKm(a,b){
  const R=6371, toRad=x=>x*Math.PI/180;
  const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng);
  const la1=toRad(a.lat), la2=toRad(b.lat);
  const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

function lastVisitForDealer(id){
  return state.visits.filter(v=>v.dealerId===id).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
}

function pendingPaymentForDealer(id){
  return state.payments.some(p=>p.dealerId===id && p.status!=='paid' && p.status!=='cancelled');
}

function paymentStatus(p){
  if(p.status==='paid') return {text:'Ödendi',cls:'b-ok'};
  if(p.status==='cancelled') return {text:'İptal',cls:'b-info'};
  const t=todayStr();
  if(p.date<t) return {text:'Gecikti',cls:'b-bad'};
  if(p.date===t) return {text:'Bugün',cls:'b-warn'};
  return {text:'Bekliyor',cls:'b-info'};
}

function nav(){
  document.querySelectorAll('nav button').forEach(btn=>btn.onclick=()=>{
    document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.section').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.section).classList.add('active');
    if(btn.dataset.section==='mapsec') setTimeout(()=>{initMap();map.invalidateSize();renderMap();},50);
    if(btn.dataset.section==='route') setTimeout(()=>{initRouteMap();routeMap.invalidateSize();renderRouteMap();},50);
    if(btn.dataset.section==='settings') setTimeout(()=>{initHomeMap();homeMap.invalidateSize();},50);
  });
}

function renderDashboard(){
  kpiDealers.textContent=state.dealers.length;
  kpiVisits.textContent=state.visits.filter(v=>v.date.slice(0,10)===todayStr()).length;
  kpiPayments.textContent=state.payments.filter(p=>!['paid','cancelled'].includes(p.status)).length;
  kpiOverdue.textContent=state.payments.filter(p=>paymentStatus(p).text==='Gecikti').length;
  todayRoute.innerHTML=state.todayRoute.length?state.todayRoute.map((id,i)=>{
    const d=state.dealers.find(x=>x.id===id); return d?'<div class="item">'+(i+1)+'. <strong>'+esc(d.name)+'</strong><span class="muted">'+esc(d.district||'')+'</span></div>':''
  }).join(''):'Henüz rut oluşturulmadı.';
  const pp=state.payments.filter(p=>!['paid','cancelled'].includes(p.status)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,6);
  dashboardPayments.innerHTML=pp.length?pp.map(p=>{
    const d=state.dealers.find(x=>x.id===p.dealerId), s=paymentStatus(p);
    return '<div class="item"><strong>'+esc(d?.name||'Bilinmeyen bayi')+'</strong>'+fmtMoney(p.amount)+' • '+p.date+' <span class="badge '+s.cls+'">'+s.text+'</span></div>'
  }).join(''):'Kayıt yok.';
}

function renderDealers(){
  const q=(dealerSearch?.value||'').toLowerCase();
  const rows=state.dealers.filter(d=>[d.name,d.contact,d.district,d.address].join(' ').toLowerCase().includes(q));
  dealerRows.innerHTML=rows.map(d=>{
    const lv=lastVisitForDealer(d.id);
    return '<tr><td><strong>'+esc(d.name)+'</strong><br><span class="muted">'+esc(d.district||'')+'</span></td>'+
      '<td>'+esc(d.contact||'-')+'<br><span class="muted">'+esc(d.phone||'')+'</span></td>'+
      '<td>'+esc(d.address||'-')+'</td>'+
      '<td><span class="badge '+(d.locationStatus==='verified'?'b-ok':d.locationStatus==='estimated'?'b-warn':'b-info')+'">'+(d.locationStatus==='verified'?'Doğrulandı':d.locationStatus==='estimated'?'Tahmini':'Konum girilmedi')+'</span></td>'+
      '<td>'+(lv?new Date(lv.date).toLocaleDateString('tr-TR'):'-')+'</td>'+
      '<td><button class="btn btn-ghost" onclick="showDealer(\''+d.id+'\')">Aç</button></td></tr>'
  }).join('');
}

function initMap(){
  if(map)return;
  map=L.map('map').setView([state.home.lat,state.home.lng],10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
}

function renderMap(){
  if(!map)return;
  mainMarkers.forEach(m=>map.removeLayer(m)); mainMarkers=[];
  const home=L.marker([state.home.lat,state.home.lng]).addTo(map).bindPopup('<strong>Ev</strong>');
  mainMarkers.push(home);
  state.dealers.filter(d=>d.lat!==null&&d.lng!==null&&isFinite(d.lat)&&isFinite(d.lng)).forEach(d=>{
    const m=L.marker([d.lat,d.lng]).addTo(map).bindPopup('<strong>'+esc(d.name)+'</strong><br>'+esc(d.district||'')+'<br>'+(d.locationStatus==='verified'?'Doğrulandı':'Tahmini'));
    mainMarkers.push(m);
  });
  const pts=[[state.home.lat,state.home.lng],...state.dealers.filter(d=>d.lat!==null&&d.lng!==null&&isFinite(d.lat)&&isFinite(d.lng)).map(d=>[d.lat,d.lng])];
  if(pts.length>1)map.fitBounds(pts,{padding:[30,30]});
}

function openDealerModal(id){
  const d=id?state.dealers.find(x=>x.id===id):null;
  dealerId.value=d?.id||'';
  dealerModalTitle.textContent=d?'Bayi Düzenle':'Bayi Ekle';
  dealerName.value=d?.name||''; dealerContact.value=d?.contact||''; dealerPhone.value=d?.phone||'';
  dealerDistrict.value=d?.district||''; dealerAddress.value=d?.address||'';
  dealerLat.value=(d?.lat===null||d?.lat===undefined)?'':d.lat; dealerLng.value=(d?.lng===null||d?.lng===undefined)?'':d.lng;
  dealerLocationStatus.value=d?.locationStatus||'unset'; dealerFrequency.value=d?.frequency||14;
  dealerPriority.value=String(d?.priority||1); dealerGeneralNote.value=d?.generalNote||'';
  dealerDialog.showModal();
  setTimeout(()=>{
    if(miniMap){miniMap.remove(); miniMap=null}
    const hasCoord=dealerLat.value!==''&&dealerLng.value!=='';
    const center=hasCoord?[Number(dealerLat.value),Number(dealerLng.value)]:[state.home.lat,state.home.lng];
    miniMap=L.map('dealerMiniMap').setView(center,13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(miniMap);
    miniMarker=hasCoord?L.marker(center).addTo(miniMap):null;
    miniMap.on('click',e=>{
      dealerLat.value=e.latlng.lat.toFixed(6); dealerLng.value=e.latlng.lng.toFixed(6);
      if(miniMarker) miniMarker.setLatLng(e.latlng); else miniMarker=L.marker(e.latlng).addTo(miniMap);
      if(dealerLocationStatus.value==='unset') dealerLocationStatus.value='estimated';
    });
    miniMap.invalidateSize();
  },100);
}
