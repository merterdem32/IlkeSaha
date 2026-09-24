function activeFieldStaffDirectory(){
  if(typeof managerDirectoryCache!=='undefined' && managerDirectoryCache?.members?.length){
    return managerDirectoryCache.members
      .filter(m=>m.role==='FIELD_STAFF' && m.is_active!==false)
      .map(m=>{
        const p=managerDirectoryCache.profiles.get(m.user_id)||{};
        return {userId:m.user_id,username:p.username||'',fullName:p.full_name||'',email:p.email||''};
      });
  }

  if(typeof teamProfilesById!=='undefined' && teamProfilesById){
    return [...teamProfilesById.entries()].map(([userId,p])=>({
      userId,username:p.username||'',fullName:p.full_name||'',email:p.email||''
    })).filter(x=>x.username && x.username.toLowerCase().startsWith('saha'));
  }
  return [];
}

function salespersonLabel(userId){
  if(!userId)return 'Atanmamış';
  const p=(typeof teamProfilesById!=='undefined'&&teamProfilesById)?teamProfilesById.get(userId):null;
  return p?.full_name||p?.username||p?.email||'Kullanıcı';
}

async function populateDealerAssigneeSelect(selectedId=null){
  const select=document.getElementById('dealerAssignedUser');
  if(!select)return;

  if(typeof loadManagerDirectory==='function' && teamContext?.role==='MANAGER'){
    try{ await loadManagerDirectory(); }catch(_){}
  }

  const staff=activeFieldStaffDirectory();
  const current=selectedId || select.value || (teamContext?.role==='FIELD_STAFF'?cloudUser?.id:null);
  select.innerHTML='<option value="">Sorumlu seçilmedi</option>'+staff.map(s=>{
    const label=s.fullName||s.username||s.email||s.userId;
    return '<option value="'+esc(s.userId)+'">'+esc(label)+(s.username?' ('+esc(s.username)+')':'')+'</option>';
  }).join('');

  if(current && [...select.options].some(o=>o.value===current)) select.value=current;
}

function dealerVisibleToCurrentUser(d){
  if(typeof teamContext==='undefined'||!teamContext?.role)return true;
  if(teamContext.role==='MANAGER')return true;
  if(teamContext.role==='FIELD_STAFF'){
    return d.assignedUserId===cloudUser?.id;
  }
  return true;
}

async function openDealerExcelImport(){
  if(teamContext?.role!=='MANAGER'){
    alert('Excel ile toplu bayi yükleme yalnızca yönetici hesabından yapılabilir.');
    return;
  }

  await loadManagerDirectory();
  const select=document.getElementById('excelAssignedUser');
  const staff=activeFieldStaffDirectory();
  select.innerHTML=staff.map(s=>{
    const label=s.fullName||s.username||s.email||s.userId;
    return '<option value="'+esc(s.userId)+'">'+esc(label)+(s.username?' ('+esc(s.username)+')':'')+'</option>';
  }).join('');

  document.getElementById('dealerExcelFile').value='';
  document.getElementById('excelImportPreview').innerHTML='<div class="muted">Excel dosyasını seç. İlk sayfa okunacak ve yüklemeden önce önizleme gösterilecek.</div>';
  window.__dealerExcelRows=[];
  dealerExcelDialog.showModal();
}

function normalizeExcelHeader(value){
  return String(value||'')
    .trim().toLocaleLowerCase('tr-TR')
    .replaceAll('ı','i').replaceAll('ş','s').replaceAll('ğ','g')
    .replaceAll('ü','u').replaceAll('ö','o').replaceAll('ç','c')
    .replace(/[^a-z0-9]+/g,'');
}

function excelValue(row,candidates){
  const keys=Object.keys(row);
  for(const candidate of candidates){
    const target=normalizeExcelHeader(candidate);
    const key=keys.find(k=>normalizeExcelHeader(k)===target);
    if(key && String(row[key]??'').trim()!=='')return row[key];
  }
  for(const candidate of candidates){
    const target=normalizeExcelHeader(candidate);
    const key=keys.find(k=>normalizeExcelHeader(k).includes(target));
    if(key && String(row[key]??'').trim()!=='')return row[key];
  }
  return '';
}

function excelNumber(value){
  if(value===null||value===undefined||value==='')return null;
  const n=Number(String(value).replace(',','.'));
  return Number.isFinite(n)?n:null;
}

