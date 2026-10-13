// İlke Saha - 2 haftalık akıllı Rut Planlayıcı
// Saha personeli kendi bayilerini, yönetici seçtiği personelin bayilerini planlar.
(()=>{
  const DAYS=[
    {week:1,day:'PAZARTESİ',label:'1. Hafta Pazartesi'},
    {week:1,day:'SALI',label:'1. Hafta Salı'},
    {week:1,day:'ÇARŞAMBA',label:'1. Hafta Çarşamba'},
    {week:1,day:'PERŞEMBE',label:'1. Hafta Perşembe'},
    {week:1,day:'CUMA',label:'1. Hafta Cuma'},
    {week:1,day:'CUMARTESİ',label:'1. Hafta Cumartesi'},
    {week:2,day:'PAZARTESİ',label:'2. Hafta Pazartesi'},
    {week:2,day:'SALI',label:'2. Hafta Salı'},
    {week:2,day:'ÇARŞAMBA',label:'2. Hafta Çarşamba'},
    {week:2,day:'PERŞEMBE',label:'2. Hafta Perşembe'},
    {week:2,day:'CUMA',label:'2. Hafta Cuma'},
    {week:2,day:'CUMARTESİ',label:'2. Hafta Cumartesi'}
  ];
  const estimatedCoords=new Map();
  let selectedIds=new Set();
  let generatedPlan=null;
  let plannerStaffId='';
  let plannerMap=null,plannerMapLayers=[];
  let installTimer=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=v=>String(v||'').trim().toLocaleUpperCase('tr-TR');

  function ready(){return typeof cloudUser!=='undefined'&&cloudUser&&typeof teamContext!=='undefined'&&teamContext?.organizationId;}
  function manager(){return teamContext?.role==='MANAGER';}
  function field(){return teamContext?.role==='FIELD_STAFF';}
  function valid(d){return typeof isValidDealerCoordinate==='function'&&isValidDealerCoordinate(d?.lat,d?.lng);}
  function dist(a,b){return typeof distanceKm==='function'?distanceKm(a,b):haversine(a,b);}
  function haversine(a,b){const R=6371,r=x=>x*Math.PI/180,dLat=r(+b.lat-+a.lat),dLng=r(+b.lng-+a.lng),x=Math.sin(dLat/2)**2+Math.cos(r(+a.lat))*Math.cos(r(+b.lat))*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
  const home=()=>valid(state?.home)?{lat:+state.home.lat,lng:+state.home.lng}:{lat:41.0074,lng:28.5379};

  async function ensureDirectory(){if(manager()&&typeof loadManagerDirectory==='function'){try{await loadManagerDirectory();}catch(_){}}}
  function staffRows(){
    if(field()){
      const p=(typeof teamProfilesById!=='undefined'&&teamProfilesById)?teamProfilesById.get(cloudUser.id):null;
      return [{id:cloudUser.id,label:p?.full_name||p?.username||cloudUser.email||'Ben'}];
    }
    const ms=(typeof managerDirectoryCache!=='undefined'&&managerDirectoryCache?.members)||[];
    const ps=(typeof managerDirectoryCache!=='undefined'&&managerDirectoryCache?.profiles)||new Map();
    return ms.filter(x=>x.role==='FIELD_STAFF'&&x.is_active!==false).map(x=>{const p=ps.get(x.user_id)||{};return{id:x.user_id,label:p.full_name||p.username||p.email||x.user_id,username:p.username||''};});
  }
  function staffName(id){const r=staffRows().find(x=>x.id===id);return r?.label||'Personel';}
  function staffDealers(){return (state.dealers||[]).filter(d=>d.isActive!==false&&d.assignedUserId===plannerStaffId);}

  function ensureStyles(){
    if(document.getElementById('routePlannerStyles'))return;
    const s=document.createElement('style');s.id='routePlannerStyles';s.textContent=`
      .rp-dealer-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px;border-bottom:1px solid #eceef1}
      .rp-dealer-row input{width:20px;height:20px}
      .rp-dealer-list{max-height:520px;overflow:auto;border:1px solid var(--brand-border);border-radius:12px;background:white}
      .rp-day{border:1px solid var(--brand-border);border-radius:14px;background:#fff;padding:12px;margin-bottom:10px}
      .rp-day h4{margin:0 0 8px;font-size:15px}
      .rp-stop{display:grid;grid-template-columns:28px minmax(0,1fr);gap:8px;padding:7px 0;border-top:1px solid #f0f1f3}
      .rp-stop:first-of-type{border-top:0}
      .rp-mini-num{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:#eef0f3;font-weight:800;font-size:12px}
      .rp-est{font-size:11px;color:#8a5a00;background:#fff4ce;border-radius:999px;padding:2px 6px;display:inline-block;margin-left:5px}
      #routePlannerMap{height:460px;border-radius:12px;border:1px solid var(--brand-border)}
      .rp-summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}
      .rp-summary-grid .item{text-align:center;padding:10px}
      @media(max-width:800px){.rp-summary-grid{grid-template-columns:repeat(2,1fr)}#routePlannerMap{height:330px}}
    `;document.head.appendChild(s);
  }

  function ensureSection(){
    if(document.getElementById('routePlanner'))return;
    const sec=document.createElement('section');sec.id='routePlanner';sec.className='section';
    sec.innerHTML=`<div class="grid">
      <div class="card span-4">
        <h2>Rut Planlayıcı</h2>
        <div class="muted">Ziyaret etmek istediğin bayileri seç. Sistem koordinat ve adres bilgilerine göre 2 haftalık plan oluştursun.</div>
        <div id="routePlannerStaffWrap"><label>Personel</label><select id="routePlannerStaff"></select></div>
        <label>Bayi ara</label><input id="routePlannerSearch" placeholder="Bayi, ilçe veya adres ara...">
        <div class="toolbar" style="margin-top:10px">
          <button class="btn btn-ghost" type="button" onclick="routePlannerSelectAll(true)">Tümünü Seç</button>
          <button class="btn btn-ghost" type="button" onclick="routePlannerSelectAll(false)">Temizle</button>
        </div>
        <div id="routePlannerSelectionSummary" class="note"></div>
        <div id="routePlannerDealerList" class="rp-dealer-list"></div>
        <button class="btn btn-accent" style="width:100%;margin-top:12px" type="button" onclick="buildTwoWeekRoutePlan()">✨ En Mantıklı 2 Haftalık Rutu Oluştur</button>
        <div id="routePlannerStatus" class="muted" style="margin-top:10px">Henüz plan oluşturulmadı.</div>
      </div>
      <div class="card span-8">
        <div class="toolbar" style="justify-content:space-between;align-items:center">
          <div><h2 style="margin:0">Oluşturulan Plan</h2><div class="muted">Pazartesi–Cumartesi, 2 hafta boyunca coğrafi olarak dengeli dağıtım.</div></div>
          <div class="toolbar" style="margin:0">
            <select id="routePlannerTarget" style="max-width:160px"><option value="ROUTE1">Rut Planı</option><option value="ROUTE2">Rut Planı2</option></select>
            <button class="btn btn-primary" type="button" onclick="approveTwoWeekRoutePlan()">✓ Onayla ve Aktar</button>
          </div>
        </div>
        <div id="routePlannerSummary"></div>
        <div id="routePlannerResult" class="muted">Bayi seçip plan oluşturduğunda 12 günlük liste burada görünecek.</div>
      </div>
      <div class="card span-12"><div id="routePlannerMapInfo" class="muted" style="margin-bottom:8px"></div><div id="routePlannerMap"></div></div>
    </div>`;
    document.querySelector('main')?.appendChild(sec);
    document.getElementById('routePlannerSearch')?.addEventListener('input',renderDealerList);
    document.getElementById('routePlannerStaff')?.addEventListener('change',()=>{plannerStaffId=routePlannerStaff.value;selectedIds=new Set();generatedPlan=null;estimatedCoords.clear();renderDealerList();renderGenerated();});
  }

  async function ensureNav(){
    let b=document.getElementById('routePlannerNavBtn');if(b)return;
    const nav=document.querySelector('nav');if(!nav)return;
    b=document.createElement('button');b.id='routePlannerNavBtn';b.dataset.section='routePlanner';b.textContent='Rut Planlayıcı';
    const after=document.getElementById('route2NavBtn')||document.getElementById('routeNavBtn');
    if(after)after.insertAdjacentElement('afterend',b);else nav.appendChild(b);
    b.onclick=()=>{activateSection('routePlanner');setTimeout(prepareRoutePlanner,20)};
  }

  async function prepareRoutePlanner(){
    if(!ready())return;
    await ensureDirectory();ensureStyles();ensureSection();ensureNav();
    const staff=document.getElementById('routePlannerStaff'),wrap=document.getElementById('routePlannerStaffWrap');
    const rows=staffRows();const prev=plannerStaffId||staff?.value||cloudUser.id;
    if(staff){staff.innerHTML=rows.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.label)+(x.username?' ('+esc(x.username)+')':'')+'</option>').join('');if(rows.some(x=>x.id===prev))staff.value=prev;else if(rows[0])staff.value=rows[0].id;plannerStaffId=staff.value||cloudUser.id;}
    if(wrap)wrap.style.display=manager()?'':'none';
    if(!selectedIds.size){staffDealers().forEach(d=>selectedIds.add(d.id));}
    renderDealerList();renderGenerated();ensurePlannerMap();
  }

  function currentCoord(d){
    if(valid(d))return {lat:+d.lat,lng:+d.lng,source:'saved'};
    const e=estimatedCoords.get(d.id);return e?{lat:+e.lat,lng:+e.lng,source:e.source||'estimated'}:null;
  }

  function renderDealerList(){
    const list=document.getElementById('routePlannerDealerList'),sum=document.getElementById('routePlannerSelectionSummary');if(!list)return;
    const q=String(document.getElementById('routePlannerSearch')?.value||'').toLocaleLowerCase('tr-TR');
    const ds=staffDealers().filter(d=>!q||[d.name,d.district,d.address].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR').includes(q));
    const all=staffDealers(),selected=[...selectedIds].filter(id=>all.some(d=>d.id===id));
    const missing=selected.map(id=>all.find(d=>d.id===id)).filter(d=>d&&!currentCoord(d)).length;
    if(sum)sum.innerHTML='<strong>'+selected.length+' / '+all.length+' bayi seçili</strong>'+(missing?' • <span class="badge b-warn">'+missing+' konum eksik</span>':'');
    list.innerHTML=ds.length?ds.map(d=>{const c=currentCoord(d);return '<label class="rp-dealer-row"><input type="checkbox" '+(selectedIds.has(d.id)?'checked':'')+' onchange="routePlannerToggleDealer(\''+d.id+'\',this.checked)"><div><strong>'+esc(d.name)+'</strong><div class="muted">'+esc(d.district||'')+(d.address?' • '+esc(d.address):'')+'</div></div><span class="badge '+(c?(c.source==='saved'?'b-ok':'b-warn'):'b-info')+'">'+(c?(c.source==='saved'?'Konum var':'Tahmini'):'Konum yok')+'</span></label>';}).join(''):'<div class="muted" style="padding:12px">Bayi bulunamadı.</div>';
  }

  function toggleDealer(id,on){if(on)selectedIds.add(id);else selectedIds.delete(id);generatedPlan=null;renderDealerList();renderGenerated();}
  function selectAll(on){selectedIds=new Set(on?staffDealers().map(d=>d.id):[]);generatedPlan=null;renderDealerList();renderGenerated();}

  function districtEstimate(d){
    const district=norm(d.district);if(!district)return null;
    const peers=(state.dealers||[]).filter(x=>x.id!==d.id&&valid(x)&&norm(x.district)===district);
    if(!peers.length)return null;
    return {lat:peers.reduce((s,x)=>s+(+x.lat),0)/peers.length,lng:peers.reduce((s,x)=>s+(+x.lng),0)/peers.length,source:'district',label:'İlçe tahmini'};
  }

  async function geocodeDealer(d){
    const q=[d.address,d.district,'Türkiye'].filter(Boolean).join(', ');if(!q)return null;
    try{
      const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=tr&q='+encodeURIComponent(q);
      const r=await fetch(url,{headers:{'Accept-Language':'tr'}});if(!r.ok)return null;
      const j=await r.json();if(!j?.[0])return null;
      return {lat:Number(j[0].lat),lng:Number(j[0].lon),source:'address',label:'Adres tahmini'};
    }catch(_){return null;}
  }

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function estimateMissing(ds){
    const status=document.getElementById('routePlannerStatus');
    const missing=ds.filter(d=>!currentCoord(d));if(!missing.length)return;
    // Önce aynı ilçedeki doğrulanmış bayilerden güvenli bir yaklaşık merkez üret.
    for(const d of missing){const e=districtEstimate(d);if(e)estimatedCoords.set(d.id,e);}
    const left=missing.filter(d=>!currentCoord(d));
    for(let i=0;i<left.length;i++){
      if(status)status.textContent='Eksik adreslerden konum tahmin ediliyor: '+(i+1)+' / '+left.length;
      const e=await geocodeDealer(left[i]);if(e)estimatedCoords.set(left[i].id,e);
      if(i<left.length-1)await sleep(1050);
    }
    renderDealerList();
  }

  function planPoint(d){const c=currentCoord(d);return c?{...d,lat:c.lat,lng:c.lng,_coordSource:c.source}:null;}
  function capacityArray(n,k){const base=Math.floor(n/k),extra=n%k;return Array.from({length:k},(_,i)=>base+(i<extra?1:0));}

  function farthestSeeds(points,k){
    if(!points.length)return [];
    const h=home();let first=[...points].sort((a,b)=>dist(b,h)-dist(a,h))[0],seeds=[first];
    while(seeds.length<k){let best=null,bestScore=-1;for(const p of points){if(seeds.some(s=>s.id===p.id))continue;const score=Math.min(...seeds.map(s=>dist(p,s)));if(score>bestScore){bestScore=score;best=p;}}if(!best)break;seeds.push(best);}
    return seeds.map(s=>({lat:+s.lat,lng:+s.lng}));
  }

  function balancedClusters(points,k){
    if(k<=1)return [points.slice()];
    const caps=capacityArray(points.length,k);let centers=farthestSeeds(points,k);let clusters=[];
    for(let pass=0;pass<7;pass++){
      clusters=Array.from({length:k},()=>[]);const remaining=caps.slice();
      const items=[...points].sort((a,b)=>{
        const da=[...centers].map(c=>dist(a,c)).sort((x,y)=>x-y),db=[...centers].map(c=>dist(b,c)).sort((x,y)=>x-y);
        return ((db[1]??999)-(db[0]??0))-((da[1]??999)-(da[0]??0));
      });
      for(const p of items){let best=-1,score=Infinity;for(let i=0;i<k;i++){if(remaining[i]<=0)continue;const s=dist(p,centers[i]);if(s<score){score=s;best=i;}}if(best<0)best=0;clusters[best].push(p);remaining[best]--;}
      centers=clusters.map((c,i)=>c.length?({lat:c.reduce((s,p)=>s+(+p.lat),0)/c.length,lng:c.reduce((s,p)=>s+(+p.lng),0)/c.length}):centers[i]);
    }
    return clusters;
  }

  function optimizeCluster(ds){
    if(ds.length<=1)return ds.slice();
    const h=home();const byHome=[...ds].sort((a,b)=>dist(b,h)-dist(a,h));const first=byHome.shift();const out=[first];let cur=first;
    while(byHome.length){let bi=0,bs=Infinity;for(let i=0;i<byHome.length;i++){const hop=dist(cur,byHome[i]),away=Math.max(0,dist(byHome[i],h)-dist(cur,h))*1.7,score=hop+away;if(score<bs){bs=score;bi=i;}}cur=byHome.splice(bi,1)[0];out.push(cur);}
    return out;
  }

  function assignUnlocated(unlocated,days){
    for(const d of unlocated){
      let idx=-1;
      if(d.district){idx=days.findIndex(day=>day.some(x=>norm(x.district)===norm(d.district)));}
      if(idx<0){idx=days.map((x,i)=>({i,n:x.length})).sort((a,b)=>a.n-b.n)[0]?.i??0;}
      days[idx].push({...d,_coordSource:'none'});
    }
  }

  async function buildPlan(){
    const ds=staffDealers().filter(d=>selectedIds.has(d.id));
    if(!ds.length){alert('Önce en az bir bayi seç.');return;}
    const status=document.getElementById('routePlannerStatus');if(status)status.textContent='Plan hazırlanıyor…';
    await estimateMissing(ds);
    const located=ds.map(planPoint).filter(Boolean),unlocated=ds.filter(d=>!currentCoord(d));
    const k=Math.min(12,Math.max(1,located.length));let clusters=balancedClusters(located,k);
    clusters=clusters.map(optimizeCluster);
    // 12 günlük görünüm: boş günleri sona bırakmak yerine kapasiteyi 12 güne dengeli yay.
    let days=Array.from({length:12},()=>[]);
    clusters.forEach((c,i)=>{days[i]=c;});
    assignUnlocated(unlocated,days);
    // Günlerin yakın büyüklükte kalması için, en dolu günden en boş güne aynı bölgenin kenar elemanlarını aktar.
    for(let guard=0;guard<100;guard++){
      const sizes=days.map((d,i)=>({i,n:d.length})).sort((a,b)=>a.n-b.n),lo=sizes[0],hi=sizes[sizes.length-1];if(hi.n-lo.n<=1)break;
      const moved=days[hi.i].pop();if(!moved)break;days[lo.i].push(moved);
    }
    days=days.map(optimizeCluster);
    generatedPlan={staffId:plannerStaffId,createdAt:new Date().toISOString(),selectedCount:ds.length,days:DAYS.map((meta,i)=>({...meta,dealers:days[i]||[]}))};
    if(status)status.textContent='2 haftalık plan hazır. Kontrol edip Rut Planı veya Rut Planı2’ye aktarabilirsin.';
    renderGenerated();renderPlannerMap();
  }

  function dayKm(ds){const loc=ds.filter(x=>valid(x));if(!loc.length)return 0;let km=0,cur=home();for(const d of loc){km+=dist(cur,d);cur=d;}km+=dist(cur,home());return km;}
  function renderGenerated(){
    const box=document.getElementById('routePlannerResult'),sum=document.getElementById('routePlannerSummary');if(!box||!sum)return;
    if(!generatedPlan){sum.innerHTML='';box.innerHTML='<div class="muted">Bayi seçip plan oluşturduğunda 12 günlük liste burada görünecek.</div>';renderPlannerMap();return;}
    const all=generatedPlan.days.flatMap(x=>x.dealers),est=all.filter(x=>x._coordSource&&x._coordSource!=='saved'&&x._coordSource!=='none').length,none=all.filter(x=>x._coordSource==='none').length,totalKm=generatedPlan.days.reduce((s,x)=>s+dayKm(x.dealers),0);
    sum.innerHTML='<div class="rp-summary-grid"><div class="item"><strong>'+all.length+'</strong><div class="muted">Toplam bayi</div></div><div class="item"><strong>12</strong><div class="muted">İş günü</div></div><div class="item"><strong>'+est+'</strong><div class="muted">Tahmini konum</div></div><div class="item"><strong>'+Math.round(totalKm)+' km</strong><div class="muted">Kuş bakışı toplam</div></div></div>'+(none?'<div class="note"><span class="badge b-warn">'+none+' bayi konumsuz</span> Adres/ilçe eşleşmesi bulunamadığı için en dengeli güne eklendi; onaydan önce kontrol et.</div>':'');
    box.innerHTML=generatedPlan.days.map(x=>'<div class="rp-day"><h4>'+esc(x.label)+' <span class="badge b-info">'+x.dealers.length+' bayi</span>'+(dayKm(x.dealers)?' <span class="muted">≈ '+dayKm(x.dealers).toFixed(0)+' km</span>':'')+'</h4>'+(x.dealers.length?x.dealers.map((d,i)=>'<div class="rp-stop"><div class="rp-mini-num">'+(i+1)+'</div><div><strong>'+esc(d.name)+'</strong><div class="muted">'+esc(d.district||'')+(d._coordSource&&d._coordSource!=='saved'&&d._coordSource!=='none'?'<span class="rp-est">'+(d._coordSource==='address'?'adres tahmini':'ilçe tahmini')+'</span>':'')+(d._coordSource==='none'?'<span class="rp-est">konum yok</span>':'')+'</div></div></div>').join(''):'<div class="muted">Bu gün boş.</div>')+'</div>').join('');
  }

  function ensurePlannerMap(){const e=document.getElementById('routePlannerMap');if(!e||typeof L==='undefined')return;if(!plannerMap){plannerMap=L.map('routePlannerMap').setView([home().lat,home().lng],9);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(plannerMap);}setTimeout(()=>plannerMap?.invalidateSize(),50);renderPlannerMap();}
  function renderPlannerMap(){if(!plannerMap)return;plannerMapLayers.forEach(x=>{try{plannerMap.removeLayer(x)}catch(_){}});plannerMapLayers=[];if(!generatedPlan){plannerMap.setView([home().lat,home().lng],9);return;}const pts=[];const hm=L.marker([home().lat,home().lng]).addTo(plannerMap).bindPopup('<strong>Ev</strong>');plannerMapLayers.push(hm);pts.push([home().lat,home().lng]);generatedPlan.days.forEach((day,di)=>{const line=[];day.dealers.forEach((d,i)=>{if(!valid(d))return;const p=[+d.lat,+d.lng];const m=L.marker(p).addTo(plannerMap).bindPopup('<strong>'+esc(day.label)+'</strong><br>'+(i+1)+'. '+esc(d.name));plannerMapLayers.push(m);line.push(p);pts.push(p);});if(line.length){const poly=L.polyline([[home().lat,home().lng],...line,[home().lat,home().lng]],{weight:2,opacity:.45}).addTo(plannerMap);plannerMapLayers.push(poly);}});if(pts.length>1)plannerMap.fitBounds(pts,{padding:[25,25]});const info=document.getElementById('routePlannerMapInfo');if(info)info.textContent='12 günlük plan haritada gün bazlı rotalar halinde gösteriliyor. Mesafe hesabı kuş bakışı tahmindir; trafik ve gerçek yol ağı dahil değildir.';}

  async function approvePlan(){
    if(!generatedPlan){alert('Önce bir plan oluştur.');return;}
    if(generatedPlan.staffId!==plannerStaffId){alert('Personel seçimi değişti. Planı yeniden oluştur.');return;}
    const target=document.getElementById('routePlannerTarget')?.value||'ROUTE1';
    const label=target==='ROUTE1'?'Rut Planı':'Rut Planı2';
    if(!confirm(staffName(plannerStaffId)+' için oluşturulan 2 haftalık plan '+label+' olarak kaydedilsin mi?\n\nMevcut 2 haftalık kaynak plan bu yeni planla değiştirilecek. Bayiler silinmez.'))return;
    const status=document.getElementById('routePlannerStatus');if(status)status.textContent='Plan buluta aktarılıyor…';
    try{
      const rows=generatedPlan.days.map(x=>({organization_id:teamContext.organizationId,plan_type:target,staff_user_id:plannerStaffId,week_no:x.week,day_name:x.day,dealer_ids:x.dealers.map(d=>d.id),updated_by:cloudUser.id,updated_at:new Date().toISOString()}));
      const {error}=await supabaseClient.from('route_plan_templates').upsert(rows,{onConflict:'organization_id,plan_type,staff_user_id,week_no,day_name'});if(error)throw error;
      if(target==='ROUTE1')await syncLegacyRoute1(generatedPlan.days);
      if(typeof logActivity==='function'){try{await logActivity('ROUTE_TEMPLATE_UPDATED','ROUTE',plannerStaffId,{action:'AUTO_2_WEEK_PLAN',planType:target,dealerCount:generatedPlan.selectedCount});}catch(_){}}
      try{localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){ }
      if(typeof renderAll==='function')renderAll();
      if(target==='ROUTE2'&&plannerStaffId===cloudUser.id&&typeof refreshRoutePlan2Templates==='function')await refreshRoutePlan2Templates();
      if(status)status.textContent=label+' başarıyla güncellendi.';
      alert('2 haftalık plan '+label+' üzerine aktarıldı.');
    }catch(err){
      console.error('Route planner approval failed',err);
      const msg=String(err?.message||err);
      if(status)status.textContent='Aktarım başarısız: '+msg;
      alert(msg.includes('route_plan_templates')?'Plan tablosu henüz hazır değil. Supabase SQL Editor’de supabase-team-phase11-route-plan-editor.sql dosyasını bir kez çalıştır.':'Plan aktarılamadı: '+msg);
    }
  }

  async function syncLegacyRoute1(days){
    // Seçilen personelin eski Rut Planı kaynak alanlarını tamamen yeni 2 haftalık plana eşitler.
    const mine=(state.dealers||[]).filter(d=>d.assignedUserId===plannerStaffId);
    const plannedIds=new Set(days.flatMap(x=>x.dealers.map(d=>d.id)));
    for(const d of mine.filter(d=>d.plannedWeek||d.plannedDay||plannedIds.has(d.id))){
      const loc=days.map((x,di)=>({x,di,index:x.dealers.findIndex(z=>z.id===d.id)})).find(y=>y.index>=0);
      const payload=loc?{planned_week:loc.x.week+'. HAFTA',planned_day:loc.x.day,planned_order:loc.index+1}:{planned_week:null,planned_day:null,planned_order:null};
      const {error}=await supabaseClient.from('organization_dealers').update({...payload,updated_by:cloudUser.id,updated_at:new Date().toISOString()}).eq('organization_id',teamContext.organizationId).eq('id',d.id);if(error)throw error;
      d.plannedWeek=payload.planned_week;d.plannedDay=payload.planned_day;d.plannedOrder=payload.planned_order;
    }
  }

  function install(){if(!ready())return false;ensureStyles();ensureSection();ensureNav();return true;}
  function start(){clearInterval(installTimer);installTimer=setInterval(()=>{if(install())clearInterval(installTimer)},150);}

  window.prepareRoutePlanner=prepareRoutePlanner;
  window.routePlannerToggleDealer=toggleDealer;
  window.routePlannerSelectAll=selectAll;
  window.buildTwoWeekRoutePlan=buildPlan;
  window.approveTwoWeekRoutePlan=approvePlan;
  document.addEventListener('DOMContentLoaded',start,{once:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&ready())setTimeout(install,100)});
  setTimeout(start,0);
})();
