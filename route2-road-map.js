// İlke Saha - Rut Planı2 haritasında gerçek karayolu geometrisi
(()=>{
  let captured=null, originalLMap=null, originalWorkspace=null, seq=0;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));

  function captureLeaflet(){
    if(originalLMap||typeof L==='undefined'||typeof L.map!=='function')return false;
    originalLMap=L.map;
    L.map=function(id){
      const m=originalLMap.apply(this,arguments);
      const el=typeof id==='string'?document.getElementById(id):id;
      if(el?.id==='route2Map'){captured=m;window.__ilkeRoute2Map=m;}
      return m;
    };
    return true;
  }

  function valid(d){return typeof isValidDealerCoordinate==='function'&&isValidDealerCoordinate(d?.lat,d?.lng);}
  function route2DealersFromDom(){
    return [...document.querySelectorAll('#route2List .route-stop')].map(row=>{
      const source=Number(row.dataset.route2Source);
      return typeof window.route2DealerBySource==='function'?window.route2DealerBySource(source):null;
    }).filter(Boolean);
  }

  async function geometry(points){
    if(typeof window.ilkeRoadGeometry==='function')return window.ilkeRoadGeometry(points);
    const coords=points.map(p=>(+p.lng)+','+(+p.lat)).join(';');
    try{
      const r=await fetch('https://router.project-osrm.org/route/v1/driving/'+coords+'?overview=full&geometries=geojson&steps=false');
      const j=await r.json(),rt=j?.routes?.[0];
      if(j.code!=='Ok'||!rt?.geometry?.coordinates?.length)throw new Error('geometry');
      return {latlngs:rt.geometry.coordinates.map(c=>[c[1],c[0]]),mode:'road',km:(rt.distance||0)/1000,minutes:(rt.duration||0)/60};
    }catch(_){return {latlngs:points.map(p=>[+p.lat,+p.lng]),mode:'fallback'};}
  }

  async function redraw(){
    const map=captured||window.__ilkeRoute2Map;if(!map||typeof L==='undefined'||typeof state==='undefined')return;
    const my=++seq,ds=route2DealersFromDom(),loc=ds.filter(valid),homeOk=valid(state.home),home={lat:homeOk?+state.home.lat:41.0082,lng:homeOk?+state.home.lng:28.9784};
    // route-plan2-actions içindeki düz polyline'ı kaldır, marker ve tile'ları bırak.
    map.eachLayer(layer=>{if(layer instanceof L.Polyline && !(layer instanceof L.Polygon)){try{map.removeLayer(layer);}catch(_){}}});
    if(!loc.length)return;
    const pts=[home,...loc.map(d=>({lat:+d.lat,lng:+d.lng})),home];
    const info=document.getElementById('route2MapInfo');if(info)info.innerHTML='<strong>'+ds.length+' bayi</strong> • '+loc.length+' konumlu<div class="muted" style="margin-top:4px">Karayolu çizgisi hazırlanıyor…</div>';
    const g=await geometry(pts);if(my!==seq)return;
    map.eachLayer(layer=>{if(layer instanceof L.Polyline && !(layer instanceof L.Polygon)){try{map.removeLayer(layer);}catch(_){}}});
    const line=L.polyline(g.latlngs,{weight:5,color:'#e30613',opacity:.82,lineJoin:'round'}).addTo(map);
    try{map.fitBounds(line.getBounds(),{padding:[30,30],maxZoom:15});}catch(_){ }
    if(info)info.innerHTML='<strong>'+ds.length+' bayi</strong> • '+loc.length+' konumlu'+(ds.length-loc.length?' • <span class="badge b-warn">'+(ds.length-loc.length)+' koordinatsız</span>':'')+'<div class="muted" style="margin-top:4px">'+(g.mode==='road'?'✓ Harita gerçek sürüş yollarını gösteriyor'+(g.km?' • '+g.km.toFixed(1)+' km • '+Math.round(g.minutes)+' dk':''):'⚠ Yol geometrisi alınamadı; geçici düz çizgi gösteriliyor')+'</div>';
  }

  function patchWorkspace(){
    if(originalWorkspace||typeof window.renderRoute2Workspace!=='function')return false;
    originalWorkspace=window.renderRoute2Workspace;
    window.renderRoute2Workspace=function(){const r=originalWorkspace.apply(this,arguments);setTimeout(redraw,80);return r;};
    setTimeout(redraw,100);return true;
  }

  function start(){
    let tries=0;const t=setInterval(()=>{
      tries++;captureLeaflet();patchWorkspace();
      if((captured&&originalWorkspace)||tries>200)clearInterval(t);
    },60);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();