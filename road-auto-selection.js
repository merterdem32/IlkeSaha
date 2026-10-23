// İlke Saha - hafta/gün değişiminden sonra tek ve deterministik otomatik karayolu akışı
(()=>{
  let seq1=0,seq2=0,t1=null,t2=null;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const norm=v=>String(v||'').trim().toLocaleUpperCase('tr-TR');

  async function run1(){
    const my=++seq1;clearTimeout(t1);
    t1=setTimeout(async()=>{
      try{
        const week=document.getElementById('planWeek')?.value,day=document.getElementById('planDay')?.value;
        if(!week||!day||!window.optimizeRoute1ByRoad)return;
        const ds=(state.dealers||[]).filter(d=>d.isActive!==false&&String(d.plannedWeek||'')===String(week)&&norm(d.plannedDay)===norm(day)&&(typeof dealerVisibleToCurrentUser!=='function'||dealerVisibleToCurrentUser(d))).sort((a,b)=>(Number(a.plannedOrder)||999)-(Number(b.plannedOrder)||999));
        if(my!==seq1)return;
        state.todayRoute=ds.map(d=>d.id);
        try{localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){ }
        if(typeof renderRoute==='function')renderRoute();
        if(typeof renderRouteMap==='function')renderRouteMap();
        const status=document.getElementById('routeSummary');
        if(!ds.length){if(status)status.textContent='Seçili gün için aktif bayi bulunamadı.';return;}
        if(status)status.textContent='Seçili plan yüklendi; karayolu sırası hesaplanıyor…';
        await window.optimizeRoute1ByRoad(ds,status);
      }catch(e){console.warn('Otomatik karayolu Rut Planı',e);}
    },80);
  }

  async function run2Now(my){
    try{
      if(typeof window.renderRoute2==='function')window.renderRoute2();
      await sleep(80);
      if(my!==seq2)return;
      if(typeof window.loadRoute2Today==='function')window.loadRoute2Today(false);
      await sleep(40);
      if(my!==seq2)return;
      if(typeof window.optimizeRoute2==='function')await window.optimizeRoute2();
    }catch(e){console.warn('Otomatik karayolu Rut Planı2',e);}
  }
  function run2(){const my=++seq2;clearTimeout(t2);t2=setTimeout(()=>run2Now(my),120);}

  function bind(){
    const w1=document.getElementById('planWeek'),d1=document.getElementById('planDay'),w2=document.getElementById('route2Week'),d2=document.getElementById('route2Day');
    [w1,d1].forEach(x=>{if(x&&!x.dataset.roadAutoV2){x.dataset.roadAutoV2='1';x.addEventListener('change',run1);}});
    [w2,d2].forEach(x=>{if(x&&!x.dataset.roadAutoV2){x.dataset.roadAutoV2='1';x.addEventListener('change',run2);}});
  }

  document.addEventListener('click',e=>{const b=e.target?.closest?.('nav button[data-section]');if(b?.dataset.section==='route')setTimeout(run1,40);if(b?.dataset.section==='route2')setTimeout(run2,60);},true);
  window.addEventListener('focus',()=>{const id=document.querySelector('.section.active')?.id;if(id==='route')run1();if(id==='route2')run2();});

  let t=setInterval(()=>{bind();if(document.getElementById('planWeek')&&document.getElementById('route2Week'))clearInterval(t)},120);
  window.reloadSelectedRoute1ByRoad=run1;window.reloadSelectedRoute2ByRoad=run2;
})();