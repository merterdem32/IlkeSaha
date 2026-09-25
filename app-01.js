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

function persist(){
  // Bulut sistemi hazırken oturum yoksa saha verisinin yerel olarak sessizce
  // değişmesine izin verme. Böylece kullanıcı "kaydedildi" sanıp veri kaybetmez.
  if(typeof supabaseClient!=='undefined' && supabaseClient && (typeof cloudUser==='undefined'||!cloudUser)){
    const saved=JSON.parse(localStorage.getItem(storeKey)||'null');
    if(saved) state=saved;
    renderAll();
    if(typeof setAuthUiState==='function') setAuthUiState('signed-out');
    alert('Bu işlem için önce giriş yapmalısın.');
    return false;
  }
  localStorage.setItem(storeKey,JSON.stringify(state));
  renderAll();
  if(typeof scheduleCloudSync==='function') scheduleCloudSync();
  return true;
}

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

function isValidDealerCoordinate(lat,lng){
  if(lat===null||lat===undefined||lng===null||lng===undefined)return false;
  if(String(lat).trim()===''||String(lng).trim()==='')return false;
  const la=Number(lat), lo=Number(lng);
  return Number.isFinite(la)&&Number.isFinite(lo)&&la>=-90&&la<=90&&lo>=-180&&lo<=180;
}

function distanceKm(a,b){
  const R=6371, toRad=x=>x*Math.PI/180;
  const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng);
  const la1=toRad(a.lat), la2=toRad(b.lat);
  const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

