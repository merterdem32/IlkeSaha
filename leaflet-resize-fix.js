// İlke Saha - Leaflet harita görünürlük / mobil yeniden boyutlandırma düzeltmesi
// v4: zoom/drag korunur; uygulamaya dönüşte merkez/zoom bozulmadan tile katmanı yeniden canlandırılır.
(()=>{
  if(typeof window.L==='undefined'||!L.Map)return;

  const maps=new Set();
  const observers=new WeakMap();
  const viewState=new WeakMap();
  let resizeTimer=null;
  let resumeTimer=null;

  function isVisibleMap(map){
    try{
      const c=map.getContainer();if(!c||!c.isConnected)return false;
      const r=c.getBoundingClientRect(),cs=getComputedStyle(c);
      return r.width>40&&r.height>40&&cs.display!=='none'&&cs.visibility!=='hidden';
    }catch(_){return false;}
  }

  function rememberView(map){
    try{viewState.set(map,{center:map.getCenter(),zoom:map.getZoom()});}catch(_){ }
  }

  function redrawTiles(map){
    try{
      map.eachLayer(layer=>{
        if(layer instanceof L.TileLayer){
          try{layer.redraw();}catch(_){ }
        }
      });
    }catch(_){ }
  }

  function safeInvalidate(map,{redraw=false}={}){
    if(!map||map._ilkeUserInteracting||!isVisibleMap(map))return;
    try{map.invalidateSize({pan:false,animate:false,debounceMoveend:true});}catch(_){ }
    if(redraw)redrawTiles(map);
  }

  function forceResumeMap(map){
    if(!map||!isVisibleMap(map))return;
    const saved=viewState.get(map);
    map._ilkeUserInteracting=false;
    try{map.stop();}catch(_){ }
    try{map.invalidateSize({pan:false,animate:false,debounceMoveend:false});}catch(_){ }
    // Android WebView bazen tile pane'i görünmez/baygın bırakıyor. Aynı view'u tekrar set etmek
    // kullanıcı zoomunu değiştirmeden Leaflet'in görünür alan hesabını yeniliyor.
    if(saved?.center&&Number.isFinite(saved.zoom)){
      try{map.setView(saved.center,saved.zoom,{animate:false});}catch(_){ }
    }
    redrawTiles(map);
  }

  function attachMap(map){
    if(!map||maps.has(map))return;
    maps.add(map);rememberView(map);
    let releaseTimer=null;
    const lock=()=>{clearTimeout(releaseTimer);map._ilkeUserInteracting=true;};
    const unlock=()=>{clearTimeout(releaseTimer);releaseTimer=setTimeout(()=>{map._ilkeUserInteracting=false;rememberView(map);},180);};
    try{
      map.on('zoomstart dragstart movestart',lock);
      map.on('zoomend dragend moveend',unlock);
      map.on('load',()=>rememberView(map));
    }catch(_){ }

    if(typeof ResizeObserver!=='undefined'){
      try{
        let lastW=0,lastH=0,timer=null;
        const ro=new ResizeObserver(entries=>{
          const r=entries?.[0]?.contentRect;if(!r||r.width<40||r.height<40)return;
          const changed=Math.abs(r.width-lastW)>2||Math.abs(r.height-lastH)>2;
          lastW=r.width;lastH=r.height;if(!changed)return;
          clearTimeout(timer);timer=setTimeout(()=>safeInvalidate(map),90);
        });
        ro.observe(map.getContainer());observers.set(map,ro);
      }catch(_){ }
    }
  }

  try{L.Map.addInitHook(function(){attachMap(this);});}catch(_){ }

  function refreshVisibleMaps(opts){maps.forEach(m=>safeInvalidate(m,opts));}
  function refreshAfterSectionChange(){
    requestAnimationFrame(()=>requestAnimationFrame(()=>refreshVisibleMaps()));
    setTimeout(()=>refreshVisibleMaps(),140);
  }

  function rememberAllViews(){maps.forEach(rememberView);}

  function resumeMaps(){
    clearTimeout(resumeTimer);
    resumeTimer=setTimeout(()=>{
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        maps.forEach(forceResumeMap);
        setTimeout(()=>maps.forEach(m=>{if(isVisibleMap(m)){safeInvalidate(m,{redraw:true});rememberView(m);}}),220);
      }));
    },120);
  }

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('nav button[data-section]'))refreshAfterSectionChange();
  },true);

  const main=document.querySelector('main');
  if(main&&typeof MutationObserver!=='undefined'){
    try{
      const mo=new MutationObserver(muts=>{
        const becameActive=muts.some(m=>m.type==='attributes'&&m.attributeName==='class'&&m.target?.matches?.('section.section.active'));
        if(becameActive)refreshAfterSectionChange();
      });
      [...main.querySelectorAll('section.section')].forEach(sec=>mo.observe(sec,{attributes:true,attributeFilter:['class']}));
    }catch(_){ }
  }

  const onResize=()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>refreshVisibleMaps(),180);};
  window.addEventListener('resize',onResize,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(()=>refreshVisibleMaps({redraw:true}),300),{passive:true});
  window.addEventListener('blur',rememberAllViews,{passive:true});
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden')rememberAllViews();
    else resumeMaps();
  });
  window.addEventListener('pageshow',e=>{if(e.persisted)resumeMaps();});
  window.addEventListener('ilke:ui-restored',resumeMaps);

  window.refreshIlkeLeafletMaps=refreshAfterSectionChange;
  window.resumeIlkeLeafletMaps=resumeMaps;
})();
