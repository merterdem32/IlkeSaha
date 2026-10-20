// İlke Saha - Leaflet harita görünürlük / mobil yeniden boyutlandırma düzeltmesi
// v3: kullanıcı zoom/drag korunur; uygulamaya geri dönünce tile'lar güvenli biçimde yeniden çizilir.
(()=>{
  if(typeof window.L==='undefined'||!L.Map)return;

  const maps=new Set();
  const observers=new WeakMap();
  let resizeTimer=null;

  function isVisibleMap(map){
    try{
      const c=map.getContainer();
      if(!c||!c.isConnected)return false;
      const r=c.getBoundingClientRect();
      const cs=getComputedStyle(c);
      return r.width>40&&r.height>40&&cs.display!=='none'&&cs.visibility!=='hidden';
    }catch(_){return false;}
  }

  function redrawTiles(map){
    try{
      map.eachLayer(layer=>{
        if(layer instanceof L.TileLayer&&typeof layer.redraw==='function')layer.redraw();
      });
    }catch(_){ }
  }

  function safeInvalidate(map,{redraw=false}={}){
    if(!map||map._ilkeUserInteracting||!isVisibleMap(map))return;
    try{map.invalidateSize({pan:false,animate:false,debounceMoveend:true});}catch(_){ }
    if(redraw)redrawTiles(map);
  }

  function attachMap(map){
    if(!map||maps.has(map))return;
    maps.add(map);

    let releaseTimer=null;
    const lock=()=>{clearTimeout(releaseTimer);map._ilkeUserInteracting=true;};
    const unlock=()=>{clearTimeout(releaseTimer);releaseTimer=setTimeout(()=>{map._ilkeUserInteracting=false;},220);};
    try{
      map.on('zoomstart dragstart movestart',lock);
      map.on('zoomend dragend moveend',unlock);
    }catch(_){ }

    if(typeof ResizeObserver!=='undefined'){
      try{
        let lastW=0,lastH=0,timer=null;
        const ro=new ResizeObserver(entries=>{
          const r=entries?.[0]?.contentRect;
          if(!r||r.width<40||r.height<40)return;
          const changed=Math.abs(r.width-lastW)>2||Math.abs(r.height-lastH)>2;
          lastW=r.width;lastH=r.height;
          if(!changed)return;
          clearTimeout(timer);
          timer=setTimeout(()=>safeInvalidate(map),80);
        });
        ro.observe(map.getContainer());observers.set(map,ro);
      }catch(_){ }
    }
  }

  try{L.Map.addInitHook(function(){attachMap(this);});}catch(_){ }

  function refreshVisibleMaps(opts){maps.forEach(m=>safeInvalidate(m,opts));}

  function refreshAfterSectionChange(){
    requestAnimationFrame(()=>requestAnimationFrame(()=>refreshVisibleMaps()));
    setTimeout(()=>refreshVisibleMaps(),120);
  }

  function resumeMaps(){
    // Android/PWA arka plandan dönerken tile canvas/grid belleği boşalabiliyor.
    // Zoom veya merkez değiştirmeden sadece boyutu ve tile katmanını canlandır.
    maps.forEach(m=>{m._ilkeUserInteracting=false;});
    requestAnimationFrame(()=>requestAnimationFrame(()=>refreshVisibleMaps({redraw:true})));
    setTimeout(()=>refreshVisibleMaps({redraw:true}),180);
    setTimeout(()=>refreshVisibleMaps({redraw:true}),600);
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
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(resumeMaps,110);});
  window.addEventListener('pageshow',e=>{if(e.persisted)setTimeout(resumeMaps,90);});

  window.refreshIlkeLeafletMaps=refreshAfterSectionChange;
  window.resumeIlkeLeafletMaps=resumeMaps;
})();