function actorDisplayName(item){
  const uid=item?._actorUserId||item?._ownerUserId||null;
  if(!uid)return '-';
  const p=(typeof teamProfilesById!=='undefined'&&teamProfilesById)?teamProfilesById.get(uid):null;
  return p?.full_name||p?.username||p?.email||'Kullanıcı';
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

function activateSection(sectionId){
  if(typeof supabaseClient!=='undefined' && supabaseClient && (typeof cloudUser==='undefined'||!cloudUser)){
    if(typeof setAuthUiState==='function') setAuthUiState('signed-out');
    return;
  }
  const btn=document.querySelector('nav button[data-section="'+sectionId+'"]');
  const section=document.getElementById(sectionId);
  if(!btn||!section||btn.style.display==='none')return;

  document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.section').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
  section.classList.add('active');

  if(sectionId==='mapsec') setTimeout(()=>{initMap();map.invalidateSize();renderMap();},50);
  if(sectionId==='route') setTimeout(()=>{initRouteMap();routeMap.invalidateSize();renderRouteMap();},50);
  if(sectionId==='settings') setTimeout(()=>{initHomeMap();homeMap.invalidateSize();},50);
  if(sectionId==='management' && typeof renderManagementDashboard==='function') setTimeout(()=>renderManagementDashboard(),50);
  if(sectionId==='dailyreport' && typeof prepareDailyReportControls==='function') setTimeout(()=>prepareDailyReportControls(),50);
}

function nav(){
  document.querySelectorAll('nav button').forEach(btn=>btn.onclick=()=>activateSection(btn.dataset.section));
}

function renderDashboard(){
  const uid=(typeof cloudUser!=='undefined'&&cloudUser)?cloudUser.id:null;
  const isField=typeof teamContext!=='undefined'&&teamContext?.role==='FIELD_STAFF';
  const myVisits=isField&&uid?state.visits.filter(v=>(v._actorUserId||v._ownerUserId||uid)===uid):state.visits;
  const myPayments=isField&&uid?state.payments.filter(p=>(p._actorUserId||p._ownerUserId||uid)===uid):state.payments;

  const visibleDealers=state.dealers.filter(d=>d.isActive!==false && (typeof dealerVisibleToCurrentUser!=='function'||dealerVisibleToCurrentUser(d)));
  kpiDealers.textContent=visibleDealers.length;
  kpiVisits.textContent=myVisits.filter(v=>String(v.date||'').slice(0,10)===todayStr()).length;
  kpiPayments.textContent=myPayments.filter(p=>!['paid','cancelled'].includes(p.status)).length;
  kpiOverdue.textContent=myPayments.filter(p=>paymentStatus(p).text==='Gecikti').length;
  todayRoute.innerHTML=state.todayRoute.length?state.todayRoute.map((id,i)=>{
    const d=state.dealers.find(x=>x.id===id); return d?'<div class="item">'+(i+1)+'. <strong>'+esc(d.name)+'</strong><span class="muted">'+esc(d.district||'')+'</span></div>':''
  }).join(''):'Henüz rut oluşturulmadı.';
  const pp=myPayments.filter(p=>!['paid','cancelled'].includes(p.status)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,6);
  dashboardPayments.innerHTML=pp.length?pp.map(p=>{
    const d=state.dealers.find(x=>x.id===p.dealerId), s=paymentStatus(p);
    return '<div class="item"><strong>'+esc(d?.name||'Bilinmeyen bayi')+'</strong>'+fmtMoney(p.amount)+' • '+p.date+' <span class="badge '+s.cls+'">'+s.text+'</span></div>'
  }).join(''):'Kayıt yok.';
}

const TURKEY_PROVINCES=[
  'ADANA','ADIYAMAN','AFYONKARAHİSAR','AĞRI','AMASYA','ANKARA','ANTALYA','ARTVİN','AYDIN','BALIKESİR',
  'BİLECİK','BİNGÖL','BİTLİS','BOLU','BURDUR','BURSA','ÇANAKKALE','ÇANKIRI','ÇORUM','DENİZLİ',
  'DİYARBAKIR','EDİRNE','ELAZIĞ','ERZİNCAN','ERZURUM','ESKİŞEHİR','GAZİANTEP','GİRESUN','GÜMÜŞHANE','HAKKARİ',
  'HATAY','ISPARTA','MERSİN','İSTANBUL','İZMİR','KARS','KASTAMONU','KAYSERİ','KIRKLARELİ','KIRŞEHİR',
  'KOCAELİ','KONYA','KÜTAHYA','MALATYA','MANİSA','KAHRAMANMARAŞ','MARDİN','MUĞLA','MUŞ','NEVŞEHİR',
  'NİĞDE','ORDU','RİZE','SAKARYA','SAMSUN','SİİRT','SİNOP','SİVAS','TEKİRDAĞ','TOKAT',
  'TRABZON','TUNCELİ','ŞANLIURFA','UŞAK','VAN','YOZGAT','ZONGULDAK','AKSARAY','BAYBURT','KARAMAN',
  'KIRIKKALE','BATMAN','ŞIRNAK','BARTIN','ARDAHAN','IĞDIR','YALOVA','KARABÜK','KİLİS','OSMANİYE','DÜZCE'
];

function normalizeTrText(value){
  return String(value||'').trim().toLocaleUpperCase('tr-TR');
}

function inferDealerCity(d){
  if(d?.city)return normalizeTrText(d.city);
  const haystack=normalizeTrText([d?.address,d?.district,d?.generalNote].filter(Boolean).join(' '));
  const exact=TURKEY_PROVINCES.find(city=>haystack.includes(city));
  if(exact)return exact;

  // Common ASCII variants in imported address data.
  const ascii=haystack
    .replaceAll('İ','I').replaceAll('Ş','S').replaceAll('Ğ','G')
    .replaceAll('Ü','U').replaceAll('Ö','O').replaceAll('Ç','C');
  const asciiMap={
    ISTANBUL:'İSTANBUL',TEKIRDAG:'TEKİRDAĞ',EDIRNE:'EDİRNE',KIRKLARELI:'KIRKLARELİ',
    KOCAELI:'KOCAELİ',CANAKKALE:'ÇANAKKALE',BALIKESIR:'BALIKESİR',BURSA:'BURSA',
    SAKARYA:'SAKARYA',YALOVA:'YALOVA'
  };
  for(const [k,v] of Object.entries(asciiMap)) if(ascii.includes(k)) return v;
  return 'BELİRSİZ';
}

function refreshDealerLocationFilters(){
  const cityEl=document.getElementById('dealerCityFilter');
  const districtEl=document.getElementById('dealerDistrictFilter');
  if(!cityEl||!districtEl)return;

  const visible=state.dealers.filter(d=>d.isActive!==false &&
    (typeof dealerVisibleToCurrentUser!=='function'||dealerVisibleToCurrentUser(d)));

  const currentCity=cityEl.value||'all';
  const currentDistrict=districtEl.value||'all';

  const cities=[...new Set(visible.map(inferDealerCity).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,'tr'));
  cityEl.innerHTML='<option value="all">Tüm iller</option>'+
    cities.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
  if([...cityEl.options].some(o=>o.value===currentCity)) cityEl.value=currentCity;

  const selectedCity=cityEl.value||'all';
  const districts=[...new Set(visible
    .filter(d=>selectedCity==='all'||inferDealerCity(d)===selectedCity)
    .map(d=>normalizeTrText(d.district))
    .filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,'tr'));

  districtEl.innerHTML='<option value="all">Tüm ilçeler</option>'+
    districts.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
  if([...districtEl.options].some(o=>o.value===currentDistrict)) districtEl.value=currentDistrict;
}

function onDealerCityFilterChange(){
  const districtEl=document.getElementById('dealerDistrictFilter');
  if(districtEl)districtEl.value='all';
  refreshDealerLocationFilters();
  renderDealers();
}

function renderDealers(){
  const q=(dealerSearch?.value||'').toLowerCase();
  refreshDealerLocationFilters();
  const managerFilter=(typeof teamContext!=='undefined'&&teamContext?.role==='MANAGER')
    ? (document.getElementById('managerDealerStaffFilter')?.value||'all')
    : 'all';
  const cityFilter=document.getElementById('dealerCityFilter')?.value||'all';
  const districtFilter=document.getElementById('dealerDistrictFilter')?.value||'all';
  const rows=state.dealers.filter(d=>{
    if(typeof dealerVisibleToCurrentUser==='function'&&!dealerVisibleToCurrentUser(d))return false;
    const textOk=[d.name,d.contact,d.district,d.address].join(' ').toLowerCase().includes(q);
    if(!textOk)return false;
    if(cityFilter!=='all'&&inferDealerCity(d)!==cityFilter)return false;
    if(districtFilter!=='all'&&normalizeTrText(d.district)!==districtFilter)return false;
    if(managerFilter!=='all'&&d.assignedUserId!==managerFilter)return false;
    return true;
  });
  dealerRows.innerHTML=rows.map(d=>{
    const lv=lastVisitForDealer(d.id);
    return '<tr><td><strong>'+esc(d.name)+'</strong><br><span class="muted">'+esc(inferDealerCity(d))+(d.district?' • '+esc(d.district):'')+'</span></td>'+
      '<td>'+esc(d.contact||'-')+'<br><span class="muted">'+esc(d.phone||'')+'</span></td>'+
      '<td>'+esc(d.address||'-')+'</td>'+
      '<td><span class="badge '+(d.locationStatus==='verified'?'b-ok':d.locationStatus==='estimated'?'b-warn':'b-info')+'">'+(d.locationStatus==='verified'?'Doğrulandı':d.locationStatus==='estimated'?'Tahmini':'Konum girilmedi')+'</span></td>'+
      '<td>'+(lv?new Date(lv.date).toLocaleDateString('tr-TR'):'-')+'</td>'+
      '<td class="manager-only-col">'+esc(typeof salespersonLabel==='function'?salespersonLabel(d.assignedUserId):(d.assignedUserId||'Atanmamış'))+'</td>'+
      '<td class="manager-only-col">'+(lv?esc(actorDisplayName(lv)):'-')+'</td>'+
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
  state.dealers.filter(d=>(typeof dealerVisibleToCurrentUser!=='function'||dealerVisibleToCurrentUser(d))&&isValidDealerCoordinate(d.lat,d.lng)).forEach(d=>{
    const m=L.marker([d.lat,d.lng]).addTo(map).bindPopup('<strong>'+esc(d.name)+'</strong><br>'+esc(d.district||'')+'<br>'+(d.locationStatus==='verified'?'Doğrulandı':'Tahmini'));
    mainMarkers.push(m);
  });
  const pts=[[state.home.lat,state.home.lng],...state.dealers.filter(d=>(typeof dealerVisibleToCurrentUser!=='function'||dealerVisibleToCurrentUser(d))&&isValidDealerCoordinate(d.lat,d.lng)).map(d=>[d.lat,d.lng])];
  if(pts.length>1)map.fitBounds(pts,{padding:[30,30]});
}

async function openDealerModal(id){
  const d=id?state.dealers.find(x=>x.id===id):null;
  dealerId.value=d?.id||'';
  dealerModalTitle.textContent=d?'Bayi Düzenle':'Bayi Ekle';
  dealerName.value=d?.name||''; dealerContact.value=d?.contact||''; dealerPhone.value=d?.phone||'';
  dealerDistrict.value=d?.district||''; dealerAddress.value=d?.address||'';
  dealerLat.value=(d?.lat===null||d?.lat===undefined)?'':d.lat; dealerLng.value=(d?.lng===null||d?.lng===undefined)?'':d.lng;
  dealerLocationStatus.value=d?.locationStatus||'unset'; dealerFrequency.value=d?.frequency||14;
  dealerPriority.value=String(d?.priority||1); dealerGeneralNote.value=d?.generalNote||'';
  if(typeof populateDealerAssigneeSelect==='function') await populateDealerAssigneeSelect(d?.assignedUserId||null);
  if(document.getElementById('dealerMapPaste')) dealerMapPaste.value='';
  if(document.getElementById('dealerMapPasteHint')) dealerMapPasteHint.textContent='Koordinatı veya içinde koordinat bulunan Google Maps linkini yapıştırabilirsin.';
  dealerDialog.showModal();
  setTimeout(()=>{
    if(miniMap){miniMap.remove(); miniMap=null}
    const rawLat=dealerLat.value;
    const rawLng=dealerLng.value;
    const hasCoord=rawLat!==''&&rawLng!==''&&isValidDealerCoordinate(rawLat,rawLng);
    const homeOk=isValidDealerCoordinate(state.home?.lat,state.home?.lng);
    const center=hasCoord?[Number(rawLat),Number(rawLng)]:(homeOk?[Number(state.home.lat),Number(state.home.lng)]:[41.0082,28.9784]);

    if((rawLat!==''||rawLng!=='')&&!hasCoord){
      const hint=document.getElementById('dealerMapPasteHint');
      if(hint) hint.textContent='Kayıtlı koordinat geçersiz. Enlem -90…90, boylam -180…180 aralığında olmalı. Aşağıdan doğru koordinatı girip kaydedebilirsin.';
    }

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
