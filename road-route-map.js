// İlke Saha - günlük Rut Planı haritasını gerçek karayolu geometrisiyle çiz
(()=>{
  const BASE='https://router.project-osrm.org';
  let seq=0;

  const valid=p=>p&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lng);
  const esc2=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  async function roadGeometry(points){
    const clean=points.filter(valid).map(p=>({lat:+p.lat,lng:+p.lng}));
    if(clean.length<2)return {latlngs:clean.map(p=>[p.lat,p.lng]),mode:'none'};
    const coords=clean.map(p=>p.lng+','+p.lat).join(';');
    const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),15000);
    try{
      const r=await fetch(BASE+'/route/v1/driving/'+coords+'?overview=full&geometries=geojson&steps=false',{signal:ctl.signal});
      if(!r.ok)throw new Error('HTTP '+r.status);
      const j=await r.json();const route=j?.routes?.[0];
      if(j.code!=='Ok'||!route?.geometry?.coordinates?.length)throw new Error(j.message||'Yol geometrisi alınamadı');
      return {latlngs:route.geometry.coordinates.map(c=>[c[1],c[0]]),mode:'road',km:(route.distance||0)/1000,minutes:(route.duration||0)/60};
    }catch(err){
      console.warn('Karayolu harita geometrisi alınamadı',err);
      return {latlngs:clean.map(p=>[p.lat,p.lng]),mode:'fallback',error:String(err?.message||err)};
    }finally{clearTimeout(timer);}
  }

  async function renderRoadRouteMap(){
    if(typeof routeMap==='undefined'||!routeMap||typeof L==='undefined'||typeof state==='undefined')return;
    const mySeq=++seq;
    routeMap.eachLayer(l=>{if(!(l instanceof L.TileLayer))try{routeMap.removeLayer(l);}catch(_){}});

    const routeDealers=(state.todayRoute||[]).map((id,index)=>({dealer:(state.dealers||[]).find(x=>x.id===id),routeIndex:index})).filter(x=>x.dealer);
    const good=routeDealers.filter(x=>typeof isValidDealerCoordinate==='function'&&isValidDealerCoordinate(x.dealer.lat,x.dealer.lng));
    const missing=routeDealers.filter(x=>!(typeof isValidDealerCoordinate==='function'&&isValidDealerCoordinate(x.dealer.lat,x.dealer.lng)));
    const homeOk=typeof isValidDealerCoordinate==='function'&&isValidDealerCoordinate(state.home?.lat,state.home?.lng);
    const home={lat:homeOk?+state.home.lat:41.0082,lng:homeOk?+state.home.lng:28.9784};

    L.marker([home.lat,home.lng]).addTo(routeMap).bindPopup('Ev / Başlangıç');
    good.forEach(({dealer:d,routeIndex})=>{
      const icon=L.divIcon({className:'',html:'<div style="width:30px;height:30px;border-radius:50%;background:#e30613;color:white;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.28);display:grid;place-items:center;font-weight:800;font-size:13px">'+(routeIndex+1)+'</div>',iconSize:[30,30],iconAnchor:[15,15]});
      L.marker([+d.lat,+d.lng],{icon}).addTo(routeMap).bindPopup('<strong>'+(routeIndex+1)+'. '+esc2(d.name)+'</strong><br>'+esc2(d.district||''));
    });

    const ordered=[home,...good.map(x=>({lat:+x.dealer.lat,lng:+x.dealer.lng})),home];
    const info=document.getElementById('routeMapInfo');
    if(info)info.innerHTML='<strong>'+good.length+'/'+routeDealers.length+' bayi haritada</strong>'+(missing.length?' • <span class="badge b-warn">'+missing.length+' konum eksik/geçersiz</span>':'')+'<div class="muted" style="margin-top:6px">Karayolu çizgisi hazırlanıyor…</div>';

    if(ordered.length>2){
      const geo=await roadGeometry(ordered);if(mySeq!==seq)return;
      if(typeof routeLayer!=='undefined'&&routeLayer){try{routeMap.removeLayer(routeLayer);}catch(_){}}
      routeLayer=L.polyline(geo.latlngs,{weight:5,color:'#e30613',opacity:.82,lineJoin:'round'}).addTo(routeMap);
      try{routeMap.fitBounds(routeLayer.getBounds(),{padding:[40,40],maxZoom:15});}catch(_){ }
      if(info){
        const road=geo.mode==='road';
        info.innerHTML='<strong>'+good.length+'/'+routeDealers.length+' bayi haritada</strong>'+
          (missing.length?' • <span class="badge b-warn">'+missing.length+' konum eksik/geçersiz</span>':' • <span class="badge b-ok">Tüm kayıtlı konumlar gösteriliyor</span>')+
          '<div class="muted" style="margin-top:6px">'+(road?'✓ Çizgi gerçek sürüş yollarını takip ediyor'+(geo.km?' • '+geo.km.toFixed(1)+' km • '+Math.round(geo.minutes)+' dk':''):'⚠ Yol geometrisi alınamadı; geçici düz çizgi gösteriliyor')+'</div>'+
          (missing.length?'<div class="muted" style="margin-top:4px">Haritada görünmeyen: '+missing.map(x=>esc2(x.dealer.name)).join(', ')+'</div>':'');
      }
    }else{
      routeMap.setView([home.lat,home.lng],10);
    }
  }

  function install(){
    if(typeof window.renderRouteMap!=='function'||typeof L==='undefined')return false;
    window.renderRouteMap=renderRoadRouteMap;
    window.ilkeRoadGeometry=roadGeometry;
    return true;
  }
  let t=setInterval(()=>{if(install())clearInterval(t)},100);
})();