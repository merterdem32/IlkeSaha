// İlke Saha - Haritada plan kurarken görünümü koru + canlı 2 haftalık plan paneli
(()=>{
  const DAYS=['PAZARTESİ','SALI','ÇARŞAMBA','PERŞEMBE','CUMA','CUMARTESİ'];
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=v=>String(v||'').trim().toLocaleUpperCase('tr-TR');
  const weekText=n=>Number(n)===2?'2. HAFTA':'1. HAFTA';
  let savedView=null;
  let originalOpen=null;
  let installTimer=null;

  function ready(){return typeof cloudUser!=='undefined'&&cloudUser&&typeof teamContext!=='undefined'&&teamContext?.organizationId&&typeof supabaseClient!=='undefined'&&supabaseClient;}
  function isManager(){return teamContext?.role==='MANAGER';}

  function saveMapView(){
    try{if(typeof map!=='undefined'&&map){const c=map.getCenter();savedView={lat:c.lat,lng:c.lng,zoom:map.getZoom()};}}catch(_){ }
  }
  function restoreMapView(){
    if(!savedView)return;
    const view={...savedView};
    const apply=()=>{try{if(typeof map!=='undefined'&&map){map.invalidateSize({pan:false,animate:false});map.setView([view.lat,view.lng],view.zoom,{animate:false});}}catch(_){ }};
    requestAnimationFrame(()=>requestAnimationFrame(apply));setTimeout(apply,120);
  }

  function ensureStyles(){
    if(document.getElementById('mapRouteLivePanelStyles'))return;
    const s=document.createElement('style');s.id='mapRouteLivePanelStyles';s.textContent=`
      #mapsec .split{grid-template-columns:minmax(0,2.2fr) minmax(300px,.8fr)!important;align-items:start}
      .map-route-workspace{display:grid!important;grid-template-columns:minmax(0,2fr) minmax(330px,1fr);gap:14px;align-items:start}
      .map-route-workspace>#mapRouteLiveInfo,.map-route-workspace>h3,.map-route-workspace>h3+.muted{grid-column:1/-1}
      .map-route-workspace>#map{grid-column:1;grid-row:auto;display:block!important;width:100%!important;min-width:0!important;height:620px!important;min-height:620px!important}
      #mapRouteLivePanel{grid-column:2;border:1px solid var(--brand-border);border-radius:12px;background:#fff;padding:12px;max-height:620px;overflow:auto;min-width:0}
      #mapRouteLivePanel h3{margin:0 0 8px}.mrl-day{border-top:1px solid #eef0f3;padding:9px 0}.mrl-day:first-of-type{border-top:0}
      .mrl-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:5px}.mrl-head-actions{display:flex;gap:5px;align-items:center;flex-wrap:wrap}
      .mrl-item{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:6px;align-items:center;font-size:13px;padding:5px 0;border-top:1px dashed #eef0f3}.mrl-item:first-of-type{border-top:0}
      .mrl-actions{display:flex;gap:4px}.mrl-actions .btn{padding:5px 7px;min-height:30px}.mrl-empty{font-size:12px;color:#94a3b8}
      @media(max-width:1100px){.map-route-workspace{grid-template-columns:1fr}.map-route-workspace>#map{grid-column:1;height:520px!important;min-height:520px!important}#mapRouteLivePanel{grid-column:1;max-height:none}}
      @media(max-width:850px){#mapsec .split{grid-template-columns:1fr!important}.map-route-workspace>#map{height:440px!important;min-height:440px!important}.mrl-item{grid-template-columns:26px minmax(0,1fr)}.mrl-actions{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr)}}
    `;document.head.appendChild(s);
  }

  async function ensureStaffOptions(){
    const sel=document.getElementById('mapRouteLiveStaff');if(!sel)return;
    if(!isManager()){sel.innerHTML='<option value="'+esc(cloudUser.id)+'">Ben</option>';sel.style.display='none';return;}
    try{if(typeof loadManagerDirectory==='function')await loadManagerDirectory();}catch(_){ }
    const ms=(typeof managerDirectoryCache!=='undefined'&&managerDirectoryCache?.members)||[];
    const ps=(typeof managerDirectoryCache!=='undefined'&&managerDirectoryCache?.profiles)||new Map();
    const rows=ms.filter(x=>x.role==='FIELD_STAFF'&&x.is_active!==false).map(x=>{const p=ps.get(x.user_id)||{};return{id:x.user_id,label:p.full_name||p.username||p.email||x.user_id};});
    const prev=sel.value;sel.innerHTML=rows.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.label)+'</option>').join('');if(prev&&rows.some(x=>x.id===prev))sel.value=prev;sel.style.display='';
  }

  function ensurePanel(){
    const mapEl=document.getElementById('map');if(!mapEl||document.getElementById('mapRouteLivePanel'))return false;
    ensureStyles();const card=mapEl.parentElement;if(!card)return false;card.classList.add('map-route-workspace');
    const h3=card.querySelector(':scope > h3');if(h3)h3.id='mapRouteLiveInfo';
    const panel=document.createElement('div');panel.id='mapRouteLivePanel';panel.innerHTML=`<div class="toolbar" style="justify-content:space-between;align-items:center;margin:0 0 8px"><div><h3>Rut Planı Kurgusu</h3><div class="muted">Haritadan eklediklerin burada anında görünür. Buradan çıkarabilir ve sıralayabilirsin.</div></div></div><div class="row" style="margin-bottom:8px"><select id="mapRouteLivePlan"><option value="ROUTE1">Rut Planı</option><option value="ROUTE2">Rut Planı2</option></select><select id="mapRouteLiveStaff"></select></div><div id="mapRouteLiveBody" class="muted">Plan yükleniyor…</div>`;
    card.appendChild(panel);
    document.getElementById('mapRouteLivePlan')?.addEventListener('change',refreshPanel);document.getElementById('mapRouteLiveStaff')?.addEventListener('change',refreshPanel);
    ensureStaffOptions().then(refreshPanel);setTimeout(()=>{try{map?.invalidateSize({pan:false});}catch(_){}},80);return true;
  }

  function dealerName(id){return (state.dealers||[]).find(d=>d.id===id)?.name||'Bilinmeyen bayi';}
  function fallbackRoute1(staffId){
    const rows=[];for(const week of [1,2])for(const day of DAYS){const ids=(state.dealers||[]).filter(d=>d.isActive!==false&&d.assignedUserId===staffId&&String(d.plannedWeek||'')===week+'. HAFTA'&&norm(d.plannedDay)===day).sort((a,b)=>(Number(a.plannedOrder)||999)-(Number(b.plannedOrder)||999)).map(d=>d.id);rows.push({week_no:week,day_name:day,dealer_ids:ids});}return rows;
  }

  async function loadRows(planType,staffId){
    const {data,error}=await supabaseClient.from('route_plan_templates').select('week_no,day_name,dealer_ids').eq('organization_id',teamContext.organizationId).eq('plan_type',planType).eq('staff_user_id',staffId);if(error)throw error;
    let rows=data||[];if(!rows.length&&planType==='ROUTE1')rows=fallbackRoute1(staffId);
    const byKey=new Map(rows.map(r=>[Number(r.week_no)+'|'+norm(r.day_name),Array.isArray(r.dealer_ids)?r.dealer_ids.slice():[]]));
    for(const w of [1,2])for(const d of DAYS){const k=w+'|'+d;if(!byKey.has(k))byKey.set(k,[]);}return byKey;
  }

  async function writeRows(planType,staffId,byKey){
    const now=new Date().toISOString();const payload=[];
    for(const w of [1,2])for(const d of DAYS)payload.push({organization_id:teamContext.organizationId,plan_type:planType,staff_user_id:staffId,week_no:w,day_name:d,dealer_ids:byKey.get(w+'|'+d)||[],updated_by:cloudUser.id,updated_at:now});
    const {error}=await supabaseClient.from('route_plan_templates').upsert(payload,{onConflict:'organization_id,plan_type,staff_user_id,week_no,day_name'});if(error)throw error;
    if(planType==='ROUTE1'){
      const placement=new Map();for(const w of [1,2])for(const d of DAYS)(byKey.get(w+'|'+d)||[]).forEach((id,i)=>placement.set(id,{w,d,order:i+1}));
      const mine=(state.dealers||[]).filter(x=>x.assignedUserId===staffId);
      for(const dealer of mine){
        const p=placement.get(dealer.id);const oldPlanned=!!dealer.plannedWeek;
        if(!p&&!oldPlanned)continue;
        const values=p?{planned_week:weekText(p.w),planned_day:p.d,planned_order:p.order}:{planned_week:null,planned_day:null,planned_order:null};
        const {error:e}=await supabaseClient.from('organization_dealers').update({...values,updated_by:cloudUser.id,updated_at:now}).eq('organization_id',teamContext.organizationId).eq('id',dealer.id);if(e)throw e;
        dealer.plannedWeek=values.planned_week;dealer.plannedDay=values.planned_day;dealer.plannedOrder=values.planned_order;
      }
      try{localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){ }if(typeof renderAll==='function')renderAll();
    }else if(staffId===cloudUser.id&&typeof refreshRoutePlan2Templates==='function'){try{await refreshRoutePlan2Templates();}catch(_){ }}
  }

  async function mutateDay(week,day,action,index){
    if(!ready())return;const planType=document.getElementById('mapRouteLivePlan')?.value||'ROUTE1';const staffId=document.getElementById('mapRouteLiveStaff')?.value||cloudUser.id;if(!isManager()&&staffId!==cloudUser.id)return;
    saveMapView();
    try{
      const byKey=await loadRows(planType,staffId),key=Number(week)+'|'+norm(day),ids=(byKey.get(key)||[]).slice();
      if(action==='clear'){if(!ids.length)return;if(!confirm(week+'. Hafta '+day+' günündeki tüm bayiler plandan çıkarılsın mı?'))return;ids.splice(0,ids.length);}
      else if(action==='remove'){const d=dealerName(ids[index]);if(!ids[index])return;if(!confirm(d+' bu günden çıkarılsın mı?'))return;ids.splice(index,1);}
      else if(action==='up'&&index>0){[ids[index-1],ids[index]]=[ids[index],ids[index-1]];}
      else if(action==='down'&&index<ids.length-1){[ids[index+1],ids[index]]=[ids[index],ids[index+1]];} else if(action!=='clear'&&action!=='remove')return;
      byKey.set(key,ids);await writeRows(planType,staffId,byKey);await refreshPanel();restoreMapView();
    }catch(err){console.error('Map live plan edit failed',err);alert('Plan düzenlenemedi: '+(err?.message||err));}
  }

  async function refreshPanel(){
    if(!ready()||!document.getElementById('mapRouteLiveBody'))return;await ensureStaffOptions();
    const planType=document.getElementById('mapRouteLivePlan')?.value||'ROUTE1',staffId=document.getElementById('mapRouteLiveStaff')?.value||cloudUser.id,body=document.getElementById('mapRouteLiveBody');body.textContent='Plan yükleniyor…';
    try{
      const byKey=await loadRows(planType,staffId);
      body.innerHTML=[1,2].flatMap(week=>DAYS.map(day=>{const ids=byKey.get(week+'|'+day)||[];return '<div class="mrl-day"><div class="mrl-head"><strong>'+week+'. Hafta • '+day.charAt(0)+day.slice(1).toLocaleLowerCase('tr-TR')+'</strong><div class="mrl-head-actions"><span class="badge b-info">'+ids.length+' bayi</span>'+(ids.length?'<button class="btn btn-danger" type="button" onclick="mapRouteLiveMutate('+week+',\''+day+'\',\'clear\',-1)">Günü Temizle</button>':'')+'</div></div>'+(ids.length?ids.map((id,i)=>'<div class="mrl-item"><div>'+(i+1)+'.</div><div>'+esc(dealerName(id))+'</div><div class="mrl-actions"><button class="btn btn-ghost" type="button" '+(i===0?'disabled':'')+' onclick="mapRouteLiveMutate('+week+',\''+day+'\',\'up\','+i+')">↑</button><button class="btn btn-ghost" type="button" '+(i===ids.length-1?'disabled':'')+' onclick="mapRouteLiveMutate('+week+',\''+day+'\',\'down\','+i+')">↓</button><button class="btn btn-danger" type="button" onclick="mapRouteLiveMutate('+week+',\''+day+'\',\'remove\','+i+')">Çıkar</button></div></div>').join(''):'<div class="mrl-empty">Bayi yok</div>')+'</div>'; })).join('');
    }catch(err){body.textContent='Plan yüklenemedi: '+(err?.message||err);}
  }

  function patchOpen(){if(originalOpen||typeof window.openMapRouteAdd!=='function')return false;originalOpen=window.openMapRouteAdd;window.openMapRouteAdd=function(){saveMapView();return originalOpen.apply(this,arguments);};return true;}
  function bindDialog(){const d=document.getElementById('mapRouteAddDialog');if(!d||d.dataset.livePanelBound)return;d.dataset.livePanelBound='1';d.addEventListener('close',()=>{restoreMapView();setTimeout(refreshPanel,80);});}
  function install(){if(!ready())return false;ensurePanel();patchOpen();bindDialog();return !!document.getElementById('mapRouteLivePanel');}
  function start(){clearInterval(installTimer);let tries=0;installTimer=setInterval(()=>{tries++;if(install()||tries>120){clearInterval(installTimer);installTimer=null;}},100);}
  document.addEventListener('click',e=>{if(e.target?.closest?.('nav button[data-section="mapsec"]'))setTimeout(()=>{install();refreshPanel();try{map?.invalidateSize({pan:false});}catch(_){}},180);},true);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(()=>{install();refreshPanel();},180);});
  window.mapRouteLiveMutate=mutateDay;window.refreshMapRouteLivePanel=refreshPanel;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
