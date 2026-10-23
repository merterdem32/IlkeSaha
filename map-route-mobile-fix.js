// İlke Saha - mobil harita pin dokunma düzeltmesi
// Leaflet popup butonuna bağımlı kalmadan pine dokununca doğrudan Rut Planına Ekle penceresini açar.
(()=>{
  let originalRenderMap=null;
  let installTimer=null;

  function dealerForMarker(marker){
    try{
      if(!marker?.getLatLng)return null;
      const p=marker.getLatLng();
      return (state.dealers||[]).find(d=>
        typeof isValidDealerCoordinate==='function'&&
        isValidDealerCoordinate(d.lat,d.lng)&&
        Math.abs(Number(d.lat)-Number(p.lat))<0.000001&&
        Math.abs(Number(d.lng)-Number(p.lng))<0.000001
      )||null;
    }catch(_){return null;}
  }

  function attachMarkerTapHandlers(){
    if(typeof mainMarkers==='undefined'||!Array.isArray(mainMarkers))return;
    mainMarkers.forEach(marker=>{
      const dealer=dealerForMarker(marker);
      if(!dealer||marker._ilkeRouteMobileBound)return;
      marker._ilkeRouteMobileBound=true;

      const open=()=>{
        try{
          if(typeof window.openMapRouteAdd==='function')window.openMapRouteAdd(dealer.id);
        }catch(err){console.warn('Harita pini rut penceresi açılamadı',err);}
      };

      // Leaflet'in kendi click olayı mobil dokunmayı mouse-click'e dönüştürüyor.
      try{marker.on('click',open);}catch(_){ }

      // Bazı Android WebView sürümlerinde marker click yutulabiliyor.
      // İkon DOM'a geldikten sonra pointerup ile ikinci, doğrudan bir yol ekliyoruz.
      try{
        const icon=marker.getElement?.();
        if(icon&&!icon.dataset.ilkeRouteTapBound){
          icon.dataset.ilkeRouteTapBound='1';
          icon.style.touchAction='manipulation';
          icon.addEventListener('pointerup',e=>{
            if(e.pointerType==='touch'||e.pointerType==='pen'){
              e.preventDefault();
              e.stopPropagation();
              open();
            }
          },{passive:false});
        }
      }catch(_){ }
    });
  }

  function patch(){
    if(originalRenderMap||typeof window.renderMap!=='function')return false;
    originalRenderMap=window.renderMap;
    window.renderMap=function(){
      const r=originalRenderMap.apply(this,arguments);
      setTimeout(attachMarkerTapHandlers,0);
      return r;
    };
    try{attachMarkerTapHandlers();}catch(_){ }
    return true;
  }

  function start(){
    clearInterval(installTimer);
    let tries=0;
    installTimer=setInterval(()=>{
      tries++;
      if(patch()||tries>100){clearInterval(installTimer);installTimer=null;}
    },100);
  }

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('nav button[data-section="mapsec"]'))setTimeout(attachMarkerTapHandlers,180);
  },true);

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')setTimeout(attachMarkerTapHandlers,200);
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
