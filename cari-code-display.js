// İlke Saha - cari kodlarını bayi adının önünde görsel olarak göster
// textContent değişmez; CSS ::before kullanılır, böylece isim tabanlı eşleştirmeler bozulmaz.
(()=>{
  let observer=null,timer=null;
  function dealers(){return Array.isArray(state?.dealers)?state.dealers:[];}
  function byNameMap(){
    const m=new Map();
    for(const d of dealers()){
      if(!d?.name||!d?.cariCode)continue;
      const k=String(d.name).trim();
      if(!m.has(k))m.set(k,d.cariCode);
    }
    return m;
  }
  function decorate(root=document){
    if(typeof state==='undefined')return;
    const map=byNameMap();if(!map.size)return;
    const nodes=root.querySelectorAll?.('strong,td,.dealer-name,.route-info strong,.rp-stop strong,.leaflet-popup-content strong')||[];
    nodes.forEach(el=>{
      const txt=String(el.textContent||'').trim();
      const code=map.get(txt);
      if(code)el.dataset.cariCode=code;else if(el.dataset?.cariCode)delete el.dataset.cariCode;
    });
  }
  function ensureStyle(){
    if(document.getElementById('cariCodeDisplayStyle'))return;
    const s=document.createElement('style');s.id='cariCodeDisplayStyle';
    s.textContent='[data-cari-code]::before{content:attr(data-cari-code) " - ";font-weight:800;color:inherit}';
    document.head.appendChild(s);
  }
  function refresh(){ensureStyle();decorate(document);}
  function start(){
    ensureStyle();refresh();
    if(observer)observer.disconnect();
    observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(refresh,40);});
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  }
  window.refreshCariCodeDisplay=refresh;
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(refresh,100);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();