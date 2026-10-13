// İlke Saha - Rut Planlayıcı bölge modu + Excel çıktısı
// Mevcut akıllı planlayıcıyı bozmadan il/ilçe bazlı gün atama ve .xlsx export ekler.
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
  const DAY_KEY=x=>x.week+'|'+x.day;
  const norm=v=>String(v||'').trim().toLocaleUpperCase('tr-TR');
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const regionSelections=new Map(DAYS.map(x=>[DAY_KEY(x),[]]));
  const estimateCache=new Map();
  let regionPlan=null;
  let mode='dealer';
  let installTimer=null;
  let originalApprove=null;

  function ready(){return typeof cloudUser!=='undefined'&&cloudUser&&typeof teamContext!=='undefined'&&teamContext?.organizationId;}
  function plannerStaffId(){return document.getElementById('routePlannerStaff')?.value||cloudUser?.id||'';}
  function staffDealers(){const uid=plannerStaffId();return (state.dealers||[]).filter(d=>d.isActive!==false&&d.assignedUserId===uid);}
  function valid(d){return typeof isValidDealerCoordinate==='function'&&isValidDealerCoordinate(d?.lat,d?.lng);}
  function dist(a,b){return typeof distanceKm==='function'?distanceKm(a,b):0;}
  function home(){return valid(state?.home)?{lat:+state.home.lat,lng:+state.home.lng}:{lat:41.0074,lng:28.5379};}
  function cityOf(d){return typeof inferDealerCity==='function'?inferDealerCity(d):'BELİRSİZ';}

  function ensureStyles(){
    if(document.getElementById('routePlannerRegionStyles'))return;
    const s=document.createElement('style');s.id='routePlannerRegionStyles';s.textContent=`
      .rp-mode-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}
      .rp-mode-tabs .btn.active{outline:2px solid currentColor}
      .rp-region-day{border:1px solid var(--brand-border);border-radius:12px;padding:10px;margin-top:9px;background:#fff}
      .rp-region-day-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:7px}
      .rp-region-add{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px}
      .rp-region-chips{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}
      .rp-region-chip{display:inline-flex;align-items:center;gap:5px;background:#eef2f7;border-radius:999px;padding:4px 7px;font-size:12px}
      .rp-region-chip button{border:0;background:transparent;font-weight:900;cursor:pointer;padding:0 2px}
      #routePlannerRegionDays{max-height:620px;overflow:auto;padding-right:2px}
      @media(max-width:650px){.rp-region-add{grid-template-columns:1fr}.rp-region-add .btn{width:100%}}
    `;document.head.appendChild(s);
  }

  function regionOptions(){
    const dealers=staffDealers();
    const cities=[...new Set(dealers.map(cityOf).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
    const districts=[...new Set(dealers.map(d=>norm(d.district)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
    return [
      ...cities.map(v=>({type:'CITY',value:v,label:'İl • '+v})),
      ...districts.map(v=>({type:'DISTRICT',value:v,label:'İlçe • '+v}))
    ];
  }

  function ensureUi(){
    const sec=document.getElementById('routePlanner');if(!sec)return false;
    ensureStyles();
    const left=sec.querySelector('.card.span-4');if(!left)return false;
    if(!document.getElementById('routePlannerModeTabs')){
      const tabs=document.createElement('div');tabs.id='routePlannerModeTabs';tabs.className='rp-mode-tabs';
      tabs.innerHTML='<button id="rpModeDealer" class="btn btn-primary active" type="button" onclick="setRoutePlannerMode(\'dealer\')">Bayi Seçerek</button><button id="rpModeRegion" class="btn btn-ghost" type="button" onclick="setRoutePlannerMode(\'region\')">Bölge Seçerek</button>';
      const staffWrap=document.getElementById('routePlannerStaffWrap');
      if(staffWrap)staffWrap.insertAdjacentElement('afterend',tabs);else left.prepend(tabs);
    }
    if(!document.getElementById('routePlannerDealerMode')){
      const search=document.getElementById('routePlannerSearch');
      const summary=document.getElementById('routePlannerSelectionSummary');
      const list=document.getElementById('routePlannerDealerList');
      const build=[...left.querySelectorAll('button')].find(b=>b.getAttribute('onclick')==='buildTwoWeekRoutePlan()');
      if(search&&summary&&list&&build){
        const wrap=document.createElement('div');wrap.id='routePlannerDealerMode';
        search.parentNode.insertBefore(wrap,search);
        wrap.appendChild(search);
        const toolbar=summary.previousElementSibling;
        if(toolbar&&toolbar.classList.contains('toolbar'))wrap.appendChild(toolbar);
        wrap.appendChild(summary);wrap.appendChild(list);wrap.appendChild(build);
      }
    }
    if(!document.getElementById('routePlannerRegionMode')){
      const panel=document.createElement('div');panel.id='routePlannerRegionMode';panel.style.display='none';
      panel.innerHTML='<div class="note"><strong>Bölge bazlı planlama</strong><div class="muted" style="margin-top:4px">Her güne birden fazla il veya ilçe ekleyebilirsin. Örn. 1. Hafta Pazartesi: Silivri + Kapaklı + Çerkezköy.</div></div><div id="routePlannerRegionDays"></div><button class="btn btn-accent" style="width:100%;margin-top:12px" type="button" onclick="buildRoutePlanFromRegions()">✨ Seçilen Bölgelerden Rutu Oluştur</button>';
      const dealerMode=document.getElementById('routePlannerDealerMode');
      dealerMode?.insertAdjacentElement('afterend',panel);
    }
    const actions=document.querySelector('#routePlanner .card.span-8 .toolbar .toolbar');
    if(actions&&!document.getElementById('routePlannerExcelBtn')){
      const b=document.createElement('button');b.id='routePlannerExcelBtn';b.className='btn btn-accent';b.type='button';b.textContent='Excel Olarak İndir';b.onclick=exportRoutePlannerExcel;actions.insertBefore(b,actions.firstChild);
    }
    bindStaffChange();renderRegionDays();setMode(mode,false);patchApprove();
    return true;
  }

  function bindStaffChange(){
    const sel=document.getElementById('routePlannerStaff');if(!sel||sel.dataset.regionBound)return;
    sel.dataset.regionBound='1';
    sel.addEventListener('change',()=>{
      DAYS.forEach(x=>regionSelections.set(DAY_KEY(x),[]));regionPlan=null;estimateCache.clear();renderRegionDays();
    });
  }

  function setMode(next,clear=true){
    mode=next==='region'?'region':'dealer';
    const dealer=document.getElementById('routePlannerDealerMode'),region=document.getElementById('routePlannerRegionMode');
    if(dealer)dealer.style.display=mode==='dealer'?'':'none';
    if(region)region.style.display=mode==='region'?'':'none';
    document.getElementById('rpModeDealer')?.classList.toggle('active',mode==='dealer');
    document.getElementById('rpModeRegion')?.classList.toggle('active',mode==='region');
    if(document.getElementById('rpModeDealer'))document.getElementById('rpModeDealer').className='btn '+(mode==='dealer'?'btn-primary active':'btn-ghost');
    if(document.getElementById('rpModeRegion'))document.getElementById('rpModeRegion').className='btn '+(mode==='region'?'btn-primary active':'btn-ghost');
    if(clear&&mode==='dealer')regionPlan=null;
  }

  function renderRegionDays(){
    const box=document.getElementById('routePlannerRegionDays');if(!box)return;
    const opts=regionOptions();
    box.innerHTML=DAYS.map((x,di)=>{
      const key=DAY_KEY(x),selected=regionSelections.get(key)||[];
      const chips=selected.map((r,ri)=>'<span class="rp-region-chip">'+esc(r.type==='CITY'?'İl: '+r.value:'İlçe: '+r.value)+'<button type="button" onclick="removeRoutePlannerRegion('+di+','+ri+')">×</button></span>').join('');
      return '<div class="rp-region-day"><div class="rp-region-day-head"><strong>'+esc(x.label)+'</strong><span class="badge b-info">'+selected.length+' bölge</span></div><div class="rp-region-add"><select id="rpRegionSelect'+di+'">'+(opts.length?opts.map(o=>'<option value="'+o.type+'|'+esc(o.value)+'">'+esc(o.label)+'</option>').join(''):'<option value="">Bölge bulunamadı</option>')+'</select><button class="btn btn-ghost" type="button" onclick="addRoutePlannerRegion('+di+')">+ Bölge Ekle</button></div><div class="rp-region-chips">'+(chips||'<span class="muted">Bu güne bölge seçilmedi.</span>')+'</div></div>';
    }).join('');
  }

  function addRegion(dayIndex){
    const meta=DAYS[dayIndex],sel=document.getElementById('rpRegionSelect'+dayIndex);if(!meta||!sel?.value)return;
    const [type,...rest]=sel.value.split('|'),value=rest.join('|');if(!type||!value)return;
    const key=DAY_KEY(meta),rows=regionSelections.get(key)||[];
    if(!rows.some(x=>x.type===type&&x.value===value))rows.push({type,value});
    regionSelections.set(key,rows);regionPlan=null;renderRegionDays();
  }
  function removeRegion(dayIndex,regionIndex){const meta=DAYS[dayIndex];if(!meta)return;const key=DAY_KEY(meta),rows=regionSelections.get(key)||[];rows.splice(regionIndex,1);regionSelections.set(key,rows);regionPlan=null;renderRegionDays();}

  function matchesRegion(d,r){return r.type==='CITY'?norm(cityOf(d))===norm(r.value):norm(d.district)===norm(r.value);}
  function districtEstimate(d){const district=norm(d.district);if(!district)return null;const peers=(state.dealers||[]).filter(x=>x.id!==d.id&&valid(x)&&norm(x.district)===district);if(!peers.length)return null;return{lat:peers.reduce((s,x)=>s+(+x.lat),0)/peers.length,lng:peers.reduce((s,x)=>s+(+x.lng),0)/peers.length,source:'district'};}
  async function geocode(d){const q=[d.address,d.district,cityOf(d),'Türkiye'].filter(Boolean).join(', ');if(!q)return null;try{const r=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=tr&q='+encodeURIComponent(q),{headers:{'Accept-Language':'tr'}});if(!r.ok)return null;const j=await r.json();return j?.[0]?{lat:+j[0].lat,lng:+j[0].lon,source:'address'}:null;}catch(_){return null;}}
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function coordFor(d){if(valid(d))return{lat:+d.lat,lng:+d.lng,source:'saved'};if(estimateCache.has(d.id))return estimateCache.get(d.id);let e=districtEstimate(d);if(!e)e=await geocode(d);if(e)estimateCache.set(d.id,e);return e||null;}

  function optimizeDay(ds){
    const located=ds.filter(d=>valid(d));const unlocated=ds.filter(d=>!valid(d));
    if(located.length<=1)return located.concat(unlocated);
    const h=home(),remaining=[...located].sort((a,b)=>dist(b,h)-dist(a,h)),out=[remaining.shift()];
    while(remaining.length){const cur=out[out.length-1];let bi=0,bs=Infinity;for(let i=0;i<remaining.length;i++){const score=dist(cur,remaining[i])+Math.max(0,dist(remaining[i],h)-dist(cur,h))*1.7;if(score<bs){bs=score;bi=i;}}out.push(remaining.splice(bi,1)[0]);}
    return out.concat(unlocated);
  }

  async function buildFromRegions(){
    const all=staffDealers();if(!all.length){alert('Bu personele atanmış aktif bayi yok.');return;}
    const totalRegions=[...regionSelections.values()].reduce((s,x)=>s+x.length,0);if(!totalRegions){alert('Önce en az bir güne il veya ilçe ekle.');return;}
    const status=document.getElementById('routePlannerStatus');if(status)status.textContent='Bölge planı hazırlanıyor…';
    const used=new Set(),days=[];let estimated=0;
    for(let di=0;di<DAYS.length;di++){
      const meta=DAYS[di],regions=regionSelections.get(DAY_KEY(meta))||[];
      let dealers=all.filter(d=>!used.has(d.id)&&regions.some(r=>matchesRegion(d,r)));
      for(let i=0;i<dealers.length;i++){
        if(!valid(dealers[i])){
          if(status)status.textContent=meta.label+' için eksik konumlar tahmin ediliyor… '+(i+1)+' / '+dealers.length;
          const e=await coordFor(dealers[i]);if(e){dealers[i]={...dealers[i],lat:e.lat,lng:e.lng,_coordSource:e.source};estimated++;await sleep(80);}else dealers[i]={...dealers[i],_coordSource:'none'};
        }else dealers[i]={...dealers[i],_coordSource:'saved'};
        used.add(dealers[i].id);
      }
      dealers=optimizeDay(dealers);days.push({...meta,dealers,regions:regions.slice()});
    }
    regionPlan={staffId:plannerStaffId(),createdAt:new Date().toISOString(),selectedCount:used.size,mode:'region',estimated,days};
    renderRegionPlan();
    if(status)status.textContent='Bölge bazlı 2 haftalık plan hazır. Kontrol edip aktarabilir veya Excel olarak indirebilirsin.';
  }

  function dayKm(ds){const loc=ds.filter(valid);if(!loc.length)return 0;let km=0,cur=home();for(const d of loc){km+=dist(cur,d);cur=d;}km+=dist(cur,home());return km;}
  function renderRegionPlan(){
    if(!regionPlan)return;
    const sum=document.getElementById('routePlannerSummary'),box=document.getElementById('routePlannerResult');if(!sum||!box)return;
    const all=regionPlan.days.flatMap(x=>x.dealers),none=all.filter(x=>x._coordSource==='none').length,totalKm=regionPlan.days.reduce((s,x)=>s+dayKm(x.dealers),0);
    sum.innerHTML='<div class="rp-summary-grid"><div class="item"><strong>'+all.length+'</strong><div class="muted">Toplam bayi</div></div><div class="item"><strong>12</strong><div class="muted">İş günü</div></div><div class="item"><strong>'+regionPlan.estimated+'</strong><div class="muted">Tahmini konum</div></div><div class="item"><strong>'+Math.round(totalKm)+' km</strong><div class="muted">Kuş bakışı toplam</div></div></div>'+(none?'<div class="note"><span class="badge b-warn">'+none+' bayi konumsuz</span> Bu kayıtların sırası sadece bölge eşleşmesine göre verildi.</div>':'');
    box.innerHTML=regionPlan.days.map(x=>'<div class="rp-day"><h4>'+esc(x.label)+' <span class="badge b-info">'+x.dealers.length+' bayi</span>'+(x.regions?.length?' <span class="muted">• '+esc(x.regions.map(r=>r.value).join(', '))+'</span>':'')+'</h4>'+(x.dealers.length?x.dealers.map((d,i)=>'<div class="rp-stop"><div class="rp-mini-num">'+(i+1)+'</div><div><strong>'+esc(d.name)+'</strong><div class="muted">'+esc(cityOf(d))+' • '+esc(d.district||'')+(d._coordSource&&d._coordSource!=='saved'&&d._coordSource!=='none'?'<span class="rp-est">'+(d._coordSource==='address'?'adres tahmini':'ilçe tahmini')+'</span>':'')+(d._coordSource==='none'?'<span class="rp-est">konum yok</span>':'')+'</div></div></div>').join(''):'<div class="muted">Bu gün için seçilen bölgelerde bayi yok.</div>')+'</div>').join('');
  }

  async function saveRegionPlan(){
    if(!regionPlan){return originalApprove?originalApprove():undefined;}
    if(regionPlan.staffId!==plannerStaffId()){alert('Personel seçimi değişti. Bölge planını yeniden oluştur.');return;}
    const target=document.getElementById('routePlannerTarget')?.value||'ROUTE1',label=target==='ROUTE1'?'Rut Planı':'Rut Planı2';
    if(!confirm('Bölge bazlı oluşturulan 2 haftalık plan '+label+' olarak kaydedilsin mi?\n\nMevcut kaynak plan bu planla değiştirilecek; bayiler silinmez.'))return;
    const status=document.getElementById('routePlannerStatus');if(status)status.textContent='Plan buluta aktarılıyor…';
    try{
      const rows=regionPlan.days.map(x=>({organization_id:teamContext.organizationId,plan_type:target,staff_user_id:regionPlan.staffId,week_no:x.week,day_name:x.day,dealer_ids:x.dealers.map(d=>d.id),updated_by:cloudUser.id,updated_at:new Date().toISOString()}));
      const {error}=await supabaseClient.from('route_plan_templates').upsert(rows,{onConflict:'organization_id,plan_type,staff_user_id,week_no,day_name'});if(error)throw error;
      if(target==='ROUTE1')await syncLegacy(regionPlan.days);
      if(typeof logActivity==='function'){try{await logActivity('ROUTE_TEMPLATE_UPDATED','ROUTE',regionPlan.staffId,{action:'REGION_2_WEEK_PLAN',planType:target,dealerCount:regionPlan.selectedCount});}catch(_){}}
      try{localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){ }
      if(typeof renderAll==='function')renderAll();
      if(target==='ROUTE2'&&regionPlan.staffId===cloudUser.id&&typeof refreshRoutePlan2Templates==='function')await refreshRoutePlan2Templates();
      if(status)status.textContent=label+' başarıyla güncellendi.';alert('Bölge planı '+label+' üzerine aktarıldı.');
    }catch(err){console.error(err);alert('Plan aktarılamadı: '+(err.message||err));if(status)status.textContent='Aktarım başarısız.';}
  }

  async function syncLegacy(days){
    const uid=regionPlan.staffId,mine=(state.dealers||[]).filter(d=>d.assignedUserId===uid),plannedIds=new Set(days.flatMap(x=>x.dealers.map(d=>d.id)));
    for(const d of mine.filter(d=>d.plannedWeek||d.plannedDay||plannedIds.has(d.id))){
      const loc=days.map(x=>({x,index:x.dealers.findIndex(z=>z.id===d.id)})).find(y=>y.index>=0);
      const p=loc?{planned_week:loc.x.week+'. HAFTA',planned_day:loc.x.day,planned_order:loc.index+1}:{planned_week:null,planned_day:null,planned_order:null};
      const {error}=await supabaseClient.from('organization_dealers').update({...p,updated_by:cloudUser.id,updated_at:new Date().toISOString()}).eq('organization_id',teamContext.organizationId).eq('id',d.id);if(error)throw error;
      d.plannedWeek=p.planned_week;d.plannedDay=p.planned_day;d.plannedOrder=p.planned_order;
    }
  }

  function patchApprove(){if(originalApprove||typeof window.approveTwoWeekRoutePlan!=='function')return;originalApprove=window.approveTwoWeekRoutePlan;window.approveTwoWeekRoutePlan=()=>regionPlan?saveRegionPlan():originalApprove();}

  async function loadXlsx(){
    if(window.XLSX)return true;
    return new Promise(resolve=>{
      const old=document.getElementById('routePlannerXlsxLib');if(old){old.addEventListener('load',()=>resolve(!!window.XLSX),{once:true});setTimeout(()=>resolve(!!window.XLSX),5000);return;}
      const s=document.createElement('script');s.id='routePlannerXlsxLib';s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.onload=()=>resolve(true);s.onerror=()=>resolve(false);document.head.appendChild(s);
    });
  }

  function currentPlanRows(){
    if(regionPlan){return regionPlan.days.flatMap(x=>x.dealers.map((d,i)=>({Hafta:x.week,Gün:x.label.replace(/^\d+\. Hafta /,''),Sıra:i+1,Bayi:d.name,İl:cityOf(d),İlçe:d.district||'',Adres:d.address||'',Telefon:d.phone||'',Enlem:valid(d)?Number(d.lat):'',Boylam:valid(d)?Number(d.lng):'',Konum:d._coordSource==='saved'?'Kayıtlı':d._coordSource==='address'?'Adres tahmini':d._coordSource==='district'?'İlçe tahmini':'Yok'})));}
    const rows=[];
    document.querySelectorAll('#routePlannerResult .rp-day').forEach(dayEl=>{
      const title=dayEl.querySelector('h4')?.childNodes?.[0]?.textContent?.trim()||'';
      const m=title.match(/^(1|2)\. Hafta\s+(.+)$/i);const week=m?Number(m[1]):'',day=m?m[2]:title;
      dayEl.querySelectorAll('.rp-stop').forEach((stop,i)=>{
        const name=stop.querySelector('strong')?.textContent?.trim()||'';const d=(state.dealers||[]).find(x=>x.name===name)||{};
        rows.push({Hafta:week,Gün:day,Sıra:i+1,Bayi:name,İl:cityOf(d),İlçe:d.district||'',Adres:d.address||'',Telefon:d.phone||'',Enlem:valid(d)?Number(d.lat):'',Boylam:valid(d)?Number(d.lng):'',Konum:valid(d)?'Kayıtlı':'Tahmini/Yok'});
      });
    });
    return rows;
  }

  async function exportExcel(){
    const rows=currentPlanRows();if(!rows.length){alert('Önce bir rut planı oluştur.');return;}
    const ok=await loadXlsx();if(!ok){alert('Excel bileşeni yüklenemedi. İnternet bağlantısını kontrol edip tekrar dene.');return;}
    const ws=XLSX.utils.json_to_sheet(rows,{header:['Hafta','Gün','Sıra','Bayi','İl','İlçe','Adres','Telefon','Enlem','Boylam','Konum']});
    ws['!cols']=[{wch:8},{wch:14},{wch:7},{wch:42},{wch:16},{wch:18},{wch:50},{wch:18},{wch:14},{wch:14},{wch:16}];
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'2 Haftalık Rut');
    const summary=[['İLKE SAHA - RUT PLANLAYICI'],['Personel',document.getElementById('routePlannerStaff')?.selectedOptions?.[0]?.textContent||''],['Oluşturma Tarihi',new Date().toLocaleString('tr-TR')],['Toplam Bayi',rows.length]];
    const sws=XLSX.utils.aoa_to_sheet(summary);sws['!cols']=[{wch:20},{wch:40}];XLSX.utils.book_append_sheet(wb,sws,'Özet');
    const person=(document.getElementById('routePlannerStaff')?.selectedOptions?.[0]?.textContent||'Saha').replace(/[^A-Za-z0-9ÇĞİÖŞÜçğıöşü]+/g,'_');
    XLSX.writeFile(wb,'Ilke_Saha_2_Haftalik_Rut_'+person+'.xlsx');
  }

  function install(){if(!ready())return false;return ensureUi();}
  function start(){clearInterval(installTimer);installTimer=setInterval(()=>{if(install())clearInterval(installTimer)},180);}

  window.setRoutePlannerMode=setMode;
  window.addRoutePlannerRegion=addRegion;
  window.removeRoutePlannerRegion=removeRegion;
  window.buildRoutePlanFromRegions=buildFromRegions;
  window.exportRoutePlannerExcel=exportExcel;
  document.addEventListener('DOMContentLoaded',start,{once:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&ready())setTimeout(install,120)});
  setTimeout(start,0);
})();
