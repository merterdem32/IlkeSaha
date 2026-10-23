// İlke Saha - Rut Planı / Rut Planı2 otomatik gün yükleme + otomatik günlük optimizasyon
(()=>{
  let busy1=false,busy2=false,installTimer=null;

  function optimizeRoute1Selection(){
    if(busy1)return;
    const week=document.getElementById('planWeek')?.value;
    const day=document.getElementById('planDay')?.value;
    if(!week||!day||typeof state==='undefined')return;
    busy1=true;
    try{
      const planned=(state.dealers||[])
        .filter(d=>d.isActive!==false&&d.plannedWeek===week&&d.plannedDay===day&&
          (typeof dealerVisibleToCurrentUser!=='function'||dealerVisibleToCurrentUser(d)))
        .sort((a,b)=>(Number(a.plannedOrder)||999)-(Number(b.plannedOrder)||999));

      if(!planned.length){
        state.todayRoute=[];
        try{localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){ }
        if(typeof renderRoute==='function')renderRoute();
        if(typeof renderRouteMap==='function')renderRouteMap();
        const s=document.getElementById('routeSummary');
        if(s)s.textContent='Seçili gün için aktif bayi bulunamadı.';
        return;
      }

      const located=planned.filter(d=>typeof isValidDealerCoordinate==='function'&&isValidDealerCoordinate(d.lat,d.lng));
      const missing=planned.filter(d=>!(typeof isValidDealerCoordinate==='function'&&isValidDealerCoordinate(d.lat,d.lng)));
      const optimized=located.length&&typeof optimizeDayRoute==='function'?optimizeDayRoute(located):located;
      state.todayRoute=[...optimized,...missing].map(d=>d.id);
      try{localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){ }
      if(typeof renderRoute==='function')renderRoute();
      if(typeof renderRouteMap==='function')renderRouteMap();
      if(typeof markRouteDraftChanged==='function')markRouteDraftChanged();
      const s=document.getElementById('routeSummary');
      if(s){
        s.innerHTML='<strong>Seçili plan otomatik yüklendi ve sıralandı.</strong> '+planned.length+' bayi'+
          (missing.length?' • <span class="badge b-warn">'+missing.length+' koordinatsız bayi listenin sonunda</span>':'');
      }
    }finally{busy1=false;}
  }

  function optimizeRoute2Selection(){
    if(busy2)return;
    if(typeof window.loadRoute2Today!=='function'||typeof window.optimizeRoute2!=='function')return;
    busy2=true;
    try{
      // route2 kaynak liste önce seçime göre render edilmiş olmalı.
      const ok=window.loadRoute2Today(false);
      if(ok!==false)window.optimizeRoute2();
    }catch(err){
      console.warn('Rut Planı2 otomatik yükleme/optimizasyon yapılamadı',err);
    }finally{busy2=false;}
  }

  function bindRoute1(){
    const w=document.getElementById('planWeek'),d=document.getElementById('planDay');
    if(!w||!d)return false;
    if(!w.dataset.autoRouteBound){
      w.dataset.autoRouteBound='1';
      w.addEventListener('change',()=>setTimeout(optimizeRoute1Selection,0));
    }
    if(!d.dataset.autoRouteBound){
      d.dataset.autoRouteBound='1';
      d.addEventListener('change',()=>setTimeout(optimizeRoute1Selection,0));
    }
    return true;
  }

  function bindRoute2(){
    const w=document.getElementById('route2Week'),d=document.getElementById('route2Day');
    if(!w||!d)return false;
    if(!w.dataset.autoRouteBound){
      w.dataset.autoRouteBound='1';
      w.addEventListener('change',()=>setTimeout(optimizeRoute2Selection,120));
    }
    if(!d.dataset.autoRouteBound){
      d.dataset.autoRouteBound='1';
      d.addEventListener('change',()=>setTimeout(optimizeRoute2Selection,120));
    }
    return true;
  }

  function onSectionOpen(sectionId){
    if(sectionId==='route')setTimeout(optimizeRoute1Selection,80);
    if(sectionId==='route2')setTimeout(optimizeRoute2Selection,180);
  }

  function install(){
    const a=bindRoute1(),b=bindRoute2();
    return a||b;
  }

  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('nav button[data-section]');
    if(btn)onSectionOpen(btn.dataset.section);
  },true);

  function start(){
    clearInterval(installTimer);let tries=0;
    installTimer=setInterval(()=>{
      tries++;install();
      if((document.getElementById('planWeek')&&document.getElementById('route2Week'))||tries>120){clearInterval(installTimer);installTimer=null;}
    },100);
  }

  window.autoLoadRoute1Selection=optimizeRoute1Selection;
  window.autoLoadRoute2Selection=optimizeRoute2Selection;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
