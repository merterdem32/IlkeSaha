// İlke Saha - Haritada plan kurarken görünümü koru + canlı 2 haftalık plan paneli
(()=>{
  const DAYS=['PAZARTESİ','SALI','ÇARŞAMBA','PERŞEMBE','CUMA','CUMARTESİ'];
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=v=>String(v||'').trim().toLocaleUpperCase('tr-TR');
  let savedView=null;
  let originalOpen=null;
  let installTimer=null;

  function ready(){return typeof cloudUser!=='undefined'&&cloudUser&&typeof teamContext!=='undefined'&&teamContext?.organizationId&&typeof supabaseClient!=='undefined'&&supabaseClient;}
  function isManager(){return teamContext?.role==='MANAGER';}

  function saveMapView(){
    try{
      if(typeof map!=='undefined'&&map){
        const c=map.getCenter();
        savedView={lat:c.lat,lng:c.lng,zoom:map.getZoom()};
      }
    }catch(_){ }
  }

  function restoreMapView(){
    if(!savedView)return;
    const view={...savedView};
    const apply=()=>{
      try{
        if(typeof map!=='undefined'&&map){
          map.invalidateSize({pan:false,animate:false});
          map.setView([view.lat,view.lng],view.zoom,{animate:false});
        }
      }catch(_){ }
    };
    requestAnimationFrame(()=>requestAnimationFrame(apply));
    setTimeout(apply,120);
  }

  function ensureStyles(){
    if(document.getElementById('mapRouteLivePanelStyles'))return;
    const s=document.createElement('style');
    s.id='mapRouteLivePanelStyles';
    s.textContent=`
      .map-route-workspace{display:grid!important;grid-template-columns:minmax(0,2fr) minmax(300px,1fr);gap:14px;align-items:start}
      .map-route-workspace>#mapRouteLiveInfo{grid-column:1/-1}
      #mapRouteLivePanel{border:1px solid var(--brand-border);border-radius:12px;background:#fff;padding:12px;max-height:620px;overflow:auto}
      #mapRouteLivePanel h3{margin:0 0 8px}
      .mrl-day{border-top:1px solid #eef0f3;padding:9px 0}
      .mrl-day:first-of-type{border-top:0}
      .mrl-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:5px}
      .mrl-item{font-size:13px;padding:3px 0}
      .mrl-empty{font-size:12px;color:#94a3b8}
      @media(max-width:850px){.map-route-workspace{grid-template-columns:1fr}.map-route-workspace>#mapRouteLiveInfo{grid-column:1}.map-route-workspace>#map{min-height:420px}#mapRouteLivePanel{max-height:none}}
    `;
    document.head.appendChild(s);
  }

  async function ensureStaffOptions(){
    const sel=document.getElementById('mapRouteLiveStaff');if(!sel)return;
    if(!isManager()){
      sel.innerHTML='<option value="'+esc(cloudUser.id)+'">Ben</option>';
      sel.style.display='none';
      return;
    }
    try{if(typeof loadManagerDirectory==='function')await loadManagerDirectory();}catch(_){ }
    const ms=(typeof managerDirectoryCache!=='undefined'&&managerDirectoryCache?.members)||[];
    const ps=(typeof managerDirectoryCache!=='undefined'&&managerDirectoryCache?.profiles)||new Map();
    const rows=ms.filter(x=>x.role==='FIELD_STAFF'&&x.is_active!==false).map(x=>{const p=ps.get(x.user_id)||{};return{id:x.user_id,label:p.full_name||p.username||p.email||x.user_id};});
    const prev=sel.value;
    sel.innerHTML=rows.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.label)+'</option>').join('');
    if(prev&&rows.some(x=>x.id===prev))sel.value=prev;
    sel.style.display='';
  }

  function ensurePanel(){
    const mapEl=document.getElementById('map');if(!mapEl||document.getElementById('mapRouteLivePanel'))return false;
    ensureStyles();
    const card=mapEl.parentElement;if(!card)return false;
    card.classList.add('map-route-workspace');
    const info=document.createElement('div');info.id='mapRouteLiveInfo';
    const oldInfo=[...card.children].find(x=>x!==mapEl&&x.id!=='mapRouteLivePanel');
    if(oldInfo)oldInfo.id='mapRouteLiveInfo';else card.insertBefore(info,mapEl);
    const panel=document.createElement('div');panel.id='mapRouteLivePanel';
    panel.innerHTML=`<div class="toolbar" style="justify-content:space-between;align-items:center;margin:0 0 8px">
      <div><h3>Rut Planı Kurgusu</h3><div class="muted">Haritadan eklediklerin burada anında görünür.</div></div>
    </div>
    <div class="row" style="margin-bottom:8px">
      <select id="mapRouteLivePlan"><option value="ROUTE1">Rut Planı</option><option value="ROUTE2">Rut Planı2</option></select>
      <select id="mapRouteLiveStaff"></select>
    </div>
    <div id="mapRouteLiveBody" class="muted">Plan yükleniyor…</div>`;
    card.appendChild(panel);
    document.getElementById('mapRouteLivePlan')?.addEventListener('change',refreshPanel);
    document.getElementById('mapRouteLiveStaff')?.addEventListener('change',refreshPanel);
    ensureStaffOptions().then(refreshPanel);
    return true;
  }

  function dealerName(id){return (state.dealers||[]).find(d=>d.id===id)?.name||'Bilinmeyen bayi';}

  function fallbackRoute1(staffId){
    const rows=[];
    for(const week of [1,2])for(const day of DAYS){
      const ids=(state.dealers||[])
        .filter(d=>d.isActive!==false&&d.assignedUserId===staffId&&String(d.plannedWeek||'')===week+'. HAFTA'&&norm(d.plannedDay)===day)
        .sort((a,b)=>(Number(a.plannedOrder)||999)-(Number(b.plannedOrder)||999)).map(d=>d.id);
      rows.push({week_no:week,day_name:day,dealer_ids:ids});
    }
    return rows;
  }

  async function refreshPanel(){
    if(!ready()||!document.getElementById('mapRouteLiveBody'))return;
    await ensureStaffOptions();
    const planType=document.getElementById('mapRouteLivePlan')?.value||'ROUTE1';
    const staffId=document.getElementById('mapRouteLiveStaff')?.value||cloudUser.id;
    const body=document.getElementById('mapRouteLiveBody');
    body.textContent='Plan yükleniyor…';
    try{
      const {data,error}=await supabaseClient.from('route_plan_templates')
        .select('week_no,day_name,dealer_ids')
        .eq('organization_id',teamContext.organizationId)
        .eq('plan_type',planType)
        .eq('staff_user_id',staffId);
      if(error)throw error;
      let rows=data||[];
      if(!rows.length&&planType==='ROUTE1')rows=fallbackRoute1(staffId);
      const byKey=new Map(rows.map(r=>[Number(r.week_no)+'|'+norm(r.day_name),Array.isArray(r.dealer_ids)?r.dealer_ids:[]]));
      body.innerHTML=[1,2].flatMap(week=>DAYS.map(day=>{
        const ids=byKey.get(week+'|'+day)||[];
        return '<div class="mrl-day"><div class="mrl-head"><strong>'+week+'. Hafta • '+day.charAt(0)+day.slice(1).toLocaleLowerCase('tr-TR')+'</strong><span class="badge b-info">'+ids.length+' bayi</span></div>'+
          (ids.length?ids.map((id,i)=>'<div class="mrl-item">'+(i+1)+'. '+esc(dealerName(id))+'</div>').join(''):'<div class="mrl-empty">Bayi yok</div>')+'</div>';
      })).join('');
    }catch(err){
      body.textContent='Plan yüklenemedi: '+(err?.message||err);
    }
  }

  function patchOpen(){
    if(originalOpen||typeof window.openMapRouteAdd!=='function')return false;
    originalOpen=window.openMapRouteAdd;
    window.openMapRouteAdd=function(){saveMapView();return originalOpen.apply(this,arguments);};
    return true;
  }

  function bindDialog(){
    const d=document.getElementById('mapRouteAddDialog');if(!d||d.dataset.livePanelBound)return;
    d.dataset.livePanelBound='1';
    d.addEventListener('close',()=>{
      restoreMapView();
      setTimeout(refreshPanel,80);
    });
  }

  function install(){
    if(!ready())return false;
    ensurePanel();patchOpen();bindDialog();
    return !!document.getElementById('mapRouteLivePanel');
  }

  function start(){
    clearInterval(installTimer);let tries=0;
    installTimer=setInterval(()=>{tries++;if(install()||tries>120){clearInterval(installTimer);installTimer=null;}},100);
  }

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('nav button[data-section="mapsec"]'))setTimeout(()=>{install();refreshPanel();},180);
  },true);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(()=>{install();refreshPanel();},180);});

  window.refreshMapRouteLivePanel=refreshPanel;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
