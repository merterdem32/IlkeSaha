// İlke Saha - günlük Rut Planı ve Rut Planı2 yol ağı optimizasyonu
(()=>{
  const home=()=>({lat:Number(state?.home?.lat||41.0074),lng:Number(state?.home?.lng||28.5379)});
  let busy=false;

  async function optimizeRoute1(dealers,statusEl){
    if(!window.ilkeRoadRouting)return dealers;
    const status=statusEl||document.getElementById('routeSummary');
    if(status)status.textContent='Yol ağına göre sürüş rotası hesaplanıyor…';
    const r=await window.ilkeRoadRouting.optimizeDealers(dealers,home(),(a,b)=>{if(status)status.textContent='Yol ağı hesaplanıyor: '+a+' / '+b;});
    state.todayRoute=r.dealers.map(d=>d.id);
    try{localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){ }
    if(typeof renderRoute==='function')renderRoute();
    if(typeof renderRouteMap==='function')renderRouteMap();
    if(typeof markRouteDraftChanged==='function')markRouteDraftChanged();
    if(status)status.innerHTML='<strong>'+(r.mode.startsWith('road')?'Karayolu sürüş rotası hazır.':'Yol servisi kullanılamadı; yedek sıralama kullanıldı.')+'</strong> '+r.dealers.length+' bayi'+(r.roadKm?(' • yaklaşık <strong>'+r.roadKm.toFixed(1)+' km</strong> • '+Math.round(r.roadMinutes)+' dk sürüş'):'');
    return r;
  }

  async function manualRoute1(){
    if(busy)return;busy=true;
    try{
      const ds=(state.todayRoute||[]).map(id=>state.dealers.find(d=>d.id===id)).filter(Boolean);
      if(!ds.length){if(typeof loadOriginalPlan==='function')loadOriginalPlan();}
      const now=(state.todayRoute||[]).map(id=>state.dealers.find(d=>d.id===id)).filter(Boolean);
      if(now.length)await optimizeRoute1(now);
    }catch(e){console.error(e);alert('Yol bazlı rota oluşturulamadı: '+(e?.message||e));}finally{busy=false;}
  }

  async function optimizeRoute2(){
    const rows=[...document.querySelectorAll('#route2List .route-stop')];
    const ds=rows.map(r=>{const source=Number(r.dataset.route2Source);return typeof window.route2DealerBySource==='function'?window.route2DealerBySource(source):null;}).filter(Boolean);
    if(!ds.length){if(typeof window.loadRoute2Today==='function')window.loadRoute2Today(false);return;}
    const status=document.getElementById('route2PublishStatus');if(status)status.textContent='Yol ağına göre sürüş rotası hesaplanıyor…';
    const r=await window.ilkeRoadRouting.optimizeDealers(ds,home(),(a,b)=>{if(status)status.textContent='Yol ağı hesaplanıyor: '+a+' / '+b;});
    const sourceById=new Map(rows.map(r=>{const s=Number(r.dataset.route2Source),d=typeof window.route2DealerBySource==='function'?window.route2DealerBySource(s):null;return d?[d.id,s]:null;}).filter(Boolean));
    try{
      const K='ilkeSahaRoute2DraftsV4',all=JSON.parse(localStorage.getItem(K)||'{}')||{},key=String(document.getElementById('route2Week')?.value||1)+'|'+String(document.getElementById('route2Day')?.value||'Pazartesi');
      all[key]={items:r.dealers.map(d=>({source:sourceById.get(d.id),dealerId:d.id})).filter(x=>Number.isFinite(x.source)),optimized:true,optimizationMode:r.mode,roadKm:r.roadKm,roadMinutes:r.roadMinutes,updatedAt:new Date().toISOString()};
      localStorage.setItem(K,JSON.stringify(all));
      if(typeof window.renderRoute2Workspace==='function')window.renderRoute2Workspace();
      if(status)status.textContent=(r.mode.startsWith('road')?'Karayolu sürüş rotası hazır':'Yedek sıralama kullanıldı')+(r.roadKm?' • '+r.roadKm.toFixed(1)+' km • '+Math.round(r.roadMinutes)+' dk':'');
    }catch(e){console.error(e);}
  }

  function install(){
    if(!window.ilkeRoadRouting)return false;
    window.buildRoute=manualRoute1;
    window.optimizeRoute2=optimizeRoute2;
    return true;
  }
  let t=setInterval(()=>{if(install())clearInterval(t)},100);
  window.optimizeRoute1ByRoad=optimizeRoute1;
})();