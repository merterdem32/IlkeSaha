// İlke Saha - Harita pininden Rut Planı / Rut Planı2 gününe bayi ekleme
(()=>{
  const DAYS=['PAZARTESİ','SALI','ÇARŞAMBA','PERŞEMBE','CUMA','CUMARTESİ'];
  let selectedDealerId=null;
  let originalRenderMap=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=v=>String(v||'').trim().toLocaleUpperCase('tr-TR');
  const weekText=n=>Number(n)===2?'2. HAFTA':'1. HAFTA';

  function ready(){return typeof cloudUser!=='undefined'&&cloudUser&&typeof teamContext!=='undefined'&&teamContext?.organizationId&&typeof supabaseClient!=='undefined'&&supabaseClient;}
  function isManager(){return teamContext?.role==='MANAGER';}

  function ensureUi(){
    if(document.getElementById('mapRouteAddDialog'))return;
    const d=document.createElement('dialog');
    d.id='mapRouteAddDialog';
    d.innerHTML=`<div class="modal" style="max-width:560px">
      <div class="toolbar" style="justify-content:space-between;align-items:center">
        <div><h2 style="margin:0">Rut Planına Ekle</h2><div id="mapRouteDealerInfo" class="muted"></div></div>
        <button class="btn btn-ghost" type="button" onclick="mapRouteAddClose()">Kapat</button>
      </div>
      <div class="row">
        <div><label>Plan</label><select id="mapRoutePlanType"><option value="ROUTE1">Rut Planı</option><option value="ROUTE2">Rut Planı2</option></select></div>
        <div><label>Hafta</label><select id="mapRouteWeek"><option value="1">1. Hafta</option><option value="2">2. Hafta</option></select></div>
      </div>
      <label>Gün</label><select id="mapRouteDay">${DAYS.map(x=>'<option value="'+x+'">'+x.charAt(0)+x.slice(1).toLocaleLowerCase('tr-TR')+'</option>').join('')}</select>
      <div id="mapRouteAddStatus" class="note" style="margin-top:12px">Bayi seçilen günün sonuna eklenecek. Aynı planın başka günündeyse yeni güne taşınacak.</div>
      <button id="mapRouteAddSaveBtn" class="btn btn-primary" style="width:100%;margin-top:12px" type="button" onclick="mapRouteAddSave()">✓ Bu Güne Ekle</button>
    </div>`;
    document.body.appendChild(d);
  }

  function dealer(){return (state.dealers||[]).find(x=>x.id===selectedDealerId)||null;}

  function open(dealerId){
    if(!ready()){alert('Bulut bağlantısı henüz hazır değil.');return;}
    const d=(state.dealers||[]).find(x=>x.id===dealerId);if(!d)return;
    if(!isManager()&&d.assignedUserId&&d.assignedUserId!==cloudUser.id){alert('Bu bayi senin sorumluluğunda değil.');return;}
    selectedDealerId=dealerId;ensureUi();
    const info=document.getElementById('mapRouteDealerInfo');if(info)info.textContent=d.name+(d.district?' • '+d.district:'');
    const week=document.getElementById('mapRouteWeek'),day=document.getElementById('mapRouteDay'),plan=document.getElementById('mapRoutePlanType');
    if(d.plannedWeek&&week)week.value=String(d.plannedWeek).startsWith('2')?'2':'1';
    if(d.plannedDay&&day&&DAYS.includes(norm(d.plannedDay)))day.value=norm(d.plannedDay);
    if(plan)plan.value='ROUTE1';
    document.getElementById('mapRouteAddDialog')?.showModal();
  }

  function close(){document.getElementById('mapRouteAddDialog')?.close();selectedDealerId=null;}

  async function fetchRows(planType,staffId){
    const {data,error}=await supabaseClient.from('route_plan_templates')
      .select('week_no,day_name,dealer_ids')
      .eq('organization_id',teamContext.organizationId)
      .eq('plan_type',planType)
      .eq('staff_user_id',staffId);
    if(error)throw error;
    return data||[];
  }

  function fallbackRoute1(staffId){
    const rows=[];
    for(const week of [1,2])for(const day of DAYS){
      const ids=(state.dealers||[])
        .filter(x=>x.isActive!==false&&x.assignedUserId===staffId&&x.plannedWeek===weekText(week)&&norm(x.plannedDay)===day)
        .sort((a,b)=>(Number(a.plannedOrder)||999)-(Number(b.plannedOrder)||999)).map(x=>x.id);
      rows.push({week_no:week,day_name:day,dealer_ids:ids});
    }
    return rows;
  }

  async function save(){
    const d=dealer();if(!d)return;
    const staffId=d.assignedUserId||cloudUser.id;
    if(!isManager()&&staffId!==cloudUser.id){alert('Bu bayi senin sorumluluğunda değil.');return;}
    const planType=document.getElementById('mapRoutePlanType')?.value||'ROUTE1';
    const week=Number(document.getElementById('mapRouteWeek')?.value||1);
    const day=norm(document.getElementById('mapRouteDay')?.value||'PAZARTESİ');
    const btn=document.getElementById('mapRouteAddSaveBtn'),status=document.getElementById('mapRouteAddStatus');
    if(btn)btn.disabled=true;if(status)status.textContent='Plan güncelleniyor…';
    try{
      let rows=await fetchRows(planType,staffId);
      if(!rows.length&&planType==='ROUTE1')rows=fallbackRoute1(staffId);
      const byKey=new Map(rows.map(r=>[Number(r.week_no)+'|'+norm(r.day_name),Array.isArray(r.dealer_ids)?r.dealer_ids.slice():[]]));
      // Tüm 12 günden çıkar; sonra hedef günün sonuna ekle. Böylece kopya oluşmaz.
      for(const w of [1,2])for(const dy of DAYS){
        const k=w+'|'+dy,ids=byKey.get(k)||[];
        byKey.set(k,ids.filter(id=>id!==d.id));
      }
      const targetKey=week+'|'+day,target=byKey.get(targetKey)||[];target.push(d.id);byKey.set(targetKey,target);
      const now=new Date().toISOString();
      const payload=[];
      for(const w of [1,2])for(const dy of DAYS){payload.push({organization_id:teamContext.organizationId,plan_type:planType,staff_user_id:staffId,week_no:w,day_name:dy,dealer_ids:byKey.get(w+'|'+dy)||[],updated_by:cloudUser.id,updated_at:now});}
      const {error}=await supabaseClient.from('route_plan_templates').upsert(payload,{onConflict:'organization_id,plan_type,staff_user_id,week_no,day_name'});if(error)throw error;

      if(planType==='ROUTE1'){
        const targetIds=byKey.get(targetKey)||[];
        // Bayinin plan alanını yeni güne taşı ve hedef gün sırasını normalize et.
        const {error:e1}=await supabaseClient.from('organization_dealers').update({planned_week:weekText(week),planned_day:day,planned_order:targetIds.indexOf(d.id)+1,updated_by:cloudUser.id,updated_at:now}).eq('organization_id',teamContext.organizationId).eq('id',d.id);if(e1)throw e1;
        d.plannedWeek=weekText(week);d.plannedDay=day;d.plannedOrder=targetIds.indexOf(d.id)+1;
        for(let i=0;i<targetIds.length;i++){
          const x=(state.dealers||[]).find(z=>z.id===targetIds[i]);if(!x||x.id===d.id)continue;
          if(x.plannedWeek===weekText(week)&&norm(x.plannedDay)===day&&Number(x.plannedOrder)!==i+1){
            await supabaseClient.from('organization_dealers').update({planned_order:i+1,updated_by:cloudUser.id,updated_at:now}).eq('organization_id',teamContext.organizationId).eq('id',x.id);
            x.plannedOrder=i+1;
          }
        }
        try{localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){ }
        if(typeof renderAll==='function')renderAll();
      }else if(staffId===cloudUser.id&&typeof refreshRoutePlan2Templates==='function'){
        try{await refreshRoutePlan2Templates();}catch(_){ }
      }
      if(typeof logActivity==='function'){try{await logActivity('ROUTE_TEMPLATE_UPDATED','DEALER',d.id,{action:'MAP_ADD_TO_DAY',planType,week,day,staffId});}catch(_){ }}
      if(status)status.innerHTML='<span class="badge b-ok">Eklendi</span> '+week+'. Hafta '+day+' • '+(planType==='ROUTE1'?'Rut Planı':'Rut Planı2');
      setTimeout(()=>{document.getElementById('mapRouteAddDialog')?.close();selectedDealerId=null;},500);
    }catch(err){
      console.error('Map route add failed',err);
      const msg=String(err?.message||err);
      if(status)status.textContent='Eklenemedi: '+msg;
      alert(msg.includes('route_plan_templates')?'Rut planı tablosu hazır değil. Önce supabase-team-phase11-route-plan-editor.sql dosyasını Supabase’de çalıştır.':'Bayi plana eklenemedi: '+msg);
    }finally{if(btn)btn.disabled=false;}
  }

  function patchRenderMap(){
    if(originalRenderMap||typeof window.renderMap!=='function')return false;
    originalRenderMap=window.renderMap;
    window.renderMap=function(){
      if(!map)return originalRenderMap.apply(this,arguments);
      // Eski render'ın fitBounds/marker temizliği davranışını koruyup popup içeriğini zenginleştiriyoruz.
      originalRenderMap.apply(this,arguments);
      try{
        const dealers=(state.dealers||[]).filter(d=>(typeof dealerVisibleToCurrentUser!=='function'||dealerVisibleToCurrentUser(d))&&isValidDealerCoordinate(d.lat,d.lng));
        const dealerByCoord=new Map(dealers.map(d=>[Number(d.lat).toFixed(6)+'|'+Number(d.lng).toFixed(6),d]));
        (mainMarkers||[]).forEach(m=>{
          if(!m?.getLatLng)return;
          const p=m.getLatLng(),d=dealerByCoord.get(Number(p.lat).toFixed(6)+'|'+Number(p.lng).toFixed(6));
          if(!d)return;
          const planText=d.plannedWeek?(esc(d.plannedWeek)+' • '+esc(d.plannedDay||'')):'Henüz Rut Planı günü yok';
          m.bindPopup('<div style="min-width:210px"><strong>'+esc(d.name)+'</strong><br><span>'+esc(d.district||'')+'</span><br><span style="font-size:12px;color:#64748b">'+planText+'</span><div style="margin-top:9px"><button type="button" onclick="openMapRouteAdd(\''+d.id+'\')" style="width:100%;border:0;border-radius:9px;padding:9px 10px;background:#e30613;color:#fff;font-weight:800">+ Rut Planına Ekle</button></div></div>');
        });
      }catch(err){console.warn('Harita popup rut butonu eklenemedi',err);}
    };
    // Mevcut harita açıksa popup'ları hemen yenile.
    try{window.renderMap();}catch(_){ }
    return true;
  }

  function start(){ensureUi();let tries=0;const t=setInterval(()=>{tries++;if(patchRenderMap()||tries>80)clearInterval(t);},100);}
  window.openMapRouteAdd=open;
  window.mapRouteAddClose=close;
  window.mapRouteAddSave=save;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
