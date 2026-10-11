// İlke Saha - Rut Planı2 tam çalışma alanı
// Yeni Excel planını mevcut Rut Planı kaynak verisine dokunmadan yükler, optimize eder ve haritada gösterir.
(() => {
  const STORE_KEY='ilkeSahaRoute2DraftsV2';
  const norm=v=>String(v||'').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g,' ');
  let route2Map=null;
  let route2Layer=null;
  let route2Markers=[];

  function selectionKey(){
    const week=document.getElementById('route2Week')?.value||'1';
    const day=document.getElementById('route2Day')?.value||'Pazartesi';
    return week+'|'+day;
  }

  function readDrafts(){
    try{return JSON.parse(localStorage.getItem(STORE_KEY)||'{}')||{};}catch(_){return {};}
  }

  function getDraft(){
    return readDrafts()[selectionKey()]||null;
  }

  function saveDraft(items,optimized=false){
    const all=readDrafts();
    all[selectionKey()]={items,optimized,updatedAt:new Date().toISOString()};
    localStorage.setItem(STORE_KEY,JSON.stringify(all));
  }

  function removeDraft(){
    const all=readDrafts();
    delete all[selectionKey()];
    localStorage.setItem(STORE_KEY,JSON.stringify(all));
  }

  function sourceNumbers(){
    return [...document.querySelectorAll('#route2List .route-stop')]
      .map(row=>{
        const btn=row.querySelector('button[onclick^="route2Dealer("]');
        const m=btn?.getAttribute('onclick')?.match(/route2Dealer\((\d+)\)/);
        return m?Number(m[1]):null;
      })
      .filter(Number.isFinite);
  }

  function dealerForSource(n){
    const id='imported-'+String(n).padStart(3,'0');
    let d=(state.dealers||[]).find(x=>x.id===id);
    if(d)return d;
    const row=[...document.querySelectorAll('#route2List .route-stop')].find(r=>{
      const btn=r.querySelector('button[onclick^="route2Dealer("]');
      return btn?.getAttribute('onclick')===`route2Dealer(${n})`;
    });
    const name=row?.querySelector('.route-info strong')?.textContent||'';
    return (state.dealers||[]).find(x=>norm(x.name)===norm(name))||null;
  }

  function currentSourceItems(){
    return sourceNumbers().map(n=>{
      const d=dealerForSource(n);
      return d?{source:n,dealerId:d.id}:null;
    }).filter(Boolean);
  }

  function draftDealers(draft=getDraft()){
    if(!draft?.items?.length)return [];
    return draft.items.map(x=>({
      source:x.source,
      dealer:(state.dealers||[]).find(d=>d.id===x.dealerId)||dealerForSource(x.source)
    })).filter(x=>x.dealer);
  }

  function setStatus(text){
    const el=document.getElementById('route2PublishStatus');
    if(el)el.textContent=text;
  }

  function visitedToday(id){
    return (state.visits||[]).some(v=>v.dealerId===id&&String(v.date||'').slice(0,10)===todayStr());
  }

  function renderDraftList(){
    const draft=getDraft();
    if(!draft?.items?.length)return false;
    const list=document.getElementById('route2List');
    const sum=document.getElementById('route2Summary');
    if(!list||!sum)return false;

    const rows=draftDealers(draft);
    const missingCoord=rows.filter(x=>!isValidDealerCoordinate(x.dealer.lat,x.dealer.lng)).length;
    const located=rows.map(x=>x.dealer).filter(d=>isValidDealerCoordinate(d.lat,d.lng));
    const km=typeof routeDistance==='function'&&located.length?routeDistance(located):0;
    const mode=draft.optimized?'Optimize edilmiş günlük sıra':'Yüklenen Excel sırası';

    sum.innerHTML='<strong>'+mode+'</strong><div class="muted" style="margin-top:5px">'+rows.length+' bayi'+
      (missingCoord?' • <span class="badge b-warn">'+missingCoord+' koordinatsız</span>':'')+
      (km?' • yaklaşık '+km.toFixed(1)+' km':'')+'</div>'+
      '<div class="muted" style="margin-top:5px">Bu sıra yalnızca Rut Planı2 çalışma alanına aittir.</div>';

    list.innerHTML=rows.map((x,i)=>{
      const d=x.dealer;
      const visited=visitedToday(d.id);
      return '<div class="item route-stop" data-route2-id="'+d.id+'">'+
        '<div class="num">'+(i+1)+'</div>'+
        '<div class="route-info"><strong>'+esc(d.name)+'</strong>'+
          '<span class="muted">'+esc(d.district||'-')+(d.phone?' • '+esc(d.phone):'')+'</span>'+
          (d.address?'<span class="muted" style="margin-top:3px">'+esc(d.address)+'</span>':'')+
          '<div style="margin-top:6px">'+
            (isValidDealerCoordinate(d.lat,d.lng)?'<span class="badge b-ok">Konum var</span>':'<span class="badge b-warn">Koordinat eksik</span>')+
            (d.isZCode?' <span class="badge b-zcode">Z KODLU</span>':'')+
            (visited?' <span class="badge b-ok">Ziyaret edildi</span>':'')+
          '</div></div>'+
        '<div class="toolbar route-actions">'+
          '<button class="btn btn-ghost" onclick="route2Dealer('+x.source+')">Bayi Aç</button>'+
          '<button class="btn btn-primary" onclick="route2Visit('+x.source+')">Görüşme Notu</button>'+
          (visited
            ?'<button class="btn btn-ghost" onclick="undoRoute2Visited(\''+d.id+'\')">Ziyareti Geri Al</button>'
            :'<button class="btn btn-ghost" onclick="markRoute2Visited(\''+d.id+'\')">Ziyaret Edildi</button>')+
          '<button class="btn btn-accent" onclick="route2Directions('+x.source+')">Yol Tarifi</button>'+
        '</div></div>';
    }).join('');
    return true;
  }

  function currentRouteDealers(){
    const draft=getDraft();
    if(draft?.items?.length)return draftDealers(draft).map(x=>x.dealer);
    return currentSourceItems().map(x=>(state.dealers||[]).find(d=>d.id===x.dealerId)).filter(Boolean);
  }

  function ensureMap(){
    const el=document.getElementById('route2Map');
    if(!el||typeof L==='undefined')return;
    if(!route2Map){
      const homeOk=isValidDealerCoordinate(state.home?.lat,state.home?.lng);
      const center=homeOk?[Number(state.home.lat),Number(state.home.lng)]:[41.0082,28.9784];
      route2Map=L.map('route2Map').setView(center,10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(route2Map);
    }
    setTimeout(()=>route2Map?.invalidateSize(),20);
  }

  function renderRoute2Map(){
    ensureMap();
    if(!route2Map)return;
    route2Markers.forEach(m=>{try{route2Map.removeLayer(m);}catch(_){}});
    route2Markers=[];
    if(route2Layer){try{route2Map.removeLayer(route2Layer);}catch(_){ } route2Layer=null;}

    const dealers=currentRouteDealers();
    const located=dealers.filter(d=>isValidDealerCoordinate(d.lat,d.lng));
    const points=[];
    const homeOk=isValidDealerCoordinate(state.home?.lat,state.home?.lng);

    if(homeOk){
      const hp=[Number(state.home.lat),Number(state.home.lng)];
      const hm=L.marker(hp).addTo(route2Map).bindPopup('<strong>Ev</strong><br>Başlangıç / dönüş');
      route2Markers.push(hm); points.push(hp);
    }

    located.forEach((d,i)=>{
      const p=[Number(d.lat),Number(d.lng)];
      const m=L.marker(p).addTo(route2Map)
        .bindPopup('<strong>'+(i+1)+'. '+esc(d.name)+'</strong><br>'+esc(d.district||''));
      try{m.bindTooltip(String(i+1),{permanent:true,direction:'top',offset:[0,-12]});}catch(_){ }
      route2Markers.push(m); points.push(p);
    });

    if(homeOk&&located.length)points.push([Number(state.home.lat),Number(state.home.lng)]);
    if(points.length>1)route2Layer=L.polyline(points).addTo(route2Map);
    if(points.length)route2Map.fitBounds(points,{padding:[30,30]});

    const info=document.getElementById('route2MapInfo');
    const missing=dealers.length-located.length;
    if(info)info.innerHTML='<strong>'+dealers.length+' bayi</strong> • '+located.length+' konumlu'+
      (missing?' • <span class="badge b-warn">'+missing+' koordinatsız</span>':'')+
      '<div class="muted" style="margin-top:4px">Haritadaki çizgi mevcut Rut Planı2 sırasını gösterir. En Mantıklı Rutu Oluştur dediğinde liste ve harita birlikte yeniden sıralanır.</div>';
  }

  function renderRoute2Workspace(){
    if(!renderDraftList() && typeof renderRoute2==='function'){
      // Kaynak liste zaten ana modül tarafından çizilmiş olabilir.
    }
    renderRoute2Map();
  }

  function loadRoute2Today(showAlert=true){
    if(typeof state==='undefined')return false;
    // Her yüklemede yeni Excel kaynak sırasını esas al.
    if(typeof renderRoute2==='function')renderRoute2();
    const nums=sourceNumbers();
    const items=currentSourceItems();
    if(!nums.length){alert('Önce Rut Planı2 içinden hafta ve günü seç.');return false;}
    if(!items.length){alert('Seçili plandaki bayiler ana bayi listesiyle eşleşmedi.');return false;}
    saveDraft(items,false);
    renderRoute2Workspace();
    setStatus('Rut Planı2 seçimi günlük çalışma alanına yüklendi. Henüz yöneticiyle paylaşılmadı.');
    if(showAlert&&items.length!==nums.length){
      alert('Plan yüklendi. '+items.length+' bayi eşleşti; '+(nums.length-items.length)+' bayi ana listede bulunamadı.');
    }
    return true;
  }

  function optimizeRoute2(){
    let draft=getDraft();
    if(!draft?.items?.length){if(!loadRoute2Today(false))return; draft=getDraft();}
    const rows=draftDealers(draft);
    if(!rows.length)return;

    const locatedRows=rows.filter(x=>isValidDealerCoordinate(x.dealer.lat,x.dealer.lng));
    const missingRows=rows.filter(x=>!isValidDealerCoordinate(x.dealer.lat,x.dealer.lng));
    const optimizedDealers=typeof optimizeDayRoute==='function'
      ? optimizeDayRoute(locatedRows.map(x=>x.dealer))
      : locatedRows.map(x=>x.dealer);

    const sourceByDealer=new Map(rows.map(x=>[x.dealer.id,x.source]));
    const finalItems=optimizedDealers.map(d=>({source:sourceByDealer.get(d.id),dealerId:d.id}))
      .concat(missingRows.map(x=>({source:x.source,dealerId:x.dealer.id})));

    saveDraft(finalItems,true);
    renderRoute2Workspace();
    setStatus('Rut Planı2 optimize edildi. Liste ve harita yeni sıraya göre güncellendi. Henüz yöneticiyle paylaşılmadı.');
    if(missingRows.length){
      alert('Rut '+finalItems.length+' bayinin tamamını içeriyor. '+missingRows.length+' bayinin koordinatı olmadığı için listenin sonuna bırakıldı.');
    }
  }

  async function publishRoute2(){
    let draft=getDraft();
    if(!draft?.items?.length){if(!loadRoute2Today(false))return; draft=getDraft();}
    const ids=draftDealers(draft).map(x=>x.dealer.id);
    if(!ids.length)return;
    if(typeof publishTodayRoute!=='function'){
      alert('Rut yayınlama fonksiyonu bulunamadı.');
      return;
    }

    // Yalnızca yayın anında mevcut yayın mekanizmasına Rut Planı2 sırasını veriyoruz.
    // Eski Rut Planı ekranındaki yerel taslağı işlem bittikten sonra aynen geri koyuyoruz.
    const previous=Array.isArray(state.todayRoute)?state.todayRoute.slice():[];
    try{
      state.todayRoute=ids.slice();
      const result=publishTodayRoute();
      if(result&&typeof result.then==='function')await result;
      setStatus('Rut Planı2 sırası bugünkü rut olarak yöneticiye gönderildi.');
    }catch(err){
      console.error('Route2 publish failed',err);
      alert('Rut Planı2 yayınlanamadı: '+(err?.message||err));
    }finally{
      state.todayRoute=previous;
      try{localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){ }
      if(typeof renderAll==='function')renderAll();
      renderRoute2Workspace();
    }
  }

  function clearRoute2Today(){
    if(!getDraft()?.items?.length){setStatus('Rut Planı2 günlük taslağı zaten boş.');return;}
    if(!confirm('Rut Planı2 içindeki günlük taslak temizlensin mi?\n\nYeni Excel kaynak planı ve mevcut Rut Planı etkilenmez.'))return;
    removeDraft();
    if(typeof renderRoute2==='function')renderRoute2();
    renderRoute2Map();
    setStatus('Rut Planı2 günlük taslağı temizlendi. Yeni Excel kaynak planı değişmedi.');
  }

  function markRoute2Visited(id){
    if(typeof markRouteVisited==='function')markRouteVisited(id);
    renderRoute2Workspace();
  }

  function undoRoute2Visited(id){
    if(typeof undoRouteVisited==='function')undoRouteVisited(id);
    renderRoute2Workspace();
  }

  function installControls(){
    const section=document.getElementById('route2');
    if(!section)return false;
    const left=section.querySelector('.card.span-4');
    if(!left)return false;

    if(!document.getElementById('route2ActionPanel')){
      const panel=document.createElement('div');
      panel.id='route2ActionPanel';
      panel.innerHTML=`
        <button class="btn btn-primary" style="margin-top:12px;width:100%" onclick="openOutOfRouteVisit()">+ Rota Dışı Ziyaret Ekle</button>
        <div class="muted" style="margin-top:6px">Rutunda olmayan yeni bir firmayı ziyaret ettiysen firma ve görüşme bilgilerini buradan kaydet.</div>
        <hr style="border:0;border-top:1px solid #e2e8f0;margin:16px 0">
        <button class="btn btn-ghost" style="margin-top:10px;width:100%" onclick="loadRoute2Today()">Seçili Planı Bugüne Yükle</button>
        <button class="btn btn-accent" style="margin-top:12px;width:100%" onclick="optimizeRoute2()">En Mantıklı Rutu Oluştur</button>
        <div id="route2PublishStatus" class="muted" style="margin-top:12px">Bugünkü rut henüz yöneticiyle paylaşılmadı.</div>
        <button class="btn btn-primary" style="margin-top:8px;width:100%" onclick="publishRoute2()">✓ Bugünkü Rutu Onayla ve Yöneticiye Gönder</button>
        <button class="btn btn-ghost" style="margin-top:8px;width:100%" onclick="clearRoute2Today()">Bugünkü rutu temizle</button>`;
      left.appendChild(panel);
    }

    if(!document.getElementById('route2MapCard')){
      const card=document.createElement('div');
      card.id='route2MapCard';
      card.className='card span-12';
      card.innerHTML='<h3>Rut Planı2 Haritası</h3><div id="route2MapInfo" class="muted" style="margin-bottom:10px"></div><div id="route2Map" style="height:520px;border-radius:12px;border:1px solid var(--brand-border)"></div>';
      section.querySelector('.grid')?.appendChild(card);
    }

    if(!section.dataset.route2ActionsBound){
      section.dataset.route2ActionsBound='1';
      document.getElementById('route2Week')?.addEventListener('change',()=>setTimeout(()=>{removeDraft();renderRoute2Map();setStatus('Yeni gün seçildi. Planı yükleyebilir veya doğrudan optimize edebilirsin.');},0));
      document.getElementById('route2Day')?.addEventListener('change',()=>setTimeout(()=>{removeDraft();renderRoute2Map();setStatus('Yeni gün seçildi. Planı yükleyebilir veya doğrudan optimize edebilirsin.');},0));
    }

    setTimeout(renderRoute2Workspace,30);
    return true;
  }

  window.loadRoute2Today=loadRoute2Today;
  window.optimizeRoute2=optimizeRoute2;
  window.publishRoute2=publishRoute2;
  window.clearRoute2Today=clearRoute2Today;
  window.markRoute2Visited=markRoute2Visited;
  window.undoRoute2Visited=undoRoute2Visited;
  window.renderRoute2Workspace=renderRoute2Workspace;

  function boot(){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(installControls()||tries>50)clearInterval(timer);
    },100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
