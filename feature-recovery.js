// İlke Saha - kritik dinamik özellikleri bağımsız olarak ayağa kaldırır
(()=>{
  let timer=null;

  function ready(){
    return typeof cloudUser!=='undefined'&&cloudUser&&typeof teamContext!=='undefined'&&teamContext?.organizationId;
  }

  function ensureRoutePlanner(){
    if(!ready())return false;
    try{
      if(typeof window.prepareRoutePlanner==='function'){
        const r=window.prepareRoutePlanner();
        if(r?.catch)r.catch(err=>console.warn('Rut Planlayıcı hazırlanamadı',err));
      }
      let navBtn=document.getElementById('routePlannerNavBtn');
      if(!navBtn){
        const nav=document.querySelector('nav');
        if(!nav)return false;
        navBtn=document.createElement('button');
        navBtn.id='routePlannerNavBtn';
        navBtn.dataset.section='routePlanner';
        navBtn.textContent='Rut Planlayıcı';
        const after=document.getElementById('route2NavBtn')||document.getElementById('routeNavBtn');
        if(after)after.insertAdjacentElement('afterend',navBtn);else nav.appendChild(navBtn);
      }
      if(!navBtn.dataset.recoveryBound){
        navBtn.dataset.recoveryBound='1';
        navBtn.addEventListener('click',()=>{
          try{
            if(typeof activateSection==='function')activateSection('routePlanner');
            if(typeof window.prepareRoutePlanner==='function')setTimeout(()=>window.prepareRoutePlanner(),20);
          }catch(err){console.warn('Rut Planlayıcı açılamadı',err);}
        });
      }
      navBtn.style.display='';
      return true;
    }catch(err){console.warn('Rut Planlayıcı recovery',err);return false;}
  }

  function dealerForMarker(marker){
    try{
      if(!marker?.getLatLng||typeof state==='undefined')return null;
      const p=marker.getLatLng();
      return (state.dealers||[]).find(d=>
        typeof isValidDealerCoordinate==='function'&&isValidDealerCoordinate(d.lat,d.lng)&&
        Math.abs(Number(d.lat)-Number(p.lat))<0.000001&&
        Math.abs(Number(d.lng)-Number(p.lng))<0.000001
      )||null;
    }catch(_){return null;}
  }

  function bindMarker(marker){
    const dealer=dealerForMarker(marker);
    if(!dealer||marker._ilkeRecoveryRouteBound)return;
    marker._ilkeRecoveryRouteBound=true;
    const open=()=>{
      try{
        if(typeof window.openMapRouteAdd==='function')window.openMapRouteAdd(dealer.id);
        else console.warn('openMapRouteAdd hazır değil');
      }catch(err){console.warn('Harita pini rut düzenleyici açılamadı',err);}
    };
    try{marker.on('click',open);}catch(_){ }
    const bindDom=()=>{
      try{
        const el=marker.getElement?.();
        if(!el||el.dataset.ilkeRecoveryTapBound)return;
        el.dataset.ilkeRecoveryTapBound='1';
        el.style.cursor='pointer';
        el.style.touchAction='manipulation';
        el.addEventListener('pointerup',e=>{
          if(e.pointerType==='touch'||e.pointerType==='pen'){
            e.preventDefault();e.stopPropagation();open();
          }
        },{passive:false});
      }catch(_){ }
    };
    bindDom();setTimeout(bindDom,60);
  }

  function ensureMapRouteEditor(){
    if(!ready())return false;
    try{
      if(typeof mainMarkers!=='undefined'&&Array.isArray(mainMarkers))mainMarkers.forEach(bindMarker);
      if(typeof map!=='undefined'&&map&&!map._ilkeRecoveryLayerBound){
        map._ilkeRecoveryLayerBound=true;
        map.on('layeradd',e=>{setTimeout(()=>bindMarker(e.layer),0);});
      }
      return typeof window.openMapRouteAdd==='function';
    }catch(err){console.warn('Harita rut recovery',err);return false;}
  }

  function repair(){ensureRoutePlanner();ensureMapRouteEditor();}

  document.addEventListener('click',e=>{
    const b=e.target?.closest?.('nav button[data-section]');
    if(b?.dataset.section==='mapsec')setTimeout(ensureMapRouteEditor,120);
    if(b?.dataset.section==='routePlanner')setTimeout(ensureRoutePlanner,40);
  },true);

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')setTimeout(repair,150);
  });
  window.addEventListener('focus',()=>setTimeout(repair,100));

  function start(){
    clearInterval(timer);let tries=0;
    timer=setInterval(()=>{
      tries++;repair();
      if(tries>240){clearInterval(timer);timer=null;}
    },250);
  }

  window.repairIlkeSahaFeatures=repair;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