async function previewDealerExcel(){
  const input=document.getElementById('dealerExcelFile');
  const file=input?.files?.[0];
  const preview=document.getElementById('excelImportPreview');
  if(!file){ preview.innerHTML='<div class="muted">Dosya seçilmedi.</div>'; return; }
  if(typeof XLSX==='undefined'){
    preview.innerHTML='<div class="muted">Excel okuyucu yüklenemedi. İnternet bağlantısını kontrol et.</div>';
    return;
  }

  try{
    window.__dealerExcelRows=[];
    if(preview) preview.innerHTML='<div class="muted">Excel okunuyor…</div>';
    const data=await file.arrayBuffer();
    const wb=XLSX.read(data,{type:'array'});
    let parsed=[];

    // Trakya tipi rut dosyası: 1. HAFTA ve 2. HAFTA ayrı sayfalarda,
    // başlık satırı 4. satırda. TELEFON-AYLIK ve özet sayfaları bayi
    // ana rutuna dahil edilmez.
    const weekSheets=wb.SheetNames.filter(name=>{
      const n=normalizeExcelHeader(name);
      return n==='1hafta'||n==='2hafta';
    });

    if(weekSheets.length){
      for(const sheetName of weekSheets){
        const week=normalizeExcelHeader(sheetName)==='1hafta'?'1. HAFTA':'2. HAFTA';
        const ws=wb.Sheets[sheetName];
        const raw=XLSX.utils.sheet_to_json(ws,{defval:'',raw:false,range:3});

        const rows=raw.map((r,index)=>{
          const name=String(excelValue(r,['SATIŞ NOKTASI','Satis Noktasi','Bayi','Bayi Adı','Firma','Ünvan','Müşteri'])).trim();
          if(!name)return null;

          const corridor=String(excelValue(r,['KORİDOR','Koridor'])).trim();
          const cluster=String(excelValue(r,['KONUM KÜMESİ','Konum Kumesi','Aşama','Etap'])).trim();
          const efficiency=String(excelValue(r,['VERİMLİLİK','Verimlilik'])).trim();
          const note=String(excelValue(r,['NOTLAR','Notlar','Not','Açıklama'])).trim();
          const generalNote=[note,efficiency?('Verimlilik: '+efficiency):''].filter(Boolean).join(' • ');

          return {
            _excelSheet:sheetName,
            _excelRow:index+5,
            name,
            contact:'',
            phone:String(excelValue(r,['İRTİBAT NO','Irtibat No','Telefon','Tel','Gsm','Cep'])).trim(),
            district:String(excelValue(r,['KONUM / İLÇE','Konum Ilce','İlçe','Ilce','Bölge'])).trim(),
            address:String(excelValue(r,['ADRES','Adres'])).trim(),
            lat:null,
            lng:null,
            plannedWeek:week,
            plannedDay:String(excelValue(r,['ZİYARET GÜNÜ','Ziyaret Gunu','Gün','Gun'])).trim().toLocaleUpperCase('tr-TR'),
            plannedOrder:excelNumber(excelValue(r,['RUT SIRA','Rut Sira','Sıra','Sira'])),
            plannedStage:cluster,
            originalRouteLogic:corridor,
            generalNote,
            frequency:14,
            priority:efficiency.toLocaleUpperCase('tr-TR').includes('YÜKSEK')?2:1
          };
        }).filter(Boolean);

        parsed.push(...rows);
      }
    }else{
      // Genel Excel formatı: ilk sayfayı standart başlıklardan okumaya devam et.
      const ws=wb.Sheets[wb.SheetNames[0]];
      const raw=XLSX.utils.sheet_to_json(ws,{defval:'',raw:false});

      parsed=raw.map((r,index)=>{
        const name=String(excelValue(r,['Bayi','Bayi Adı','Firma','Firma Adı','Ünvan','Unvan','Müşteri','Cari','Name'])).trim();
        if(!name)return null;
        return {
          _excelRow:index+2,
          name,
          contact:String(excelValue(r,['Yetkili','İlgili','İlgili Kişi','Contact'])).trim(),
          phone:String(excelValue(r,['Telefon','Tel','Gsm','Cep','Phone'])).trim(),
          district:String(excelValue(r,['İlçe','Ilce','Bölge','Bolge','Semt','District'])).trim(),
          address:String(excelValue(r,['Adres','Address'])).trim(),
          lat:excelNumber(excelValue(r,['Enlem','Latitude','Lat'])),
          lng:excelNumber(excelValue(r,['Boylam','Longitude','Lng','Lon'])),
          plannedWeek:String(excelValue(r,['Hafta','Plan Hafta','Rut Hafta'])).trim(),
          plannedDay:String(excelValue(r,['Gün','Gun','Plan Gün','Rut Gün'])).trim().toLocaleUpperCase('tr-TR'),
          plannedOrder:excelNumber(excelValue(r,['Sıra','Sira','Plan Sıra','Rut Sıra','Order'])),
          plannedStage:String(excelValue(r,['Aşama','Asama','Etap','Stage'])).trim(),
          originalRouteLogic:String(excelValue(r,['Rut Mantığı','Rut Mantigi','Rota Mantığı','Route Logic'])).trim(),
          generalNote:String(excelValue(r,['Not','Açıklama','Aciklama','Genel Not'])).trim(),
          frequency:14,
          priority:1
        };
      }).filter(Boolean);
    }

    window.__dealerExcelRows=parsed;
    if(!parsed.length){
      preview.innerHTML='<div class="muted">Bayi kayıtları bulunamadı. Dosyanın başlık yapısını kontrol et.</div>';
      return;
    }

    const week1=parsed.filter(x=>x.plannedWeek==='1. HAFTA').length;
    const week2=parsed.filter(x=>x.plannedWeek==='2. HAFTA').length;
    const days=[...new Set(parsed.map(x=>x.plannedDay).filter(Boolean))];
    const sample=parsed.slice(0,5);

    preview.innerHTML=
      '<div class="note"><strong>'+parsed.length+' bayi bulundu.</strong>'+
      (weekSheets.length?'<br><span class="muted">1. Hafta: '+week1+' • 2. Hafta: '+week2+' • Günler: '+esc(days.join(', '))+'</span>':'')+
      '</div>'+
      sample.map(x=>'<div class="item"><strong>'+esc(x.name)+'</strong>'+
        '<span class="muted">'+esc(x.plannedWeek||'')+(x.plannedDay?' • '+esc(x.plannedDay):'')+
        (x.district?' • '+esc(x.district):'')+(x.phone?' • '+esc(x.phone):'')+'</span></div>').join('');
    return parsed;
  }catch(err){
    console.error('Excel preview failed',err);
    window.__dealerExcelRows=[];
    preview.innerHTML='<div class="muted">Excel okunamadı: '+esc(err.message||String(err))+'</div>';
  }
}

