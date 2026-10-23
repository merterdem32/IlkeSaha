// İlke Saha - Rut Planlayıcı stabil navigasyon
// MutationObserver / sürekli yeniden ekleme yok. Ana render sonrası tek kez doğrular.
(()=>{
  let originalRenderAll=null;

  function ready(){
    return typeof cloudUser!=='undefined'&&cloudUser&&typeof teamContext!=='undefined'&&teamContext?.organizationId;
  }

  function ensureNav(){
    if(!ready()||typeof window.prepareRoutePlanner!=='function')return false;
    const nav=document.querySelector('nav');if(!nav)return false;
    let btn=document.getElementById('routePlannerNavBtn');
    if(!btn){
      btn=document.createElement('button');
      btn.id='routePlannerNavBtn';
      btn.dataset.section='routePlanner';
      btn.textContent='Rut Planlayıcı';
      const anchor=document.getElementById('route2NavBtn')||document.getElementById('routeNavBtn');
      if(anchor)anchor.insertAdjacentElement('afterend',btn);else nav.appendChild(btn);
    }
    if(!btn.dataset.stableBound){
      btn.dataset.stableBound='1';
      btn.onclick=()=>{
        try{
          if(typeof activateSection==='function')activateSection('routePlanner');
          setTimeout(()=>window.prepareRoutePlanner(),20);
        }catch(err){console.warn('Rut Planlayıcı açılamadı',err);}
      };
    }
    btn.style.display='';
    return true;
  }

  function patchRenderAll(){
    if(originalRenderAll||typeof window.renderAll!=='function')return false;
    originalRenderAll=window.renderAll;
    window.renderAll=function(){
      const r=originalRenderAll.apply(this,arguments);
      setTimeout(ensureNav,0);
      return r;
    };
    return true;
  }

  function start(){
    let tries=0;
    const t=setInterval(()=>{
      tries++;
      const ok=patchRenderAll();
      ensureNav();
      if(ok||tries>80)clearInterval(t);
    },100);
  }

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')setTimeout(ensureNav,80);
  });
  window.addEventListener('focus',()=>setTimeout(ensureNav,80));
  window.ensureRoutePlannerNav=ensureNav;

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
