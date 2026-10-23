// İlke Saha - harita pinlerinde rut planı atama durumunu renk ile gösterir.
(()=>{
  const norm=v=>String(v||'').trim().toLocaleUpperCase('tr-TR');
  let installTimer=null;
  let originalRenderMap=null;

  function ready(){return typeof state!=='undefined'&&Array.isArray(state.dealers)&&typeof map!=='undefined'&&map&&typeof mainMarkers!=='undefined';}
  function isManager(){return typeof teamContext!=='undefined'&&teamContext?.role==='MANAGER';}

  function selectedPlanType(){return document.getElementById('mapRouteLivePlan')?.value||'ROUTE1';}
  function selectedStaffId(){
    if(isManager()){
      const live=document.getElementById('mapRouteLiveStaff')?.value;
      const filter=typeof window.getAdminMapSelectedStaff==='function'?window.getAdminMapSelectedStaff():window.adminMapSelectedStaff;
      return live||((filter&&filter!=='all')?filter:null);
    }
    return typeof cloudUser!=='undefined'?cloudUser?.id:null;
  }

  function dealerForMarker(marker){
    try{
      if(!marker?.getLatLng)return null;
      const p=marker.getLatLng();
      return (state.dealers||[]).find(d=>
        typeof isValidDealerCoordinate==='function'&&isValidDealerCoordinate(d.lat,d.lng)&&
        Math.abs(Number(d.lat)-Number(p.lat))<0.000001&&Math.abs(Number(d.lng)-Number(p.lng))<0.000001
      )||null;
    }catch(_){return null;}
  }

  function iconHtml(color,assigned){
    return '<div style="width:26px;height:34px;position:relative">'+
      '<div style="position:absolute;left:3px;top:1px;width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:'+color+';border:2px solid #fff;box-shadow:0 2px 7px rgba(0,0,0,.35)"></div>'+
      '<div style="position:absolute;left:9px;top:7px;width:8px;height:8px;border-radius:50%;background:#fff"></div>'+
      (assigned?'<div style="position:absolute;right:-4px;top:-5px;width:16px;height:16px;border-radius:50%;display:grid;place-items:center;background:#16a34a;color:#fff;border:2px solid #fff;font-size:10px;font-weight:900">✓</div>':'')+
      '</div>';
  }

  function makeIcon(assigned){
    if(typeof L==='undefined')return null;
    const color=assigned?'#16a34a':'#2563eb';
    return L.divIcon({className:'',html:iconHtml(color,assigned),iconSize:[26,34],iconAnchor:[13,32],popupAnchor:[0,-30]});
  }

  async function assignedSet(){
    const planType=selectedPlanType();
    const staffId=selectedStaffId();
    const set=new Set();
    if(!staffId)return set;

    try{
      if(planType==='ROUTE1'){
        (state.dealers||[]).forEach(d=>{
          if(d.assignedUserId===staffId&&d.plannedWeek&&d.plannedDay)set.add(d.id);
        });
      }
      if(typeof supabaseClient!=='undefined'&&supabaseClient&&typeof teamContext!=='undefined'&&teamContext?.organizationId){
        const {data,error}=await supabaseClient.from('route_plan_templates')
          .select('dealer_ids')
          .eq('organization_id',teamContext.organizationId)
          .eq('plan_type',planType)
          .eq('staff_user_id',staffId);
        if(!error)(data||[]).forEach(r=>(r.dealer_ids||[]).forEach(id=>set.add(id)));
      }
    }catch(_){ }
    return set;
  }

  async function applyColors(){
    if(!ready())return;
    const assigned=await assignedSet();
    (mainMarkers||[]).forEach(marker=>{
      const d=dealerForMarker(marker);if(!d)return;
      const isAssigned=assigned.has(d.id);
      try{marker.setIcon(makeIcon(isAssigned));marker._ilkeRouteAssigned=isAssigned;}catch(_){ }
    });
  }

  function patchRender(){
    if(originalRenderMap||typeof window.renderMap!=='function')return false;
    originalRenderMap=window.renderMap;
    window.renderMap=function(){
      const r=originalRenderMap.apply(this,arguments);
      setTimeout(applyColors,80);
      return r;
    };
    return true;
  }

  function install(){
    if(!ready())return false;
    patchRender();setTimeout(applyColors,50);return true;
  }

  function start(){
    clearInterval(installTimer);let tries=0;
    installTimer=setInterval(()=>{tries++;if(install()||tries>120){clearInterval(installTimer);installTimer=null;}},120);
  }

  document.addEventListener('change',e=>{
    if(e.target?.id==='mapRouteLivePlan'||e.target?.id==='mapRouteLiveStaff')setTimeout(applyColors,60);
  });
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#adminMapFilterBar [data-staff]'))setTimeout(applyColors,120);
    if(e.target?.closest?.('nav button[data-section="mapsec"]'))setTimeout(applyColors,200);
  },true);

  const observer=new MutationObserver(()=>{
    if(document.getElementById('mapRouteAddDialog')&&!document.getElementById('mapRouteAddDialog').open)setTimeout(applyColors,80);
  });
  if(document.body)observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});

  window.refreshMapRoutePinStatus=applyColors;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
