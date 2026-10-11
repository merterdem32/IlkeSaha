// Ilke Saha - Rut/Bayi mutabakat katmani
// Referans: ISTANBUL RUT PLANI.xlsx + kullanici karari (12 rut disi, 4 aktif geri eklenecek)
(()=>{
  const INACTIVE_NAMES=[
    'GÖKSUN ÖZTÜRK-HYK HAFRİYAT VE NAKLİYAT OTO LASTİK TAMİRAT VE TİCARET-BAYBARS ELEKTRİK',
    'WOSCAR OTOMOTİV FIRAT USTA',
    'RECEP MEŞE',
    'ERDEN RULMAN SANAYİ VE TİCARET NURTEN ERDEN',
    'REY CAR SERVİS - MAHMUT KURUM',
    'MEHMET POLAT - MMC OTO',
    'SAĞLAM TRUCK OTOMOTİV NAKLİYAT HAFRİYAT -KADİR TOP',
    'FİX SERVİS OTOMOTİV VE TİC.SAN.LTD.ŞTİ.',
    'MUHAMMET SERKAN YAVUZ',
    'ONUR ALANLAR',
    'YK GROUP ALTERNATİF ENERJİ',
    'İZMİRLİ ROT BALANS - MURAT BOZDEMİR'
  ];

  const ACTIVE=[
    {
      key:'turpa',
      name:'TURPA OTOMOTİV SANAYİ VE TİCARET A.Ş./SADIK BEY',
      phone:'0212 422 69 00', district:'ESENYURT', address:'ZAFER MAH. 154. SOK. NO : 10',
      plannedWeek:'2. HAFTA',plannedDay:'PAZARTESİ',plannedOrder:16
    },
    {
      key:'mert',
      name:'MERT OTO LASTİK-ALİ TOPRAK',
      phone:'0530 870 48 75',district:'YEŞİLKENT',address:'YEŞİLKENT MAH. ATATÜRK CAD. OTO YIKAMA NO:37 AVCILAR/İST',
      plannedWeek:'2. HAFTA',plannedDay:'SALI',plannedOrder:14,generalNote:'POTANSİYELİ GÜÇLÜ'
    },
    {
      key:'atila',
      name:'ATİLA BAĞCI-IĞDIRLI OTOMOTİV',
      phone:'0536 674 53 88',district:'İKİTELLİ - DOLAPDERE SANAYİ SİT.',address:'İKİTELLİ OSB DOLAPDERE SANAYİ SİTESİ 11.ADA NO:30',
      plannedWeek:'2. HAFTA',plannedDay:'ÇARŞAMBA',plannedOrder:15
    },
    {
      key:'ramazan',
      name:'RAMAZAN ERYILMAZ',
      phone:'0541 571 41 02',district:'SEFAKÖY',address:'FEVZİ ÇAKMAK MAH. HALKALI CAD. SEFAKÖY İŞ MERKEZİ NO : 209/36 KÜÇÜKÇEKMECE- İSTANBUL',
      plannedWeek:'2. HAFTA',plannedDay:'ÇARŞAMBA',plannedOrder:19
    }
  ];

  const norm=v=>String(v||'').trim().toLocaleUpperCase('tr-TR')
    .replace(/[“”"'`´]/g,'').replace(/\s+/g,' ').replace(/\s*[-–—]\s*/g,'-');
  const loose=v=>norm(v).replace(/[^A-ZÇĞİÖŞÜ0-9]/g,'');
  const esc2=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));

  const findByNames=(names)=>{
    if(!Array.isArray(window.state?.dealers))return null;
    const nn=names.map(norm), ll=names.map(loose);
    return state.dealers.find(d=>nn.includes(norm(d.name))) || state.dealers.find(d=>ll.includes(loose(d.name))) || null;
  };

  function findActiveDef(def){
    const aliases=[def.name];
    if(def.key==='turpa')aliases.push('TURPA OTOMOTİV SANAYİ VE TİCARET A.Ş. SADIK BEY');
    if(def.key==='atila')aliases.push('ATILLA BAĞCI-IĞDIRLI OTOMOTİV');
    return findByNames(aliases);
  }

  function findIzmirli(){
    return findByNames([
      'İZMİRLİ ROT BALANS - MURAT BOZDEMİR',
      'İZMİRLİ ROT BALANS - ÇÖZÜM OTO ELEKTRİK - MURAT BOZDEMİR'
    ]);
  }

  let reconciling=false;
  async function reconcileDealers(){
    if(reconciling||!window.state||!Array.isArray(state.dealers)||!window.cloudUser)return;
    reconciling=true;
    try{
      let changed=false;

      // Kullanici tarafindan rut disi olarak onaylanan kayitlar.
      for(const name of INACTIVE_NAMES){
        let d=null;
        if(name==='İZMİRLİ ROT BALANS - MURAT BOZDEMİR')d=findIzmirli();
        else d=findByNames([name]);
        if(d && d.isActive!==false){d.isActive=false;changed=true;}
      }

      // Aktif kalmasi gereken dort kayit. Eksikse geri olustur, varsa gecmis/koordinati koru.
      for(const def of ACTIVE){
        let d=findActiveDef(def);
        if(!d){
          d={
            id:crypto.randomUUID(),name:def.name,contact:'',phone:def.phone||'',district:def.district||'',address:def.address||'',
            lat:null,lng:null,locationStatus:'unset',frequency:14,priority:1,generalNote:def.generalNote||'',
            plannedWeek:def.plannedWeek,plannedDay:def.plannedDay,plannedOrder:def.plannedOrder,
            plannedStage:'',originalRouteLogic:'',departure:'08:30',isActive:true,
            assignedUserId:teamContext?.role==='FIELD_STAFF'?cloudUser.id:null,
            _ownerUserId:cloudUser.id,_createdBy:cloudUser.id
          };
          state.dealers.push(d);changed=true;
        }else{
          if(d.isActive===false){d.isActive=true;changed=true;}
          if(d.plannedWeek!==def.plannedWeek){d.plannedWeek=def.plannedWeek;changed=true;}
          if(d.plannedDay!==def.plannedDay){d.plannedDay=def.plannedDay;changed=true;}
          if(Number(d.plannedOrder)!==Number(def.plannedOrder)){d.plannedOrder=def.plannedOrder;changed=true;}
          if(!d.phone&&def.phone){d.phone=def.phone;changed=true;}
          if(!d.district&&def.district){d.district=def.district;changed=true;}
          if(!d.address&&def.address){d.address=def.address;changed=true;}
          if(!d.assignedUserId&&teamContext?.role==='FIELD_STAFF'){d.assignedUserId=cloudUser.id;changed=true;}
        }
      }

      // Izmirli kaydi aktif olmali ve yeni referans planda 2. hafta Sali 21. sirada.
      const iz=findIzmirli();
      if(iz){
        if(iz.isActive===false){iz.isActive=true;changed=true;}
        if(iz.plannedWeek!=='2. HAFTA'){iz.plannedWeek='2. HAFTA';changed=true;}
        if(iz.plannedDay!=='SALI'){iz.plannedDay='SALI';changed=true;}
        if(Number(iz.plannedOrder)!==21){iz.plannedOrder=21;changed=true;}
      }

      if(changed){
        try{localStorage.setItem(window.storeKey||'ilkeSahaState',JSON.stringify(state));}catch(_){ }
        if(typeof window.renderAll==='function')window.renderAll();
        if(typeof window.syncStateToCloud==='function')setTimeout(()=>window.syncStateToCloud(false),300);
      }
    }catch(err){console.warn('Rut/bayi mutabakati uygulanamadi',err);}
    finally{reconciling=false;}
  }

  // Rut Plani2 kaynak listesine eksik aktif bayileri ekle; Izmirli'yi Cuma'dan Sali'ya tasi.
  function installRoute2Bridge(){
    if(typeof window.route2CurrentSourceIds!=='function'||typeof window.route2DealerBySource!=='function'||window.__route2ReconcileBridge)return false;
    window.__route2ReconcileBridge=true;
    const oldIds=window.route2CurrentSourceIds;
    const oldDealer=window.route2DealerBySource;
    const EXTRA={901:'mert',902:'atila',903:'ramazan',904:'turpa'};

    window.route2DealerBySource=function(n){
      if(n===121){return findIzmirli()||oldDealer(n);}
      const key=EXTRA[n];
      if(key){const def=ACTIVE.find(x=>x.key===key);return def?findActiveDef(def):null;}
      return oldDealer(n);
    };

    window.route2CurrentSourceIds=function(){
      let ids=(oldIds()||[]).slice();
      const w=Number(document.getElementById('route2Week')?.value||1);
      const d=document.getElementById('route2Day')?.value||'Pazartesi';
      const k=w+'|'+d;
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
    return '<div class="item route-stop route2-reconciled" data-route2-source="'+source+'" data-order="'+order+'">'+
      '<div class="num">'+order+'</div><div class="route-info"><strong>'+esc2(d.name)+'</strong>'+ 
      '<span class="muted">'+esc2(d.district||'-')+(d.phone?' • '+esc2(d.phone):'')+'</span>'+ 
      (d.address?'<span class="muted" style="margin-top:3px">'+esc2(d.address)+'</span>':'')+
      '<div style="margin-top:6px">'+(hasCoord?'<span class="badge b-ok">Konum var</span>':'<span class="badge b-warn">Koordinat eksik</span>')+'</div></div>'+ 
      '<div class="toolbar route-actions"><button class="btn btn-ghost" onclick="showDealer(\''+d.id+'\')">Bayi Aç</button>'+ 
      '<button class="btn btn-primary" onclick="openVisitModal(\''+d.id+'\')">Görüşme Notu</button>'+ 
      '<button class="btn btn-accent" onclick="openGoogleMapsDirections(\''+d.id+'\')">Yol Tarifi</button></div></div>';
  }

  function patchRoute2List(){
    const list=document.getElementById('route2List');
    if(!list||!window.state)return;
    installRoute2Bridge();
    list.querySelectorAll('.route2-reconciled').forEach(x=>x.remove());
    const w=Number(document.getElementById('route2Week')?.value||1), day=document.getElementById('route2Day')?.value||'Pazartesi';
    const wanted=[];
    if(w===2&&day==='Pazartesi')wanted.push([904,ACTIVE.find(x=>x.key==='turpa')]);
    if(w===2&&day==='Salı')wanted.push([901,ACTIVE.find(x=>x.key==='mert')]);
    if(w===2&&day==='Çarşamba')wanted.push([902,ACTIVE.find(x=>x.key==='atila')],[903,ACTIVE.find(x=>x.key==='ramazan')]);
    for(const [src,def] of wanted){
      const d=findActiveDef(def);if(!d||d.isActive===false)continue;
      const exists=[...list.querySelectorAll('.route-info strong')].some(x=>loose(x.textContent)===loose(d.name));
      if(exists)continue;
      const wrap=document.createElement('div');wrap.innerHTML=route2Row(d,src,def.plannedOrder);const row=wrap.firstElementChild;
      // Plan sirasina gore uygun noktaya yerlestir.
      const rows=[...list.querySelectorAll('.route-stop')];
      let inserted=false;
      for(const r of rows){
        const n=Number(r.querySelector('.num')?.textContent||999);
        if(n>def.plannedOrder){list.insertBefore(row,r);inserted=true;break;}
      }
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
        const q=String(document.getElementById('dealerSearch')?.value||'').trim();
        if(!q)return result;
        const nq=loose(q), body=document.getElementById('dealerRows');if(!body)return result;
        const inactive=(state.dealers||[]).filter(d=>d.isActive===false && (!window.dealerVisibleToCurrentUser||dealerVisibleToCurrentUser(d)))
          .filter(d=>[d.name,d.contact,d.phone,d.district,d.address].some(v=>loose(v).includes(nq)));
        for(const d of inactive){
          if(body.querySelector('[data-inactive-dealer-id="'+CSS.escape(d.id)+'"]'))continue;
          const last=(state.visits||[]).filter(v=>v.dealerId===d.id).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
          const tr=document.createElement('tr');tr.dataset.inactiveDealerId=d.id;
          const loc=(typeof isValidDealerCoordinate==='function'&&isValidDealerCoordinate(d.lat,d.lng))?'<span class="badge b-ok">Konum var</span>':'<span class="badge b-warn">Konum girilmedi</span>';
          tr.innerHTML='<td><strong>'+esc2(d.name)+'</strong><br><span class="badge b-warn">Rut Dışı</span></td>'+ 
            '<td>'+esc2(d.contact||'-')+'</td><td>'+esc2(d.address||d.district||'-')+'</td><td>'+loc+'</td>'+ 
            '<td>'+(last?new Date(last.date).toLocaleDateString('tr-TR'):'-')+'</td>'+ 
            '<td class="manager-only-col">'+esc2(typeof salespersonLabel==='function'?salespersonLabel(d.assignedUserId):(d.assignedUserId||'-'))+'</td>'+ 
            '<td class="manager-only-col">-</td>'+ 
            '<td><div class="toolbar"><button class="btn btn-ghost" onclick="showDealer(\''+d.id+'\')">Aç</button>'+ 
            '<button class="btn btn-accent" onclick="openGoogleMapsDirections(\''+d.id+'\')">Yol Tarifi</button></div></td>';
          body.appendChild(tr);
        }
      }catch(err){console.warn('Rut disi bayi arama ekleme hatasi',err);}
      return result;
    };
    return true;
  }

  // Cloud yuklemesi state'i yenilediginde mutabakati yeniden uygula.
  function wrapCloudLoad(){
    if(typeof window.loadStateFromCloud!=='function'||window.__reconcileCloudWrapped)return false;
    window.__reconcileCloudWrapped=true;
    const original=window.loadStateFromCloud;
    window.loadStateFromCloud=async function(...args){const r=await original.apply(this,args);await reconcileDealers();return r;};
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    installRoute2Bridge();installInactiveDealerSearch();wrapCloudLoad();
    reconcileDealers();
    patchRoute2List();
    if(tries>240)clearInterval(timer);
  },500);
})();