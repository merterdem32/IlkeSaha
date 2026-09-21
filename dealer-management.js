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
    return !d.assignedUserId || d.assignedUserId===cloudUser?.id;
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
    const data=await file.arrayBuffer();
    const wb=XLSX.read(data,{type:'array'});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const raw=XLSX.utils.sheet_to_json(ws,{defval:'',raw:false});

    const parsed=raw.map((r,index)=>{
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

    window.__dealerExcelRows=parsed;
    if(!parsed.length){
      preview.innerHTML='<div class="muted">Bayi adı sütunu bulunamadı. Sütun adında “Bayi”, “Firma”, “Ünvan”, “Müşteri” veya “Cari” ifadelerinden biri olmalı.</div>';
      return;
    }

    const sample=parsed.slice(0,5);
    preview.innerHTML='<div class="note"><strong>'+parsed.length+' bayi bulundu.</strong> Yüklemeden önce ilk 5 kayıt:</div>'+
      sample.map(x=>'<div class="item"><strong>'+esc(x.name)+'</strong><span class="muted">'+esc(x.district||'')+(x.phone?' • '+esc(x.phone):'')+'</span></div>').join('');
  }catch(err){
    console.error('Excel preview failed',err);
    window.__dealerExcelRows=[];
    preview.innerHTML='<div class="muted">Excel okunamadı: '+esc(err.message||String(err))+'</div>';
  }
}

async function importDealersFromExcel(){
  if(teamContext?.role!=='MANAGER')return;
  const rows=window.__dealerExcelRows||[];
  const assignedUserId=document.getElementById('excelAssignedUser')?.value;
  if(!rows.length){alert('Önce Excel dosyasını seç ve önizlemeyi oluştur.');return}
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

  persist();
  await syncStateToCloud(false);
  if(typeof logActivity==='function') await logActivity('DEALERS_IMPORTED','DEALER_IMPORT',null,{added,skipped,assigned_user_id:assignedUserId});
  dealerExcelDialog.close();
  alert(added+' bayi yüklendi.'+(skipped?' '+skipped+' mükerrer kayıt atlandı.':''));
}

document.addEventListener('DOMContentLoaded',()=>{
  const input=document.getElementById('dealerExcelFile');
  if(input) input.addEventListener('change',previewDealerExcel);
});
