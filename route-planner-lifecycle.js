// İlke Saha - Rut Planlayıcı kalıcı yaşam döngüsü
(()=>{
  let scheduled=false;
  function ready(){return typeof cloudUser!=='undefined'&&cloudUser&&typeof teamContext!=='undefined'&&teamContext?.organizationId;}
  function ensure(){
    scheduled=false;
    if(!ready()||typeof window.prepareRoutePlanner!=='function')return false;
    const nav=document.querySelector('nav');if(!nav)return false;
    let b=document.getElementById('routePlannerNavBtn');
    if(!b){
      b=document.createElement('button');b.id='routePlannerNavBtn';b.dataset.section='routePlanner';b.textContent='Rut Planlayıcı';
      const after=document.getElementById('route2NavBtn')||document.getElementById('routeNavBtn');
      if(after)after.insertAdjacentElement('afterend',b);else nav.appendChild(b);
    }
    b.style.display='';
    if(!b.dataset.lifecycleBound){
      b.dataset.lifecycleBound='1';
      b.addEventListener('click',()=>{
        try{if(typeof activateSection==='function')activateSection('routePlanner');setTimeout(()=>window.prepareRoutePlanner(),20);}catch(e){console.warn('Rut Planlayıcı açılamadı',e);}
      });
    }
    // Section bir render sırasında silinmişse prepareRoutePlanner yeniden kurar.
    if(!document.getElementById('routePlanner'))setTimeout(()=>window.prepareRoutePlanner(),0);
    return true;
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>setTimeout(ensure,0));}
  const obs=new MutationObserver(muts=>{
    if(!ready())return;
    if(muts.some(m=>[...m.addedNodes,...m.removedNodes].some(n=>n?.nodeType===1)))schedule();
  });
  function start(){
    if(document.body)obs.observe(document.body,{childList:true,subtree:true});
    ensure();
  }
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedule();});
  window.addEventListener('focus',schedule);
  document.addEventListener('click',e=>{if(e.target?.closest?.('#routePlannerNavBtn'))setTimeout(ensure,50);},true);
  window.ensureRoutePlannerUi=ensure;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();