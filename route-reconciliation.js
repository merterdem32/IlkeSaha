// İlke Saha - legacy mutabakat katmanı (Route2 görünüm desteği בלבד)
// Yeni Saha1 Rut Planı artık ayrı plan kaynağından yönetilir; bu dosya ROUTE1 plannedWeek/day/order alanlarına dokunmaz.
(()=>{
  const ACTIVE=[
    {key:'turpa',name:'TURPA OTOMOTİV SANAYİ VE TİCARET A.Ş./SADIK BEY',plannedOrder:16},
    {key:'mert',name:'MERT OTO LASTİK-ALİ TOPRAK',plannedOrder:14},
    {key:'atila',name:'ATİLA BAĞCI-IĞDIRLI OTOMOTİV',plannedOrder:15},
    {key:'ramazan',name:'RAMAZAN ERYILMAZ',plannedOrder:19}
  ];
  const norm=v=>String(v||'').trim().toLocaleUpperCase('tr-TR').replace(/[“”"'`´]/g,'').replace(/\s+/g,' ').replace(/\s*[-–—]\s*/g,'-');
  const loose=v=>norm(v).replace(/[^A-ZÇĞİÖŞÜ0-9]/g,'');
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const findByNames=names=>{
    if(!Array.isArray(window.state?.dealers))return null;
    const nn=names.map(norm),ll=names.map(loose);
    return state.dealers.find(d=>nn.includes(norm(d.name)))||state.dealers.find(d=>ll.includes(loose(d.name)))||null;
  };
  function findActiveDef(def){
    const aliases=[def.name];
    if(def.key==='turpa')aliases.push('TURPA OTOMOTİV SANAYİ VE TİCARET A.Ş. SADIK BEY');
    if(def.key==='atila')aliases.push('ATILLA BAĞCI-IĞDIRLI OTOMOTİV');
    return findByNames(aliases);
  }
  function findIzmirli(){return findByNames(['İZMİRLİ ROT BALANS - MURAT BOZDEMİR','İZMİRLİ ROT BALANS - ÇÖZÜM OTO ELEKTRİK - MURAT BOZDEMİR']);}

  function installRoute2Bridge(){
    if(typeof window.route2CurrentSourceIds!=='function'||typeof window.route2DealerBySource!=='function'||window.__route2ReconcileBridge)return false;
    window.__route2ReconcileBridge=true;
    const oldIds=window.route2CurrentSourceIds,oldDealer=window.route2DealerBySource;
    const EXTRA={901:'mert',902:'atila',903:'ramazan',904:'turpa'};
    window.route2DealerBySource=function(n){
      if(n===121)return findIzmirli()||oldDealer(n);
      const key=EXTRA[n];
      if(key){const def=ACTIVE.find(x=>x.key===key);return def?findActiveDef(def):null;}
      return oldDealer(n);
    };
    window.route2CurrentSourceIds=function(){
      let ids=(oldIds()||[]).slice();
      const w=Number(document.getElementById('route2Week')?.value||1),d=document.getElementById('route2Day')?.value||'Pazartesi',k=w+'|'+d;
      if(k==='2|Pazartesi'&&!ids.includes(904))ids.push(904);
      if(k==='2|Salı'){
        ids=ids.filter(x=>x!==121);
        if(!ids.includes(901))ids.push(901);
        if(findIzmirli()&&!ids.includes(121))ids.push(121);
      }
      if(k==='2|Çarşamba'){
        if(!ids.includes(902))ids.push(902);
        if(!ids.includes(903))ids.push(903);
      }
      if(k==='2|Cuma')ids=ids.filter(x=>x!==121);
      return ids;
    };
    return true;
  }

  function route2Row(d,source,order){
    const hasCoord=typeof isValidDealerCoordinate==='function'&&isValidDealerCoordinate(d.lat,d.lng);
    return '<div class="item route-stop route2-reconciled" data-route2-source="'+source+'" data-order="'+order+'"><div class="num">'+order+'</div><div class="route-info"><strong>'+esc(d.name)+'</strong><span class="muted">'+esc(d.district||'-')+(d.phone?' • '+esc(d.phone):'')+'</span>'+(d.address?'<span class="muted" style="margin-top:3px">'+esc(d.address)+'</span>':'')+'<div style="margin-top:6px">'+(hasCoord?'<span class="badge b-ok">Konum var</span>':'<span class="badge b-warn">Koordinat eksik</span>')+'</div></div><div class="toolbar route-actions"><button class="btn btn-ghost" onclick="showDealer(\''+d.id+'\')">Bayi Aç</button><button class="btn btn-primary" onclick="openVisitModal(\''+d.id+'\')">Görüşme Notu</button><button class="btn btn-accent" onclick="openGoogleMapsDirections(\''+d.id+'\')">Yol Tarifi</button></div></div>';
  }

  function patchRoute2List(){
    const list=document.getElementById('route2List');if(!list||!window.state)return;
    installRoute2Bridge();
    list.querySelectorAll('.route2-reconciled').forEach(x=>x.remove());
    const w=Number(document.getElementById('route2Week')?.value||1),day=document.getElementById('route2Day')?.value||'Pazartesi';
    const wanted=[];
    if(w===2&&day==='Pazartesi')wanted.push([904,ACTIVE.find(x=>x.key==='turpa')]);
    if(w===2&&day==='Salı')wanted.push([901,ACTIVE.find(x=>x.key==='mert')]);
    if(w===2&&day==='Çarşamba')wanted.push([902,ACTIVE.find(x=>x.key==='atila')],[903,ACTIVE.find(x=>x.key==='ramazan')]);
    for(const [src,def] of wanted){
      const d=findActiveDef(def);if(!d||d.isActive===false)continue;
      const exists=[...list.querySelectorAll('.route-info strong')].some(x=>loose(x.textContent)===loose(d.name));if(exists)continue;
      const wrap=document.createElement('div');wrap.innerHTML=route2Row(d,src,def.plannedOrder);const row=wrap.firstElementChild;
      const rows=[...list.querySelectorAll('.route-stop')];let inserted=false;
      for(const r of rows){const n=Number(r.querySelector('.num')?.textContent||999);if(n>def.plannedOrder){list.insertBefore(row,r);inserted=true;break;}}
      if(!inserted)list.appendChild(row);
    }
  }

  function installInactiveDealerSearch(){
    if(typeof window.renderDealers!=='function'||window.__inactiveSearchWrapped)return false;
    window.__inactiveSearchWrapped=true;
    const original=window.renderDealers;
    window.renderDealers=function(...args){
      const result=original.apply(this,args);
      try{
        const q=String(document.getElementById('dealerSearch')?.value||'').trim();if(!q)return result;
        const nq=loose(q),body=document.getElementById('dealerRows');if(!body)return result;
        const inactive=(state.dealers||[]).filter(d=>d.isActive===false&&(!window.dealerVisibleToCurrentUser||dealerVisibleToCurrentUser(d))).filter(d=>[d.name,d.contact,d.phone,d.district,d.address].some(v=>loose(v).includes(nq)));
        for(const d of inactive){
          if(body.querySelector('[data-inactive-dealer-id="'+CSS.escape(d.id)+'"]'))continue;
          const last=(state.visits||[]).filter(v=>v.dealerId===d.id).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
          const tr=document.createElement('tr');tr.dataset.inactiveDealerId=d.id;
          const loc=(typeof isValidDealerCoordinate==='function'&&isValidDealerCoordinate(d.lat,d.lng))?'<span class="badge b-ok">Konum var</span>':'<span class="badge b-warn">Konum girilmedi</span>';
          tr.innerHTML='<td><strong>'+esc(d.name)+'</strong><br><span class="badge b-warn">Rut Dışı</span></td><td>'+esc(d.contact||'-')+'</td><td>'+esc(d.address||d.district||'-')+'</td><td>'+loc+'</td><td>'+(last?new Date(last.date).toLocaleDateString('tr-TR'):'-')+'</td><td class="manager-only-col">'+esc(typeof salespersonLabel==='function'?salespersonLabel(d.assignedUserId):(d.assignedUserId||'-'))+'</td><td class="manager-only-col">-</td><td><div class="toolbar"><button class="btn btn-ghost" onclick="showDealer(\''+d.id+'\')">Aç</button><button class="btn btn-accent" onclick="openGoogleMapsDirections(\''+d.id+'\')">Yol Tarifi</button></div></td>';
          body.appendChild(tr);
        }
      }catch(err){console.warn('Rut dışı bayi arama ekleme hatası',err);}
      return result;
    };
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;installRoute2Bridge();installInactiveDealerSearch();patchRoute2List();
    if(tries>240)clearInterval(timer);
  },500);
})();