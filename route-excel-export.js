// İlke Saha - Rut Planı / Rut Planı2 Excel çıktıları
(()=>{
  let xlsxPromise=null;
  const DAYS=['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  const DRAFT_KEY='ilkeSahaRoute2DraftsV4';
  const escFile=v=>String(v||'').trim().replace(/[^A-Za-z0-9ÇĞİÖŞÜçğıöşü_-]+/g,'_').replace(/^_+|_+$/g,'');

  function dealerById(id){return (typeof state!=='undefined'&&Array.isArray(state.dealers))?state.dealers.find(d=>d.id===id)||null:null;}
  function validCoord(d){return typeof isValidDealerCoordinate==='function'&&isValidDealerCoordinate(d?.lat,d?.lng);}

  function loadXlsx(){
    if(window.XLSX)return Promise.resolve(true);
    if(xlsxPromise)return xlsxPromise;
    xlsxPromise=new Promise(resolve=>{
      const existing=document.getElementById('routeExportXlsxLib');
      if(existing){
        if(window.XLSX){resolve(true);return;}
        existing.addEventListener('load',()=>resolve(!!window.XLSX),{once:true});
        existing.addEventListener('error',()=>resolve(false),{once:true});
        setTimeout(()=>resolve(!!window.XLSX),7000);
        return;
      }
      const s=document.createElement('script');
      s.id='routeExportXlsxLib';
      s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload=()=>resolve(true);
      s.onerror=()=>resolve(false);
      document.head.appendChild(s);
    });
    return xlsxPromise;
  }

  function baseDealerRow(d,index){
    return {
      'Sıra':index+1,
      'Cari Kodu':d?.cariCode||'',
      'Bayi':d?.name||'',
      'İlçe':d?.district||'',
      'Adres':d?.address||'',
      'Telefon':d?.phone||'',
      'Yetkili':d?.contact||'',
      'Enlem':validCoord(d)?Number(d.lat):'',
      'Boylam':validCoord(d)?Number(d.lng):''
    };
  }

  function route1Data(){
    const ids=(typeof state!=='undefined'&&Array.isArray(state.todayRoute))?state.todayRoute.filter(Boolean):[];
    const dealers=ids.map(dealerById).filter(d=>d&&d.isActive!==false);
    return {type:'Rut Planı',week:document.getElementById('planWeek')?.value||'',day:document.getElementById('planDay')?.value||'',dealers};
  }

  function route2Data(){
    const rows=[...document.querySelectorAll('#route2List .route-stop[data-route2-source]')];
    const dealers=rows.map(row=>{
      const source=Number(row.dataset.route2Source);
      try{return typeof window.route2DealerBySource==='function'?window.route2DealerBySource(source):null;}catch(_){return null;}
    }).filter(d=>d&&d.isActive!==false);
    return {type:'Rut Planı2',week:document.getElementById('route2Week')?.value||'',day:document.getElementById('route2Day')?.value||'',dealers};
  }

  function route2Drafts(){
    try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')||{};}catch(_){return{};}
  }

  function dealerFromSource(source){
    try{return typeof window.route2DealerBySource==='function'?window.route2DealerBySource(Number(source)):null;}catch(_){return null;}
  }

  function fullRoute2Days(){
    const plan=window.route2Plan||{};
    const drafts=route2Drafts();
    const out=[];
    [1,2].forEach(week=>{
      DAYS.forEach(day=>{
        const key=week+'|'+day;
        const sourcePlan=plan[key]||{date:'',ids:[]};
        const draft=drafts[key];
        let dealers=[];
        if(Array.isArray(draft?.items)&&draft.items.length){
          dealers=draft.items.map(x=>dealerById(x.dealerId)||dealerFromSource(x.source)).filter(d=>d&&d.isActive!==false);
        }else{
          dealers=(sourcePlan.ids||[]).map(dealerFromSource).filter(d=>d&&d.isActive!==false);
        }
        out.push({week,day,date:sourcePlan.date||'',dealers,fromDraft:Array.isArray(draft?.items)&&draft.items.length>0});
      });
    });
    return out;
  }

  async function exportRoute(kind){
    const data=kind==='route2'?route2Data():route1Data();
    if(!data.dealers.length){alert('Önce bu sekmede bir rota planı yükle. Excel çıktısı ekranda yüklü olan rotadan oluşturulur.');return;}
    const ok=await loadXlsx();
    if(!ok){alert('Excel bileşeni yüklenemedi. İnternet bağlantısını kontrol edip tekrar dene.');return;}
    const rows=data.dealers.map(baseDealerRow);
    const wb=XLSX.utils.book_new();
    const ws=XLSX.utils.json_to_sheet(rows,{header:['Sıra','Cari Kodu','Bayi','İlçe','Adres','Telefon','Yetkili','Enlem','Boylam']});
    ws['!cols']=[{wch:7},{wch:16},{wch:42},{wch:18},{wch:52},{wch:18},{wch:22},{wch:14},{wch:14}];
    XLSX.utils.book_append_sheet(wb,ws,'Yüklü Rut');
    const summary=[['İLKE SAHA - RUT ÇIKTISI'],['Plan',data.type],['Hafta',data.week],['Gün',data.day],['Toplam Bayi',data.dealers.length],['Oluşturma Tarihi',new Date().toLocaleString('tr-TR')]];
    const sws=XLSX.utils.aoa_to_sheet(summary);sws['!cols']=[{wch:22},{wch:42}];XLSX.utils.book_append_sheet(wb,sws,'Özet');
    const name=['Ilke_Saha',escFile(data.type),escFile(data.week),escFile(data.day)].filter(Boolean).join('_')+'.xlsx';
    XLSX.writeFile(wb,name);
  }

  async function exportFullRoute2(){
    const days=fullRoute2Days();
    const total=days.reduce((n,d)=>n+d.dealers.length,0);
    if(!total){alert('Rut Planı2 içinde dışarı aktarılacak bayi bulunamadı.');return;}
    const ok=await loadXlsx();
    if(!ok){alert('Excel bileşeni yüklenemedi. İnternet bağlantısını kontrol edip tekrar dene.');return;}

    const wb=XLSX.utils.book_new();
    const allRows=[];
    days.forEach(d=>d.dealers.forEach((dealer,i)=>{
      const r=baseDealerRow(dealer,i);
      allRows.push({
        'Hafta':d.week+'. HAFTA',
        'Gün':d.day,
        'Tarih':d.date,
        'Gün Sırası':i+1,
        'Cari Kodu':r['Cari Kodu'],
        'Bayi':r['Bayi'],
        'İlçe':r['İlçe'],
        'Adres':r['Adres'],
        'Telefon':r['Telefon'],
        'Yetkili':r['Yetkili'],
        'Enlem':r['Enlem'],
        'Boylam':r['Boylam']
      });
    }));

    const full=XLSX.utils.json_to_sheet(allRows,{header:['Hafta','Gün','Tarih','Gün Sırası','Cari Kodu','Bayi','İlçe','Adres','Telefon','Yetkili','Enlem','Boylam']});
    full['!cols']=[{wch:11},{wch:14},{wch:13},{wch:11},{wch:16},{wch:42},{wch:18},{wch:52},{wch:18},{wch:22},{wch:14},{wch:14}];
    XLSX.utils.book_append_sheet(wb,full,'Komple Rut Planı2');

    [1,2].forEach(week=>{
      const weekRows=[];
      days.filter(d=>d.week===week).forEach(d=>d.dealers.forEach((dealer,i)=>{
        const r=baseDealerRow(dealer,i);
        weekRows.push({'Gün':d.day,'Tarih':d.date,'Gün Sırası':i+1,'Cari Kodu':r['Cari Kodu'],'Bayi':r['Bayi'],'İlçe':r['İlçe'],'Adres':r['Adres'],'Telefon':r['Telefon'],'Yetkili':r['Yetkili'],'Enlem':r['Enlem'],'Boylam':r['Boylam']});
      }));
      const ws=XLSX.utils.json_to_sheet(weekRows,{header:['Gün','Tarih','Gün Sırası','Cari Kodu','Bayi','İlçe','Adres','Telefon','Yetkili','Enlem','Boylam']});
      ws['!cols']=[{wch:14},{wch:13},{wch:11},{wch:16},{wch:42},{wch:18},{wch:52},{wch:18},{wch:22},{wch:14},{wch:14}];
      XLSX.utils.book_append_sheet(wb,ws,week+'. Hafta');
    });

    const summary=[['İLKE SAHA - KOMPLE RUT PLANI2'],['Toplam Hafta',2],['Toplam Gün',days.length],['Toplam Bayi',total],['Güncel taslak kullanılan gün',days.filter(d=>d.fromDraft).length],['Oluşturma Tarihi',new Date().toLocaleString('tr-TR')]];
    const sws=XLSX.utils.aoa_to_sheet(summary);sws['!cols']=[{wch:28},{wch:42}];XLSX.utils.book_append_sheet(wb,sws,'Özet');
    XLSX.writeFile(wb,'Ilke_Saha_Komple_Rut_Plani2.xlsx');
  }

  function makeButton(id,text,title,handler,cls='btn btn-primary'){
    const b=document.createElement('button');b.id=id;b.type='button';b.className=cls;b.style.width='100%';b.style.marginTop='8px';b.textContent=text;b.title=title;b.onclick=handler;return b;
  }

  function ensureRoute1Button(){
    if(document.getElementById('routeExcelExportBtn'))return;
    const sec=document.getElementById('route');if(!sec)return;
    const left=sec.querySelector('.card.span-4');if(!left)return;
    const clear=[...left.querySelectorAll('button')].find(b=>String(b.getAttribute('onclick')||'').includes('clearTodayRoute'));
    const b=makeButton('routeExcelExportBtn','Excel Olarak İndir','Rut Planı sekmesinde yüklü olan rotayı Excel olarak indir',()=>exportRoute('route1'));
    if(clear)clear.insertAdjacentElement('afterend',b);else left.appendChild(b);
  }

  function ensureRoute2Buttons(){
    const sec=document.getElementById('route2');if(!sec)return;
    const left=sec.querySelector('.card.span-4');
    const list=document.getElementById('route2List');
    const card=list?.closest('.card')||sec.querySelector('.card');
    if(!document.getElementById('route2ExcelExportBtn')&&card){
      const b=makeButton('route2ExcelExportBtn','Seçili Günü Excel İndir','Rut Planı2 sekmesinde ekranda yüklü olan günü Excel olarak indir',()=>exportRoute('route2'));
      const toolbar=card.querySelector('.toolbar');if(toolbar)toolbar.appendChild(b);else card.insertBefore(b,list||card.firstChild);
    }
    if(!document.getElementById('route2FullExcelExportBtn')&&left){
      const b=makeButton('route2FullExcelExportBtn','Komple Rut Planı2’yi Excel İndir','1. ve 2. haftadaki tüm Rut Planı2 listesini Excel olarak indir',exportFullRoute2,'btn btn-accent');
      left.appendChild(b);
    }
  }

  function ensureButtons(){ensureRoute1Button();ensureRoute2Buttons();}
  window.exportLoadedRouteExcel=exportRoute;
  window.exportFullRoute2Excel=exportFullRoute2;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(ensureButtons,100),{once:true});else setTimeout(ensureButtons,0);
  const obs=new MutationObserver(()=>{clearTimeout(window.__routeExcelEnsureTimer);window.__routeExcelEnsureTimer=setTimeout(ensureButtons,40);});
  if(document.body)obs.observe(document.body,{childList:true,subtree:true});
})();