async function importDealersFromExcel(){
  if(teamContext?.role!=='MANAGER')return;

  let rows=window.__dealerExcelRows||[];
  const assignedUserId=document.getElementById('excelAssignedUser')?.value;

  if(!rows.length && document.getElementById('dealerExcelFile')?.files?.[0]){
    await previewDealerExcel();
    rows=window.__dealerExcelRows||[];
  }

  if(!rows.length){
    alert('Excel dosyası seçildi ancak bayi kayıtları okunamadı. Önizleme alanındaki mesajı kontrol et.');
    return;
  }
  if(!assignedUserId){alert('Sorumlu satışçıyı seç.');return}

  const existingKeys=new Set(state.dealers.map(d=>
    (String(d.name||'').trim().toLocaleLowerCase('tr-TR'))+'|'+String(d.phone||'').replace(/\D/g,'')
  ));

  let added=0, skipped=0;
  for(const r of rows){
    const key=r.name.trim().toLocaleLowerCase('tr-TR')+'|'+String(r.phone||'').replace(/\D/g,'');
    if(existingKeys.has(key)){ skipped++; continue; }

    state.dealers.push({
      id:crypto.randomUUID(),
      name:r.name,contact:r.contact,phone:r.phone,district:r.district,address:r.address,
      lat:r.lat,lng:r.lng,
      locationStatus:(r.lat!==null&&r.lng!==null)?'estimated':'unset',
      frequency:r.frequency||14,priority:r.priority||1,generalNote:r.generalNote||'',
      plannedWeek:r.plannedWeek||'',plannedDay:r.plannedDay||'',
      plannedOrder:r.plannedOrder||0,plannedStage:r.plannedStage||'',
      originalRouteLogic:r.originalRouteLogic||'',departure:'08:30',
      isActive:true,
      assignedUserId,
      _ownerUserId:cloudUser.id,
      _createdBy:cloudUser.id
    });
    existingKeys.add(key);
    added++;
  }

  // Yeni eklenen kayıtları doğrudan buluta yaz. Tam state senkronuna güvenmeyelim.
  const imported=state.dealers.filter(d=>d.assignedUserId===assignedUserId && d._createdBy===cloudUser.id)
    .filter(d=>rows.some(r=>r.name===d.name && String(r.phone||'')===String(d.phone||'')));

  if(imported.length){
    const {error:importError}=await supabaseClient.from('dealers')
      .upsert(imported.map(dealerToDb),{onConflict:'user_id,id'});
    if(importError){
      console.error('Dealer Excel cloud import failed',importError);
      alert('Bayiler yerel olarak hazırlandı ancak buluta yükleme başarısız: '+importError.message);
      return;
    }
  }

  if(typeof logActivity==='function') await logActivity('DEALERS_IMPORTED','DEALER_IMPORT',null,{added,skipped,assigned_user_id:assignedUserId});

  dealerExcelDialog.close();

  // Buluttan tekrar yükleyerek gerçekten kaydedilen kayıtları doğrula.
  await loadStateFromCloud();

  if(typeof loadManagerDirectory==='function') await loadManagerDirectory();
  if(typeof populateManagerStaffFilters==='function') populateManagerStaffFilters();

  const dealerFilter=document.getElementById('managerDealerStaffFilter');
  if(dealerFilter && [...dealerFilter.options].some(o=>o.value===assignedUserId)){
    dealerFilter.value=assignedUserId;
  }
  if(typeof renderDealers==='function') renderDealers();

  const visibleImported=state.dealers.filter(d=>d.assignedUserId===assignedUserId).length;
  alert(added+' bayi yüklendi.'+(skipped?' '+skipped+' mükerrer kayıt atlandı.':'')+
    '\nSeçili personelin sistemdeki toplam bayi sayısı: '+visibleImported);
}

