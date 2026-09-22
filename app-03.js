function renderRoute(){
  if(!state.todayRoute.length){routeSummary.textContent='Henüz hesaplanmadı.';routeList.innerHTML='';return}
  const ds=state.todayRoute.map(id=>state.dealers.find(x=>x.id===id)).filter(Boolean);
  const located=ds.filter(d=>isValidDealerCoordinate(d.lat,d.lng));
  let km=0,cur=state.home;
  located.forEach(d=>{km+=distanceKm(cur,d);cur=d});
  if(located.length) km+=distanceKm(cur,state.home);
  const visitMin=Number(visitMinutes.value||20)*ds.length;
  const driveMin=Math.round((km/30)*60);
  const missing=ds.length-located.length;
  const visitedCount=ds.filter(d=>dealerVisitedToday(d.id)).length;
  routeSummary.innerHTML=
    '<strong>'+visitedCount+'/'+ds.length+' ziyaret tamamlandı</strong> '+
    (located.length?'• işaretli konumlara göre yaklaşık <strong>'+km.toFixed(1)+' km</strong> ':'')+
    (missing?'• <span class="badge b-warn">'+missing+' konum eksik</span> ':'')+
    (located.length?'• kaba süre tahmini '+(((visitMin+driveMin)/60)|0)+' sa '+((visitMin+driveMin)%60)+' dk <span class="muted">(trafik servisi bağlanmadı)</span>':'');

  routeList.innerHTML=ds.map((d,i)=>{
    const visited=dealerVisitedToday(d.id);
    return '<div class="item route-stop" style="'+(visited?'opacity:.72;background:#f0fdf4;':'')+'">'+
      '<div class="num">'+(visited?'✓':(i+1))+'</div>'+
      '<div class="route-info"><strong>'+esc(d.name)+'</strong>'+
      '<span class="muted">'+esc(d.district||'')+' • '+
      (d.locationStatus==='verified'?'Doğrulandı':d.locationStatus==='estimated'?'Tahmini konum':'Konum girilmedi')+
      ' '+(d.plannedStage?'• '+esc(d.plannedStage):'')+'</span>'+
      (visited?'<div><span class="badge b-ok" style="margin-top:6px">Bugün ziyaret edildi</span></div>':'')+
      '</div>'+
      '<div class="toolbar route-actions">'+
      (!visited?'<button class="btn btn-primary" onclick="markRouteVisited(\''+d.id+'\')">✓ Ziyaret Edildi</button>':'<button class="btn btn-ghost" onclick="undoRouteVisited(\''+d.id+'\')">↩ Geri Al</button>')+
      '<button class="btn btn-accent" onclick="openRouteNote(\''+d.id+'\')">Görüşme Notu</button>'+
      '<button class="btn btn-ghost" onclick="showVisitHistory(\''+d.id+'\')">Geçmiş Notlar</button>'+
      '<button class="btn btn-primary" onclick="openGoogleMapsDirections(\''+d.id+'\')">🧭 Yol Tarifi</button>'+
      '<button class="btn btn-ghost" onclick="openDealerModal(\''+d.id+'\')">Konum / Bayi</button>'+
      '<button class="btn btn-danger" onclick="deactivateDealerFromRoute(\''+d.id+'\')">Rut Dışı Bırak</button>'+
      '</div></div>';
  }).join('');
}
function clearTodayRoute(){state.todayRoute=[];persist()}

