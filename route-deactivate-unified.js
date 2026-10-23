// İlke Saha - Rut Planı / Rut Planı2 ortak "Rut Dışı Bırak" akışı
// Tek bayi kaydını ve ilgili route_plan_templates satırlarını hedefli günceller.
// Geniş persist()/cloud sync tetiklemez; aktif ekranı korur.
(()=>{
  let busy=false;

  function ready(){
    return typeof state!=='undefined'&&Array.isArray(state.dealers)&&
      typeof supabaseClient!=='undefined'&&supabaseClient&&
      typeof teamContext!=='undefined'&&teamContext?.organizationId&&
      typeof cloudUser!=='undefined'&&cloudUser;
  }

  function dealerById(id){return (state.dealers||[]).find(d=>d.id===id)||null;}

  function saveLocalOnly(){
    try{if(typeof storeKey!=='undefined')localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){ }
  }

  function removeFromLocalDrafts(id){
    if(Array.isArray(state.todayRoute))state.todayRoute=state.todayRoute.filter(x=>x!==id);
    try{
      const K='ilkeSahaRoute2DraftsV4';
      const all=JSON.parse(localStorage.getItem(K)||'{}')||{};
      Object.keys(all).forEach(k=>{
        const draft=all[k];
        if(!Array.isArray(draft?.items))return;
        draft.items=draft.items.filter(x=>x.dealerId!==id);
        draft.updatedAt=new Date().toISOString();
      });
      localStorage.setItem(K,JSON.stringify(all));
    }catch(_){ }
  }

  async function removeFromTemplates(id,now){
    const {data,error}=await supabaseClient.from('route_plan_templates')
      .select('organization_id,plan_type,staff_user_id,week_no,day_name,dealer_ids,updated_by,updated_at')
      .eq('organization_id',teamContext.organizationId);
    if(error)throw new Error('Rut şablonları okunamadı: '+error.message);

    const changed=(data||[])
      .filter(r=>Array.isArray(r.dealer_ids)&&r.dealer_ids.includes(id))
      .map(r=>({
        organization_id:r.organization_id,
        plan_type:r.plan_type,
        staff_user_id:r.staff_user_id,
        week_no:r.week_no,
        day_name:r.day_name,
        dealer_ids:r.dealer_ids.filter(x=>x!==id),
        updated_by:cloudUser.id,
        updated_at:now
      }));

    if(!changed.length)return 0;
    const {error:upErr}=await supabaseClient.from('route_plan_templates')
      .upsert(changed,{onConflict:'organization_id,plan_type,staff_user_id,week_no,day_name'});
    if(upErr)throw new Error('Rut şablonları güncellenemedi: '+upErr.message);
    return changed.length;
  }

  function refreshWithoutNavigation(){
    // Aktif section/class durumuna dokunmadan sadece ilgili içerikleri yenile.
    try{if(typeof renderRoute==='function')renderRoute();}catch(err){console.warn('Rut görünümü yenilenemedi',err);}
    try{if(typeof renderMap==='function')renderMap();}catch(_){ }
    try{if(typeof window.renderRoute2==='function')window.renderRoute2();}catch(_){ }
    try{if(typeof window.renderRoute2Workspace==='function')window.renderRoute2Workspace();}catch(_){ }
    try{if(typeof window.refreshMapRouteLivePanel==='function')window.refreshMapRouteLivePanel();}catch(_){ }
    try{if(typeof window.refreshMapRoutePinStatus==='function')window.refreshMapRoutePinStatus();}catch(_){ }
    try{if(typeof renderInactiveDealers==='function')renderInactiveDealers();}catch(_){ }
    try{if(typeof window.prepareRoutePlanner==='function'&&document.getElementById('routePlanner')?.classList.contains('active'))window.prepareRoutePlanner();}catch(_){ }
  }

  async function deactivate(id,source='ROUTE'){
    if(busy||!ready())return;
    const d=dealerById(id);
    if(!d||d.isActive===false)return;

    const ok=confirm(d.name+' rut dışı bırakılsın mı?\n\nBayi ve geçmiş kayıtları silinmez. Bayi aktif rutlardan, rut şablonlarından ve harita görünümünden çıkarılır.');
    if(!ok)return;

    busy=true;
    const activeSection=document.querySelector('.section.active')?.id||null;
    try{
      const now=new Date().toISOString();

      // Önce bayi master kaydını tek satır olarak güncelle.
      const {error}=await supabaseClient.from('organization_dealers')
        .update({
          is_active:false,
          planned_week:null,
          planned_day:null,
          planned_order:null,
          updated_by:cloudUser.id,
          updated_at:now
        })
        .eq('organization_id',teamContext.organizationId)
        .eq('id',id);
      if(error)throw new Error('Bayi güncellenemedi: '+error.message);

      // Ardından iki plan tipindeki tüm şablonlardan yalnızca bu bayi id'sini çıkar.
      let templateWarning=null;
      try{await removeFromTemplates(id,now);}catch(err){templateWarning=err;console.warn(err);}

      // Bulut işlemi bittikten sonra local state'i eşitle; persist() çağırma.
      d.isActive=false;
      d.plannedWeek=null;
      d.plannedDay=null;
      d.plannedOrder=null;
      removeFromLocalDrafts(id);
      saveLocalOnly();

      try{
        if(typeof logActivity==='function')await logActivity('DEALER_DEACTIVATED','DEALER',id,{source});
      }catch(_){ }

      refreshWithoutNavigation();

      // Bir başka render fonksiyonu section class'ını etkilediyse mevcut ekranı geri getir.
      if(activeSection){
        const sec=document.getElementById(activeSection);
        if(sec&&!sec.classList.contains('active')){
          document.querySelectorAll('.section').forEach(x=>x.classList.remove('active'));
          sec.classList.add('active');
          const btn=document.querySelector('nav button[data-section="'+activeSection+'"]');
          if(btn){document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');}
        }
      }

      if(templateWarning){
        alert('Bayi rut dışı bırakıldı; ancak rut şablonlarının bir kısmı güncellenemedi. Ekran bozulmadı. Ayrıntı: '+templateWarning.message);
      }
    }catch(err){
      console.error('Rut dışı bırakma başarısız',err);
      alert('Bayi rut dışı bırakılamadı: '+(err?.message||err));
    }finally{
      busy=false;
    }
  }

  window.deactivateDealerFromRoute=id=>deactivate(id,'ROUTE1');
  window.deactivateRoute2Dealer=id=>deactivate(id,'ROUTE2');
})();
