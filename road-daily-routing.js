// İlke Saha - günlük Rut Planı karayolu optimizasyonu
// Rut Planı2 kendi çalışma alanında doğrudan ilkeRoadRouting kullanır.
(()=>{
  const home=()=>({lat:Number(state?.home?.lat||41.0074),lng:Number(state?.home?.lng||28.5379)});
  let busy=false;

  async function optimizeRoute1(dealers,statusEl){
    if(!window.ilkeRoadRouting?.optimizeDealers)return dealers;
    const status=statusEl||document.getElementById('routeSummary');
    if(status)status.textContent='Yol ağına göre sürüş rotası hesaplanıyor…';
    const r=await window.ilkeRoadRouting.optimizeDealers(dealers,home(),(a,b)=>{if(status)status.textContent='Yol ağı hesaplanıyor: '+a+' / '+b;});
    state.todayRoute=r.dealers.map(d=>d.id);
    try{localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){ }
    if(typeof renderRoute==='function')renderRoute();
    if(typeof renderRouteMap==='function')renderRouteMap();
    if(typeof markRouteDraftChanged==='function')markRouteDraftChanged();
    if(status)status.innerHTML='<strong>'+(String(r.mode).startsWith('road')?'Karayolu sürüş rotası hazır.':'Yol servisi kullanılamadı; yedek sıralama kullanıldı.')+'</strong> '+r.dealers.length+' bayi'+(r.roadKm?(' • yaklaşık <strong>'+r.roadKm.toFixed(1)+' km</strong> • '+Math.round(r.roadMinutes)+' dk sürüş'):'');
    return r;
  }

  async function manualRoute1(){
    if(busy)return;busy=true;
    try{
      const ds=(state.todayRoute||[]).map(id=>state.dealers.find(d=>d.id===id)).filter(Boolean);
      if(!ds.length&&typeof loadOriginalPlan==='function')loadOriginalPlan();
      const now=(state.todayRoute||[]).map(id=>state.dealers.find(d=>d.id===id)).filter(Boolean);
      if(now.length)await optimizeRoute1(now);
    }catch(e){console.error(e);alert('Yol bazlı rota oluşturulamadı: '+(e?.message||e));}finally{busy=false;}
  }

  function install(){if(!window.ilkeRoadRouting?.optimizeDealers)return false;window.buildRoute=manualRoute1;return true;}
  let t=setInterval(()=>{if(install())clearInterval(t)},100);
  window.optimizeRoute1ByRoad=optimizeRoute1;
})();