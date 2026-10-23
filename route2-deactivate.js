// İlke Saha - Rut Planı2 rut dışı bırakma
// Bayiyi pasife alır, Route1/Route2 şablonlarından ve günlük taslaklardan çıkarır.
(()=>{
  const K='ilkeSahaRoute2DraftsV4';
  let originalBySource=null,observer=null,timer=null,busy=false;

  function ready(){return typeof state!=='undefined'&&Array.isArray(state.dealers)&&typeof supabaseClient!=='undefined'&&supabaseClient&&typeof teamContext!=='undefined'&&teamContext?.organizationId;}
  function dealerById(id){return (state.dealers||[]).find(d=>d.id===id)||null;}
  function active(d){return !!d&&d.isActive!==false;}

  function patchSourceLookup(){
    if(originalBySource||typeof window.route2DealerBySource!=='function')return false;
    originalBySource=window.route2DealerBySource;
    window.route2DealerBySource=function(source){const d=originalBySource(source);return active(d)?d:null;};
    return true;
  }

  function sourceDealer(source){
    try{return typeof window.route2DealerBySource==='function'?window.route2DealerBySource(Number(source)):null;}catch(_){return null;}
  }

  function decorateRows(){
    document.querySelectorAll('#route2List .route-stop[data-route2-source]').forEach(row=>{
      const source=Number(row.dataset.route2Source),d=sourceDealer(source);
      if(!d){row.remove();return;}
      const toolbar=row.querySelector('.route-actions');if(!toolbar||toolbar.querySelector('.route2-deactivate-btn'))return;
      const b=document.createElement('button');b.type='button';b.className='btn btn-danger route2-deactivate-btn';b.textContent='Rut Dışı Bırak';
      b.onclick=()=>window.deactivateRoute2Dealer(d.id);
      toolbar.appendChild(b);
    });
  }

  function cleanDrafts(id){
    try{
      const all=JSON.parse(localStorage.getItem(K)||'{}')||{};
      Object.keys(all).forEach(k=>{
        const d=all[k];if(!Array.isArray(d?.items))return;
        d.items=d.items.filter(x=>x.dealerId!==id);
        d.updatedAt=new Date().toISOString();
      });
      localStorage.setItem(K,JSON.stringify(all));
    }catch(_){ }
    if(Array.isArray(state.todayRoute))state.todayRoute=state.todayRoute.filter(x=>x!==id);
  }

  async function removeFromTemplates(id){
    if(!ready())return;
    const {data,error}=await supabaseClient.from('route_plan_templates')
      .select('organization_id,plan_type,staff_user_id,week_no,day_name,dealer_ids,updated_by,updated_at')
      .eq('organization_id',teamContext.organizationId);
    if(error){console.warn('Rut şablonları okunamadı',error);return;}
    const changed=(data||[]).filter(r=>Array.isArray(r.dealer_ids)&&r.dealer_ids.includes(id)).map(r=>({
      organization_id:r.organization_id,plan_type:r.plan_type,staff_user_id:r.staff_user_id,week_no:r.week_no,day_name:r.day_name,
      dealer_ids:r.dealer_ids.filter(x=>x!==id),updated_by:cloudUser?.id||r.updated_by,updated_at:new Date().toISOString()
    }));
    if(!changed.length)return;
    const {error:upErr}=await supabaseClient.from('route_plan_templates').upsert(changed,{onConflict:'organization_id,plan_type,staff_user_id,week_no,day_name'});
    if(upErr)console.warn('Rut şablonlarından çıkarılamadı',upErr);
  }

  async function deactivate(id){
    if(busy||!ready())return;const d=dealerById(id);if(!d||d.isActive===false)return;
    if(!confirm(d.name+' rut dışı bırakılsın mı?\n\nBayi geçmişi silinmez; aktif rutlardan ve haritalardan kaldırılır.'))return;
    busy=true;
    try{
      const now=new Date().toISOString();
      const {error}=await supabaseClient.from('organization_dealers').update({is_active:false,planned_week:null,planned_day:null,planned_order:null,updated_by:cloudUser?.id||null,updated_at:now})
        .eq('organization_id',teamContext.organizationId).eq('id',id);
      if(error)throw error;
      d.isActive=false;d.plannedWeek=null;d.plannedDay=null;d.plannedOrder=null;
      cleanDrafts(id);
      try{await removeFromTemplates(id);}catch(err){console.warn(err);}
      try{localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){ }
      if(typeof logActivity==='function'){try{await logActivity('DEALER_DEACTIVATED','DEALER',id,{source:'ROUTE2'});}catch(_){ }}
      if(typeof renderAll==='function')renderAll();
      if(typeof window.renderRoute2==='function')window.renderRoute2();
      if(typeof window.renderRoute2Workspace==='function')setTimeout(()=>window.renderRoute2Workspace(),20);
      if(typeof window.refreshMapRouteLivePanel==='function')setTimeout(()=>window.refreshMapRouteLivePanel(),40);
      if(typeof window.refreshMapRoutePinStatus==='function')setTimeout(()=>window.refreshMapRoutePinStatus(),60);
      setTimeout(decorateRows,80);
    }catch(err){console.error('Route2 rut dışı bırakma başarısız',err);alert('Bayi rut dışı bırakılamadı: '+(err?.message||err));}
    finally{busy=false;}
  }

  function repair(){if(!ready())return;patchSourceLookup();decorateRows();}
  function start(){
    clearInterval(timer);let n=0;timer=setInterval(()=>{n++;repair();if(n>240){clearInterval(timer);timer=null;}},200);
    if(observer)observer.disconnect();observer=new MutationObserver(()=>{clearTimeout(window.__route2DeactivateDecorateTimer);window.__route2DeactivateDecorateTimer=setTimeout(decorateRows,30);});
    if(document.body)observer.observe(document.body,{childList:true,subtree:true});
  }

  window.deactivateRoute2Dealer=deactivate;
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(repair,100);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();