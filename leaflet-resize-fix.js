// İlke Saha - Leaflet harita görünürlük / mobil yeniden boyutlandırma düzeltmesi
// v2: Kullanıcı zoom/drag yaparken haritaya kesinlikle müdahale etmez.
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

  function safeInvalidate(map){
    if(!map||map._ilkeUserInteracting||!isVisibleMap(map))return;
    try{
      map.invalidateSize({pan:false,animate:false,debounceMoveend:true});
    }catch(_){ }
  }

  function attachMap(map){
    if(!map||maps.has(map))return;
    maps.add(map);

    // Pinch zoom / +/- / sürükleme sırasında otomatik resize devre dışı.
    let releaseTimer=null;
    const lock=()=>{
      clearTimeout(releaseTimer);
      map._ilkeUserInteracting=true;
    };
    const unlock=()=>{
      clearTimeout(releaseTimer);
      releaseTimer=setTimeout(()=>{map._ilkeUserInteracting=false;},250);
    };
    try{
      map.on('zoomstart dragstart movestart',lock);
      map.on('zoomend dragend moveend',unlock);
    }catch(_){ }

    // Harita kapsayıcısı gerçekten boyut değiştirdiğinde yalnızca invalidateSize yap.
    // fitBounds / setView çağrısı YOK: kullanıcının zoom seviyesi korunur.
    if(typeof ResizeObserver!=='undefined'){
      try{
        let lastW=0,lastH=0,timer=null;
        const ro=new ResizeObserver(entries=>{
          const entry=entries?.[0];
          const r=entry?.contentRect;
          if(!r||r.width<40||r.height<40)return;
          const changed=Math.abs(r.width-lastW)>2||Math.abs(r.height-lastH)>2;
          lastW=r.width;lastH=r.height;
          if(!changed)return;
          clearTimeout(timer);
          timer=setTimeout(()=>safeInvalidate(map),80);
        });
        ro.observe(map.getContainer());
        observers.set(map,ro);
      }catch(_){ }
    }
  }

  // Bu dosya DOMContentLoaded'dan önce yükleniyor; bundan sonra oluşturulan tüm Leaflet haritalarını yakalar.
  try{L.Map.addInitHook(function(){attachMap(this);});}catch(_){ }

  function refreshVisibleMaps(){maps.forEach(safeInvalidate);}

  function refreshAfterSectionChange(){
    // Sadece sekme görünür olduktan sonra kısa ve tek bir boyut düzeltmesi.
    requestAnimationFrame(()=>requestAnimationFrame(refreshVisibleMaps));
    setTimeout(refreshVisibleMaps,120);
  }

  // Yalnızca gerçek uygulama sekmesi değişimlerini dinle.
  // Leaflet'in kendi class değişikliklerini gözlemlemiyoruz; eski titreme/zoom geri alma sebebi buydu.
  document.addEventListener('click',e=>{
    const b=e.target?.closest?.('nav button[data-section]');
    if(b)refreshAfterSectionChange();
  },true);

  // activateSection programatik çağrılırsa yalnızca section.active değişimini izle.
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

  // Viewport gerçekten değiştiğinde debounce ile tek invalidate.
  const onResize=()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(refreshVisibleMaps,180);
  };
  window.addEventListener('resize',onResize,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(refreshVisibleMaps,300),{passive:true});
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')setTimeout(refreshVisibleMaps,180);
  });

  // Dışarıdan gerekirse güvenli şekilde yalnız boyut yenilemesi yapılabilir.
  window.refreshIlkeLeafletMaps=refreshAfterSectionChange;
})();