function initRouteMap(){
  if(routeMap)return;
  routeMap=L.map('routeMap').setView([state.home.lat,state.home.lng],10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(routeMap);
}

function renderRouteMap(){
  if(!routeMap)return;
  routeMap.eachLayer(l=>{ if(!(l instanceof L.TileLayer)) routeMap.removeLayer(l); });
  const points=[[state.home.lat,state.home.lng]];
  L.marker(points[0]).addTo(routeMap).bindPopup('Ev');
  state.todayRoute.map(id=>state.dealers.find(x=>x.id===id)).filter(d=>d&&isValidDealerCoordinate(d.lat,d.lng)).forEach((d,i)=>{
    points.push([d.lat,d.lng]); L.marker([d.lat,d.lng]).addTo(routeMap).bindPopup((i+1)+'. '+esc(d.name));
  });
  if(points.length>1){
    points.push([state.home.lat,state.home.lng]);
    routeLayer=L.polyline(points,{weight:4}).addTo(routeMap);
    routeMap.fitBounds(points,{padding:[30,30]});
  } else routeMap.setView([state.home.lat,state.home.lng],10);
}

function initHomeMap(){
  if(homeMap)return;
  homeMap=L.map('homeMap').setView([state.home.lat,state.home.lng],13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(homeMap);
  homeMarker=L.marker([state.home.lat,state.home.lng]).addTo(homeMap);
  homeMap.on('click',e=>{
    homeLat.value=e.latlng.lat.toFixed(6);
    homeLng.value=e.latlng.lng.toFixed(6);
    homeMarker.setLatLng(e.latlng);
  });
}

function saveHome(){
  state.home={lat:Number(homeLat.value),lng:Number(homeLng.value)};
  if(homeMarker)homeMarker.setLatLng([state.home.lat,state.home.lng]);
  persist();
}

function useCurrentLocationForHome(){
  if(!navigator.geolocation){alert('Tarayıcı konum desteği yok.');return}
  navigator.geolocation.getCurrentPosition(pos=>{
    state.home={lat:pos.coords.latitude,lng:pos.coords.longitude};
    homeLat.value=state.home.lat.toFixed(6); homeLng.value=state.home.lng.toFixed(6);
    if(homeMarker)homeMarker.setLatLng([state.home.lat,state.home.lng]);
    if(homeMap)homeMap.setView([state.home.lat,state.home.lng],15);
    persist();
  },err=>alert('Konum alınamadı: '+err.message));
}

function exportData(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ilke-saha-veri.json';a.click();URL.revokeObjectURL(a.href);
}

function resetAll(){
  if(confirm('Tüm prototip verileri silinsin mi?')){localStorage.removeItem(storeKey);location.reload()}
}

function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

function renderAll(){
  homeLat.value=state.home.lat; homeLng.value=state.home.lng;
  renderDashboard(); renderDealers(); renderPayments(); renderRoute(); renderMap(); renderRouteMap();
}
nav(); renderAll();


function showVisitHistory(id){
  const d=state.dealers.find(x=>x.id===id);
  const visits=state.visits
    .filter(v=>v.dealerId===id && ((v.note||'').trim() || (v.followUp||'').trim()))
    .sort((a,b)=>new Date(b.date)-new Date(a.date));

  historyTitle.textContent=(d?.name||'Bayi')+' • Geçmiş Görüşmeler';
  historyContent.innerHTML=visits.length
    ? visits.map(v=>{
        const date=new Date(v.date).toLocaleString('tr-TR');
        return '<div class="item"><strong>'+date+'</strong>'+
          ((v.note||'').trim()?'<div style="margin-top:6px">'+esc(v.note)+'</div>':'')+
          ((v.followUp||'').trim()?'<div class="muted" style="margin-top:6px">Takip tarihi: '+esc(v.followUp)+'</div>':'')+
          '</div>';
      }).join('')
    : '<div class="muted">Bu bayi için kayıtlı görüşme notu bulunmuyor.</div>';
  historyDialog.showModal();
}


function openGoogleMapsDirections(id){
  const d=state.dealers.find(x=>x.id===id);
  if(!d){alert('Bayi bulunamadı.');return;}
  let destination='';
  if(d.lat!==null && d.lng!==null && isFinite(d.lat) && isFinite(d.lng)){
    destination=encodeURIComponent(d.lat+','+d.lng);
  }else if((d.address||'').trim()){
    destination=encodeURIComponent((d.address||'')+' '+(d.district||'')+' İstanbul');
  }else{
    alert('Bu bayinin kayıtlı konumu veya adresi yok.');
    return;
  }
  const url='https://www.google.com/maps/dir/?api=1&destination='+destination+'&travelmode=driving';
  window.open(url,'_blank','noopener');
}
