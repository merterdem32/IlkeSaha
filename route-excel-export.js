// İlke Saha - Rut Planı / Rut Planı2 yüklü rota Excel çıktısı
(()=>{
  let xlsxPromise=null;
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

  function rowForDealer(d,index){
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
    return {
      type:'Rut Planı',
      week:document.getElementById('planWeek')?.value||'',
      day:document.getElementById('planDay')?.value||'',
      dealers
    };
  }

  function route2Data(){
    const rows=[...document.querySelectorAll('#route2List .route-stop[data-route2-source]')];
    const dealers=rows.map(row=>{
      const source=Number(row.dataset.route2Source);
      try{
        if(typeof window.route2DealerBySource==='function')return window.route2DealerBySource(source);
      }catch(_){ }
      return null;
    }).filter(d=>d&&d.isActive!==false);
    return {
      type:'Rut Planı2',
      week:document.getElementById('route2Week')?.value||'',
      day:document.getElementById('route2Day')?.value||'',
      dealers
    };
  }

  async function exportRoute(kind){
    const data=kind==='route2'?route2Data():route1Data();
    if(!data.dealers.length){
      alert('Önce bu sekmede bir rota planı yükle. Excel çıktısı ekranda yüklü olan rotadan oluşturulur.');
      return;
    }
    const ok=await loadXlsx();
    if(!ok){alert('Excel bileşeni yüklenemedi. İnternet bağlantısını kontrol edip tekrar dene.');return;}

    const rows=data.dealers.map(rowForDealer);
    const wb=XLSX.utils.book_new();
    const ws=XLSX.utils.json_to_sheet(rows,{header:['Sıra','Cari Kodu','Bayi','İlçe','Adres','Telefon','Yetkili','Enlem','Boylam']});
    ws['!cols']=[{wch:7},{wch:16},{wch:42},{wch:18},{wch:52},{wch:18},{wch:22},{wch:14},{wch:14}];
    XLSX.utils.book_append_sheet(wb,ws,'Yüklü Rut');

    const summary=[
      ['İLKE SAHA - RUT ÇIKTISI'],
      ['Plan',data.type],
      ['Hafta',data.week],
      ['Gün',data.day],
      ['Toplam Bayi',data.dealers.length],
      ['Oluşturma Tarihi',new Date().toLocaleString('tr-TR')]
    ];
    const sws=XLSX.utils.aoa_to_sheet(summary);
    sws['!cols']=[{wch:22},{wch:42}];
    XLSX.utils.book_append_sheet(wb,sws,'Özet');

    const name=['Ilke_Saha',escFile(data.type),escFile(data.week),escFile(data.day)].filter(Boolean).join('_')+'.xlsx';
    XLSX.writeFile(wb,name);
  }

  function makeButton(id,label,kind){
    const b=document.createElement('button');
    b.id=id;b.type='button';b.className='btn btn-primary';b.style.width='100%';b.style.marginTop='8px';
    b.textContent='Excel Olarak İndir';
    b.title=label;
    b.onclick=()=>exportRoute(kind);
    return b;
  }

  function ensureRoute1Button(){
    if(document.getElementById('routeExcelExportBtn'))return;
    const sec=document.getElementById('route');if(!sec)return;
    const left=sec.querySelector('.card.span-4');if(!left)return;
    const clear=[...left.querySelectorAll('button')].find(b=>String(b.getAttribute('onclick')||'').includes('clearTodayRoute'));
    const b=makeButton('routeExcelExportBtn','Rut Planı sekmesinde yüklü olan rotayı Excel olarak indir','route1');
    if(clear)clear.insertAdjacentElement('afterend',b);else left.appendChild(b);
  }

  function ensureRoute2Button(){
    if(document.getElementById('route2ExcelExportBtn'))return;
    const sec=document.getElementById('route2');if(!sec)return;
    const list=document.getElementById('route2List');
    const card=list?.closest('.card')||sec.querySelector('.card');if(!card)return;
    const b=makeButton('route2ExcelExportBtn','Rut Planı2 sekmesinde yüklü olan rotayı Excel olarak indir','route2');
    const toolbar=card.querySelector('.toolbar');
    if(toolbar)toolbar.appendChild(b);else card.insertBefore(b,list||card.firstChild);
  }

  function ensureButtons(){ensureRoute1Button();ensureRoute2Button();}
  window.exportLoadedRouteExcel=exportRoute;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(ensureButtons,100),{once:true});else setTimeout(ensureButtons,0);
  const obs=new MutationObserver(()=>{clearTimeout(window.__routeExcelEnsureTimer);window.__routeExcelEnsureTimer=setTimeout(ensureButtons,40);});
  if(document.body)obs.observe(document.body,{childList:true,subtree:true});
})();