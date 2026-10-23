// İlke Saha - Harita pini üzerinden Rut Planı / Rut Planı2 gününe bayi ekleme
(()=>{
  const DAYS=['PAZARTESİ','SALI','ÇARŞAMBA','PERŞEMBE','CUMA','CUMARTESİ'];
  let selectedDealerId=null;
  let originalRenderMap=null;
  let installTimer=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const normDay=v=>String(v||'').trim().toLocaleUpperCase('tr-TR');
  const weekText=n=>Number(n)===2?'2. HAFTA':'1. HAFTA';
  const isManager=()=>typeof teamContext!=='undefined'&&teamContext?.role==='MANAGER';
  const ready=()=>typeof cloudUser!=='undefined'&&cloudUser&&typeof supabaseClient!=='undefined'&&supabaseClient&&teamContext?.organizationId;

  function ensureStyles(){
    if(document.getElementById('mapRoutePlannerStyles'))return;
    const s=document.createElement('style');
    s.id='mapRoutePlannerStyles';
    s.textContent=`
      .map-route-popup{min-width:210px}
      .map-route-popup .mrp-actions{display:grid;gap:6px;margin-top:9px}
      .map-route-popup .mrp-btn{border:0;border-radius:9px;padding:9px 10px;font-weight:800;cursor:pointer;background:#e30613;color:#fff}
      #mapRoutePlannerDialog{max-width:520px;width:min(92vw,520px)}
      #mapRoutePlannerDialog .modal{padding:18px}
      #mapRoutePlannerDialog .mrp-current{margin:10px 0;padding:10px;border-radius:10px;background:#f6f7f9}
    `;
    document.head.appendChild(s);
  }

  function ensureDialog(){
    if(document.getElementById('mapRoutePlannerDialog'))return;
    const d=document.createElement('dialog');
    d.id='mapRoutePlannerDialog';
    d.innerHTML=`<div class="modal">
      <div class="toolbar" style="justify-content:space-between;align-items:center">
        <div><h2 style="margin:0">Rut Planına Ekle</h2><div id="mapRouteDealerName" class="muted"></div></div>
        <button class="btn btn-ghost" type="button" onclick="closeMapRoutePlanner()">Kapat</button>
      </div>
      <div id="mapRouteCurrent" class="mrp-current muted"></div>
      <div id="mapRouteStaffWrap"><label>Personel</label><select id="mapRouteStaff"></select></div>
      <label>Plan</label>
      <select id="mapRoutePlanType"><option value="ROUTE1">Rut Planı</option><option value="ROUTE2">Rut Planı2</option></select>
      <div class="row">
        <div><label>Hafta</label><select id="mapRouteWeek"><option value="1">1. Hafta</option><option value="2">2. Hafta</option></select></div>
        <div><label>Gün</label><select id="mapRouteDay">${DAYS.map(x=>'<option value="'+x+'">'+x.charAt(0)+x.slice(1).toLocaleLowerCase('tr-TR')+'</option>').join('')}</select></div>
      </div>
      <div class="note" style="margin-top:12px">Bayi seçilen günün <strong>sonuna</strong> eklenir. Aynı planın başka günündeyse eski günden otomatik çıkarılır.</div>
      <div id="mapRoutePlannerStatus" class="muted" style="margin-top:10px"></div>
      <button id="mapRouteSaveBtn" class="btn btn-primary" style="width:100%;margin-top:14px" type="button" onclick="saveDealerToRouteFromMap()">✓ Güne Ekle</button>
    </div>`;
    document.body.appendChild(d);
  }

  async function loadDirectory(){
    if(isManager()&&typeof loadManagerDirectory==='function'){
      try{await loadManagerDirectory();}catch(_){ }
    }
  }

  function staffRows(){
    if(!isManager())return [{id:cloudUser.id,label:'Ben'}];
    const ms=(typeof managerDirectoryCache!=='undefined'&&managerDirectoryCache?.members)||[];
    const ps=(typeof managerDirectoryCache!=='undefined'&&managerDirectoryCache?.profiles)||new Map();
    return ms.filter(x=>x.role==='FIELD_STAFF'&&x.is_active!==false).map(x=>{
      const p=ps.get(x.user_id)||{};
      return {id:x.user_id,label:p.full_name||p.username||p.email||x.user_id};
    });
  }

  function staffName(id){
    const r=staffRows().find(x=>x.id===id);return r?.label||id||'-';
  }

  async function openPlanner(dealerId){
    if(!ready()){alert('Bulut bağlantısı hazır değil.');return;}
    const dealer=(state.dealers||[]).find(d=>d.id===dealerId);if(!dealer)return;
    selectedDealerId=dealerId;
    ensureStyles();ensureDialog();await loadDirectory();

    const staff=document.getElementById('mapRouteStaff');
    const wrap=document.getElementById('mapRouteStaffWrap');
    const rows=staffRows();
    staff.innerHTML=rows.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.label)+'</option>').join('');
    const preferred=dealer.assignedUserId&&rows.some(x=>x.id===dealer.assignedUserId)?dealer.assignedUserId:(rows.find(x=>x.id===cloudUser.id)?.id||rows[0]?.id||cloudUser.id);
    if(preferred)staff.value=preferred;
    wrap.style.display=isManager()?'':'none';

    document.getElementById('mapRouteDealerName').textContent=dealer.name+(dealer.district?' • '+dealer.district:'');
    const current=[];
    if(dealer.plannedWeek&&dealer.plannedDay)current.push('Rut Planı: '+dealer.plannedWeek+' • '+dealer.plannedDay+(dealer.plannedOrder?' • '+dealer.plannedOrder+'. sıra':''));
    document.getElementById('mapRouteCurrent').textContent=current.length?current.join('\n'):'Rut Planı içinde kayıtlı günü yok.';
    document.getElementById('mapRoutePlannerStatus').textContent='';
    document.getElementById('mapRoutePlannerDialog').showModal();
  }

  function closePlanner(){document.getElementById('mapRoutePlannerDialog')?.close();selectedDealerId=null;}

  async function fetchPlanRows(planType,staffId){
    const {data,error}=await supabaseClient.from('route_plan_templates')
      .select('week_no,day_name,dealer_ids')
      .eq('organization_id',teamContext.organizationId)
      .eq('plan_type',planType)
      .eq('staff_user_id',staffId);
    if(error)throw error;
    return data||[];
  }

  async function upsertRows(planType,staffId,rows){
    if(!rows.length)return;
    const now=new Date().toISOString();
    const payload=rows.map(r=>({
      organization_id:teamContext.organizationId,
      plan_type:planType,
      staff_user_id:staffId,
      week_no:Number(r.week_no),
      day_name:normDay(r.day_name),
      dealer_ids:r.dealer_ids||[],
      updated_by:cloudUser.id,
      updated_at:now
    }));
    const {error}=await supabaseClient.from('route_plan_templates').upsert(payload,{onConflict:'organization_id,plan_type,staff_user_id,week_no,day_name'});
    if(error)throw error;
  }

  function route1FallbackRows(staffId){
    const out=[];
    for(let week=1;week<=2;week++)for(const day of DAYS){
      const ids=(state.dealers||[])
        .filter(d=>d.isActive!==false&&d.assignedUserId===staffId&&d.plannedWeek===weekText(week)&&normDay(d.plannedDay)===day)
        .sort((a,b)=>(Number(a.plannedOrder)||999)-(Number(b.plannedOrder)||999))
        .map(d=>d.id);
      out.push({week_no:week,day_name:day,dealer_ids:ids});
    }
    return out;
  }

  async function syncLegacyRoute1(staffId,rows){
    const dealer=(state.dealers||[]).find(d=>d.id===selectedDealerId);if(!dealer)return;
    let target=null;
    for(const r of rows){
      const idx=(r.dealer_ids||[]).indexOf(selectedDealerId);
      if(idx>=0){target={week:Number(r.week_no),day:normDay(r.day_name),order:idx+1};break;}
    }
    const payload=target?
      {planned_week:weekText(target.week),planned_day:target.day,planned_order:target.order,assigned_user_id:staffId}:
      {planned_week:null,planned_day:null,planned_order:null,assigned_user_id:staffId};
    const {error}=await supabaseClient.from('organization_dealers')
      .update({...payload,updated_by:cloudUser.id,updated_at:new Date().toISOString()})
      .eq('organization_id',teamContext.organizationId).eq('id',selectedDealerId);
    if(error)throw error;
    dealer.plannedWeek=payload.planned_week;dealer.plannedDay=payload.planned_day;dealer.plannedOrder=payload.planned_order;dealer.assignedUserId=staffId;

    // Aynı günün sıralarını yerel + bulut tarafında tutarlı kıl.
    const targetRow=target?rows.find(r=>Number(r.week_no)===target.week&&normDay(r.day_name)===target.day):null;
    if(targetRow){
      for(let i=0;i<targetRow.dealer_ids.length;i++){
        const id=targetRow.dealer_ids[i],d=(state.dealers||[]).find(x=>x.id===id);if(!d)continue;
        d.plannedWeek=weekText(target.week);d.plannedDay=target.day;d.plannedOrder=i+1;
        if(id===selectedDealerId)continue;
        const {error:e}=await supabaseClient.from('organization_dealers')
          .update({planned_week:weekText(target.week),planned_day:target.day,planned_order:i+1,updated_by:cloudUser.id,updated_at:new Date().toISOString()})
          .eq('organization_id',teamContext.organizationId).eq('id',id);
        if(e)throw e;
      }
    }
  }

  async function save(){
    const dealer=(state.dealers||[]).find(d=>d.id===selectedDealerId);if(!dealer)return;
    const planType=document.getElementById('mapRoutePlanType')?.value||'ROUTE1';
    const staffId=document.getElementById('mapRouteStaff')?.value||cloudUser.id;
    const week=Number(document.getElementById('mapRouteWeek')?.value||1);
    const day=normDay(document.getElementById('mapRouteDay')?.value||'PAZARTESİ');
    if(!isManager()&&staffId!==cloudUser.id){alert('Yalnızca kendi rut planını düzenleyebilirsin.');return;}
    if(!isManager()&&dealer.assignedUserId&&dealer.assignedUserId!==cloudUser.id){alert('Bu bayi senin sorumluluğunda değil.');return;}

    const btn=document.getElementById('mapRouteSaveBtn'),status=document.getElementById('mapRoutePlannerStatus');
    if(btn)btn.disabled=true;if(status)status.textContent='Rut planı güncelleniyor…';
    try{
      let rows=await fetchPlanRows(planType,staffId);
      if(!rows.length&&planType==='ROUTE1')rows=route1FallbackRows(staffId);

      // 12 günlük iskeleti tamamla.
      for(let w=1;w<=2;w++)for(const d of DAYS){
        if(!rows.some(r=>Number(r.week_no)===w&&normDay(r.day_name)===d))rows.push({week_no:w,day_name:d,dealer_ids:[]});
      }

      // Aynı plan içinde bayiyi tüm eski günlerden çıkar.
      rows.forEach(r=>{r.dealer_ids=(r.dealer_ids||[]).filter(id=>id!==selectedDealerId);});
      const target=rows.find(r=>Number(r.week_no)===week&&normDay(r.day_name)===day);
      target.dealer_ids.push(selectedDealerId);

      await upsertRows(planType,staffId,rows);
      if(planType==='ROUTE1')await syncLegacyRoute1(staffId,rows);

      if(typeof logActivity==='function'){
        try{await logActivity('ROUTE_TEMPLATE_UPDATED','DEALER',selectedDealerId,{action:'MAP_ADD_TO_DAY',planType,staffId,week,day});}catch(_){ }
      }
      try{localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){ }
      if(typeof renderAll==='function')renderAll();
      if(planType==='ROUTE2'&&staffId===cloudUser.id&&typeof refreshRoutePlan2Templates==='function')await refreshRoutePlan2Templates();

      if(status)status.textContent='Eklendi: '+week+'. Hafta • '+day+' • '+staffName(staffId);
      alert(dealer.name+' → '+(planType==='ROUTE1'?'Rut Planı':'Rut Planı2')+' / '+week+'. Hafta / '+day+' gününe eklendi.');
      closePlanner();
    }catch(err){
      console.error('Map route add failed',err);
      const msg=String(err?.message||err);
      if(status)status.textContent='Eklenemedi: '+msg;
      alert(msg.includes('route_plan_templates')?'Rut planı tablosu hazır değil. Supabase’de supabase-team-phase11-route-plan-editor.sql dosyasını çalıştır.':'Bayi rut planına eklenemedi: '+msg);
    }finally{if(btn)btn.disabled=false;}
  }

  function popupHtml(d){
    const loc=d.locationStatus==='verified'?'Doğrulandı':d.locationStatus==='estimated'?'Tahmini':'Konum';
    const current=d.plannedWeek&&d.plannedDay?'<div class="muted" style="margin-top:4px">Rut Planı: '+esc(d.plannedWeek)+' • '+esc(d.plannedDay)+'</div>':'';
    return '<div class="map-route-popup"><strong>'+esc(d.name)+'</strong><div>'+esc(d.district||'')+' • '+esc(loc)+'</div>'+current+'<div class="mrp-actions"><button class="mrp-btn" type="button" onclick="openMapRoutePlanner(\''+esc(d.id)+'\')">＋ Rut Planına Ekle</button></div></div>';
  }

  function enhancedRenderMap(){
    if(!map)return;
    mainMarkers.forEach(m=>{try{map.removeLayer(m)}catch(_){}});mainMarkers=[];
    const home=L.marker([state.home.lat,state.home.lng]).addTo(map).bindPopup('<strong>Ev</strong>');mainMarkers.push(home);
    const dealers=(state.dealers||[]).filter(d=>(typeof dealerVisibleToCurrentUser!=='function'||dealerVisibleToCurrentUser(d))&&isValidDealerCoordinate(d.lat,d.lng));
    dealers.forEach(d=>{
      const m=L.marker([d.lat,d.lng]).addTo(map).bindPopup(popupHtml(d),{maxWidth:300});
      mainMarkers.push(m);
    });
    const pts=[[state.home.lat,state.home.lng],...dealers.map(d=>[d.lat,d.lng])];
    // Harita ilk kez açıldığında kapsama oturur; kullanıcı zoom yaptıktan sonra render çağrıları görünümü bozmasın.
    if(pts.length>1&&!map._ilkeInitialDealerBoundsDone){map.fitBounds(pts,{padding:[30,30]});map._ilkeInitialDealerBoundsDone=true;}
  }

  function install(){
    if(typeof window.renderMap!=='function'||typeof window.map==='undefined')return false;
    ensureStyles();ensureDialog();
    if(!originalRenderMap)originalRenderMap=window.renderMap;
    window.renderMap=enhancedRenderMap;
    // Harita sekmesi açıksa popup'ları hemen yenile.
    if(document.getElementById('mapsec')?.classList.contains('active')){try{enhancedRenderMap();}catch(_){ }}
    return true;
  }

  window.openMapRoutePlanner=openPlanner;
  window.closeMapRoutePlanner=closePlanner;
  window.saveDealerToRouteFromMap=save;

  function start(){clearInterval(installTimer);installTimer=setInterval(()=>{if(install())clearInterval(installTimer);},150);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
