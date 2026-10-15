// İlke Saha - Leaflet harita görünürlük / mobil yeniden boyutlandırma düzeltmesi
// Gizli sekmede oluşturulan Leaflet haritaları görünür olunca eksik tile çizmesin.
(()=>{
  if(typeof window.L==='undefined'||!L.Map)return;
  const maps=new Set();

  // Bundan sonra oluşturulan bütün Leaflet haritalarını kaydet.
  try{
    L.Map.addInitHook(function(){ maps.add(this); });
  }catch(_){ }

  function isVisibleMap(map){
    try{
      const c=map.getContainer();
      if(!c||!c.isConnected)return false;
      const r=c.getBoundingClientRect();
      return r.width>20&&r.height>20&&getComputedStyle(c).display!=='none';
    }catch(_){return false;}
  }

  function refreshOne(map){
    if(!isVisibleMap(map))return;
    try{map.invalidateSize({pan:false,debounceMoveend:true});}catch(_){ }
  }

  function refreshVisibleMaps(){
    maps.forEach(refreshOne);
  }

  function stagedRefresh(){
    // Mobil tarayıcıda section/display ve kart genişliği aynı anda oturmayabiliyor.
    requestAnimationFrame(()=>refreshVisibleMaps());
    [60,160,350,700].forEach(ms=>setTimeout(refreshVisibleMaps,ms));

    // Rut Planı2'nin fitBounds hesabını görünür genişlik oturduktan sonra bir kez daha yaptır.
    setTimeout(()=>{
      const sec=document.getElementById('route2');
      if(sec?.classList.contains('active')&&typeof window.renderRoute2Workspace==='function'){
        try{window.renderRoute2Workspace();}catch(_){ }
      }
    },180);

    // Rut Planlayıcı haritası için de görünür olduktan sonra hazırlığı yenile.
    setTimeout(()=>{
      const sec=document.getElementById('routePlanner');
      if(sec?.classList.contains('active')&&typeof window.prepareRoutePlanner==='function'){
        try{window.prepareRoutePlanner();}catch(_){ }
      }
    },220);
  }

  // Üst menüde sekme değişimlerinde harita görünür hale geliyor.
  document.addEventListener('click',e=>{
    const b=e.target?.closest?.('nav button[data-section]');
    if(b)setTimeout(stagedRefresh,0);
  },true);

  // activateSection sınıf değiştirirse de yakala.
  const main=document.querySelector('main');
  if(main&&typeof MutationObserver!=='undefined'){
    const mo=new MutationObserver(muts=>{
      if(muts.some(m=>m.type==='attributes'&&m.attributeName==='class'))stagedRefresh();
    });
    mo.observe(main,{subtree:true,attributes:true,attributeFilter:['class']});
  }

  // Telefon yatay/dikey, klavye aç/kapat veya viewport değişiklikleri.
  window.addEventListener('resize',stagedRefresh,{passive:true});
  window.addEventListener('orientationchange',stagedRefresh,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')stagedRefresh();});

  window.refreshIlkeLeafletMaps=stagedRefresh;
  setTimeout(stagedRefresh,250);
})();
