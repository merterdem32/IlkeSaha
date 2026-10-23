// İlke Saha - hafta/gün değişiminden sonra otomatik karayolu optimizasyonu
(()=>{
  let t1=null,t2=null;
  async function run1(){
    clearTimeout(t1);t1=setTimeout(async()=>{
      try{
        const week=document.getElementById('planWeek')?.value,day=document.getElementById('planDay')?.value;if(!week||!day||!window.optimizeRoute1ByRoad)return;
        const ds=(state.dealers||[]).filter(d=>d.isActive!==false&&d.plannedWeek===week&&d.plannedDay===day&&(typeof dealerVisibleToCurrentUser!=='function'||dealerVisibleToCurrentUser(d))).sort((a,b)=>(Number(a.plannedOrder)||999)-(Number(b.plannedOrder)||999));
        if(ds.length)await window.optimizeRoute1ByRoad(ds,document.getElementById('routeSummary'));
      }catch(e){console.warn('Otomatik karayolu Rut Planı',e);}
    },180);
  }
  function run2(){clearTimeout(t2);t2=setTimeout(()=>{try{if(typeof window.loadRoute2Today==='function')window.loadRoute2Today(false);if(typeof window.optimizeRoute2==='function')window.optimizeRoute2();}catch(e){console.warn('Otomatik karayolu Rut Planı2',e);}},260);}
  function bind(){
    const w1=document.getElementById('planWeek'),d1=document.getElementById('planDay'),w2=document.getElementById('route2Week'),d2=document.getElementById('route2Day');
    [w1,d1].forEach(x=>{if(x&&!x.dataset.roadAutoBound){x.dataset.roadAutoBound='1';x.addEventListener('change',run1);}});
    [w2,d2].forEach(x=>{if(x&&!x.dataset.roadAutoBound){x.dataset.roadAutoBound='1';x.addEventListener('change',run2);}});
  }
  document.addEventListener('click',e=>{const b=e.target?.closest?.('nav button[data-section]');if(b?.dataset.section==='route')run1();if(b?.dataset.section==='route2')run2();},true);
  let t=setInterval(()=>{bind();if(document.getElementById('planWeek')&&document.getElementById('route2Week'))clearInterval(t)},120);
})();