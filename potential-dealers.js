let potentialDealers=[];
let potentialVisits=[];

function potentialProfileLabel(userId){
  const p=(typeof teamProfilesById!=='undefined'&&teamProfilesById)?teamProfilesById.get(userId):null;
  return p?.full_name||p?.username||p?.email||'Personel';
}

async function preparePotentialDealers(force=false){
  if(!cloudUser||!supabaseClient||!teamContext?.organizationId)return;
  const section=document.getElementById('potentialDealers');
  if(!section&&!force)return;

  const status=document.getElementById('potentialDealerStatus');
  if(status)status.textContent='Potansiyel bayiler yükleniyor…';

  let q=supabaseClient.from('potential_dealers')
    .select('*')
    .eq('organization_id',teamContext.organizationId)
    .order('updated_at',{ascending:false});

  if(teamContext.role!=='MANAGER'){
    q=q.eq('assigned_user_id',cloudUser.id);
  }

  const {data,error}=await q;
  if(error){
    if(status)status.textContent='Potansiyel bayi tablosu hazır değil: '+error.message;
    return;
  }

  potentialDealers=data||[];
  const ids=potentialDealers.map(x=>x.id);
  potentialVisits=[];

  if(ids.length){
    const {data:vData,error:vError}=await supabaseClient.from('potential_visits')
      .select('*')
      .eq('organization_id',teamContext.organizationId)
      .in('potential_dealer_id',ids)
      .order('visit_date',{ascending:false});
    if(!vError)potentialVisits=vData||[];
  }

  renderPotentialDealers();
}

function renderPotentialDealers(){
  const list=document.getElementById('potentialDealerList');
  const status=document.getElementById('potentialDealerStatus');
  if(!list||!status)return;

  const q=(document.getElementById('potentialDealerSearch')?.value||'').trim().toLocaleLowerCase('tr-TR');
  const filter=document.getElementById('potentialDealerFilter')?.value||'POTENTIAL';

  const rows=potentialDealers.filter(p=>{
    if(filter!=='ALL'&&p.status!==filter)return false;
    if(!q)return true;
    return [p.name,p.contact,p.phone,p.district,p.address,potentialProfileLabel(p.assigned_user_id)]
      .join(' ').toLocaleLowerCase('tr-TR').includes(q);
  });

  const activeCount=potentialDealers.filter(p=>p.status==='POTENTIAL').length;
  status.innerHTML='<strong>'+activeCount+'</strong> aktif potansiyel bayi • toplam '+potentialDealers.length+' kayıt';

  list.innerHTML=rows.length?rows.map(p=>{
    const visits=potentialVisits.filter(v=>v.potential_dealer_id===p.id)
      .sort((a,b)=>new Date(b.visit_date)-new Date(a.visit_date));
    const last=visits[0];
    const converted=p.status==='CONVERTED';
    const badge=converted
      ? '<span class="badge b-ok">Bayilere aktarıldı</span>'
      : p.status==='ARCHIVED'
        ? '<span class="badge b-info">Arşiv</span>'
        : '<span class="badge b-warn">Potansiyel</span>';

    return '<div class="item">'+
      '<div class="toolbar" style="justify-content:space-between;align-items:flex-start;margin:0">'+
        '<div style="min-width:0;flex:1">'+
          '<strong>'+esc(p.name)+'</strong>'+
          '<span class="muted">'+esc(p.district||'')+
            (p.contact?' • '+esc(p.contact):'')+
            (p.phone?' • '+esc(p.phone):'')+
            (teamContext.role==='MANAGER'?' • '+esc(potentialProfileLabel(p.assigned_user_id)):'')+
          '</span>'+
        '</div>'+badge+
      '</div>'+
      (p.address?'<div class="muted" style="margin-top:8px">'+esc(p.address)+'</div>':'')+
      (last?'<div class="note" style="margin-top:10px"><strong>Son görüşme</strong>'+
        '<div class="muted">'+new Date(last.visit_date).toLocaleString('tr-TR')+'</div>'+
        '<div style="margin-top:5px">'+esc(last.note||'Not girilmedi')+'</div>'+
        (last.follow_up?'<div class="muted" style="margin-top:4px">Takip: '+esc(last.follow_up)+'</div>':'')+
      '</div>':'<div class="muted" style="margin-top:10px">Henüz görüşme kaydı yok.</div>')+
      (visits.length?'<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:700">Görüşme Geçmişi ('+visits.length+')</summary>'+
        '<div class="list" style="margin-top:8px">'+visits.map(v=>{
          const canEdit=teamContext.role==='MANAGER'||v.actor_user_id===cloudUser.id;
          return '<div class="item">'+
            '<strong>'+new Date(v.visit_date).toLocaleString('tr-TR')+'</strong>'+
            '<div style="margin-top:5px">'+esc(v.note||'Not girilmedi')+'</div>'+
            (v.follow_up?'<div class="muted" style="margin-top:4px">Takip: '+esc(v.follow_up)+'</div>':'')+
            (canEdit?'<div class="toolbar" style="margin:8px 0 0">'+
              '<button class="btn btn-ghost" onclick="openPotentialVisitEdit(\''+v.id+'\')">Düzenle</button>'+
              '<button class="btn btn-danger" onclick="deletePotentialVisit(\''+v.id+'\')">Sil</button>'+
            '</div>':'')+
          '</div>';
        }).join('')+'</div></details>':'')+
      '<div class="toolbar" style="margin:10px 0 0">'+
        (!converted?'<button class="btn btn-accent" onclick="openPotentialVisitDialog(\''+p.id+'\')">+ Görüşme Ekle</button>':'')+
        '<button class="btn btn-ghost" onclick="openPotentialDirections(\''+p.id+'\')">Yol Tarifi</button>'+
        (!converted?'<button class="btn btn-primary" onclick="convertPotentialToDealer(\''+p.id+'\')">Bayilere Ekle</button>':'')+
      '</div>'+
    '</div>';
  }).join(''):'<div class="muted">Bu filtrede potansiyel bayi bulunamadı.</div>';
}

function openOutOfRouteVisit(){
  if(!cloudUser){alert('Önce giriş yapmalısın.');return}
  potentialSourceId.value='';
  potentialVisitId.value='';
  potentialVisitTitle.textContent='Rota Dışı Ziyaret Ekle';
  potentialName.value='';
  potentialContact.value='';
  potentialPhone.value='';
  potentialDistrict.value='';
  potentialAddress.value='';
  potentialLat.value='';
  potentialLng.value='';
  potentialVisitDate.value=dtLocalNow();
  potentialVisitNote.value='';
  potentialFollowUp.value='';
  potentialFirmFields.style.display='';
  potentialVisitDialog.showModal();
}

function openPotentialVisitDialog(id){
  const p=potentialDealers.find(x=>x.id===id);
  if(!p)return;
  potentialSourceId.value=p.id;
  potentialVisitId.value='';
  potentialVisitTitle.textContent=p.name+' • Görüşme Ekle';
  potentialName.value=p.name||'';
  potentialContact.value=p.contact||'';
  potentialPhone.value=p.phone||'';
  potentialDistrict.value=p.district||'';
  potentialAddress.value=p.address||'';
  potentialLat.value=p.lat??'';
  potentialLng.value=p.lng??'';
  potentialVisitDate.value=dtLocalNow();
  potentialVisitNote.value='';
  potentialFollowUp.value='';
  potentialFirmFields.style.display='none';
  potentialVisitDialog.showModal();
}

function openPotentialVisitEdit(visitId){
  const v=potentialVisits.find(x=>x.id===visitId);
  if(!v)return;
  const p=potentialDealers.find(x=>x.id===v.potential_dealer_id);
  if(!p)return;

  if(teamContext.role!=='MANAGER'&&v.actor_user_id!==cloudUser.id){
    alert('Bu görüşme kaydını yalnızca kaydı oluşturan personel veya yönetici düzenleyebilir.');
    return;
  }

  potentialSourceId.value=p.id;
  potentialVisitId.value=v.id;
  potentialVisitTitle.textContent=p.name+' • Görüşmeyi Düzenle';
  potentialName.value=p.name||'';
  potentialContact.value=p.contact||'';
  potentialPhone.value=p.phone||'';
  potentialDistrict.value=p.district||'';
  potentialAddress.value=p.address||'';
  potentialLat.value=p.lat??'';
  potentialLng.value=p.lng??'';
  const d=new Date(v.visit_date);
  d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
  potentialVisitDate.value=d.toISOString().slice(0,16);
  potentialVisitNote.value=v.note||'';
  potentialFollowUp.value=v.follow_up||'';
  potentialFirmFields.style.display='none';
  potentialVisitDialog.showModal();
}

async function deletePotentialVisit(visitId){
  const v=potentialVisits.find(x=>x.id===visitId);
  if(!v)return;
  const p=potentialDealers.find(x=>x.id===v.potential_dealer_id);
  if(!confirm((p?.name||'Firma')+' için '+new Date(v.visit_date).toLocaleString('tr-TR')+' tarihli görüşme kaydı silinsin mi?'))return;

  const {error}=await supabaseClient.from('potential_visits')
    .delete()
    .eq('id',visitId)
    .eq('organization_id',teamContext.organizationId);

  if(error){
    alert('Görüşme silinemedi: '+error.message);
    return;
  }

  if(typeof logActivity==='function'){
    logActivity('POTENTIAL_VISIT_DELETED','POTENTIAL_DEALER',v.potential_dealer_id,{visitId});
  }

  await preparePotentialDealers(true);
}

function useCurrentLocationForPotential(){
  if(!navigator.geolocation){alert('Tarayıcı konum desteği yok.');return}
  navigator.geolocation.getCurrentPosition(pos=>{
    potentialLat.value=pos.coords.latitude.toFixed(6);
    potentialLng.value=pos.coords.longitude.toFixed(6);
  },err=>alert('Konum alınamadı: '+err.message),{
    enableHighAccuracy:true,timeout:15000,maximumAge:0
  });
}

async function savePotentialVisit(){
  if(!cloudUser||!supabaseClient)return;
  const existingId=potentialSourceId.value;
  const editVisitId=potentialVisitId.value;
  let potentialId=existingId;

  if(!existingId){
    const name=potentialName.value.trim();
    if(!name){alert('Firma adı gerekli.');return}

    const lat=potentialLat.value.trim()===''?null:Number(potentialLat.value);
    const lng=potentialLng.value.trim()===''?null:Number(potentialLng.value);
    if((lat!==null||lng!==null)&&!isValidDealerCoordinate(lat,lng)){
      alert('Koordinat geçersiz.');
      return;
    }

    const {data,error}=await supabaseClient.from('potential_dealers').insert({
      organization_id:teamContext.organizationId,
      owner_user_id:cloudUser.id,
      assigned_user_id:cloudUser.id,
      name,
      contact:potentialContact.value.trim()||null,
      phone:potentialPhone.value.trim()||null,
      district:potentialDistrict.value.trim()||null,
      address:potentialAddress.value.trim()||null,
      lat,lng,
      status:'POTENTIAL'
    }).select('id').single();

    if(error){
      alert('Potansiyel firma kaydedilemedi: '+error.message);
      return;
    }
    potentialId=data.id;
  }

  const note=potentialVisitNote.value.trim();
  const visitPayload={
    visit_date:new Date(potentialVisitDate.value||dtLocalNow()).toISOString(),
    note:note||null,
    follow_up:potentialFollowUp.value||null
  };

  let vError=null;
  if(editVisitId){
    const result=await supabaseClient.from('potential_visits')
      .update(visitPayload)
      .eq('id',editVisitId)
      .eq('organization_id',teamContext.organizationId);
    vError=result.error;
  }else{
    const result=await supabaseClient.from('potential_visits').insert({
      organization_id:teamContext.organizationId,
      potential_dealer_id:potentialId,
      actor_user_id:cloudUser.id,
      ...visitPayload
    });
    vError=result.error;
  }

  if(vError){
    alert('Görüşme kaydedilemedi: '+vError.message);
    return;
  }

  if(typeof logActivity==='function'){
    logActivity(editVisitId?'POTENTIAL_VISIT_UPDATED':'POTENTIAL_VISIT_ADDED','POTENTIAL_DEALER',potentialId,{visitId:editVisitId||null});
  }

  potentialVisitDialog.close();
  await preparePotentialDealers(true);
  if(document.getElementById('potentialDealers')?.classList.contains('active'))renderPotentialDealers();
  alert(editVisitId?'Görüşme kaydı güncellendi.':'Rota dışı ziyaret kaydedildi.');
}

function openPotentialDirections(id){
  const p=potentialDealers.find(x=>x.id===id);
  if(!p)return;
  let destination='';
  if(isValidDealerCoordinate(p.lat,p.lng)){
    destination=encodeURIComponent(p.lat+','+p.lng);
  }else if((p.address||'').trim()){
    destination=encodeURIComponent([p.address,p.district].filter(Boolean).join(' '));
  }else{
    alert('Bu firmanın kayıtlı konumu veya adresi yok.');
    return;
  }
  window.open('https://www.google.com/maps/dir/?api=1&destination='+destination+'&travelmode=driving','_blank','noopener');
}

async function convertPotentialToDealer(id){
  const p=potentialDealers.find(x=>x.id===id);
  if(!p||p.status!=='POTENTIAL')return;

  if(!confirm(p.name+' artık aktif bayi olarak Bayiler listesine eklensin mi?'))return;

  const dealerId=String(p.id);
  if(!state.dealers.some(d=>d.id===dealerId)){
    state.dealers.push({
      id:dealerId,
      name:p.name||'',
      contact:p.contact||'',
      phone:p.phone||'',
      district:p.district||'',
      address:p.address||'',
      lat:p.lat??null,
      lng:p.lng??null,
      locationStatus:isValidDealerCoordinate(p.lat,p.lng)?'verified':'unset',
      frequency:14,
      priority:1,
      generalNote:'Potansiyel bayiden aktarıldı.',
      plannedWeek:'',
      plannedDay:'',
      plannedOrder:0,
      plannedStage:'',
      originalRouteLogic:'',
      departure:'08:30',
      assignedUserId:p.assigned_user_id||cloudUser.id,
      isActive:true,
      _ownerUserId:cloudUser.id,
      _createdBy:cloudUser.id
    });
  }

  const related=potentialVisits.filter(v=>v.potential_dealer_id===p.id);
  for(const v of related){
    if(state.visits.some(x=>x.id===v.id))continue;
    state.visits.push({
      id:v.id,
      dealerId,
      date:v.visit_date,
      note:v.note||'',
      followUp:v.follow_up||'',
      _ownerUserId:v.actor_user_id||cloudUser.id,
      _actorUserId:v.actor_user_id||cloudUser.id,
      createdAt:v.created_at||v.visit_date
    });
  }

  persist();
  if(typeof syncStateToCloud==='function')await syncStateToCloud(false);

  const {error}=await supabaseClient.from('potential_dealers').update({
    status:'CONVERTED',
    converted_dealer_id:dealerId,
    updated_at:new Date().toISOString()
  }).eq('id',p.id);

  if(error){
    alert('Bayi eklendi fakat potansiyel kaydı güncellenemedi: '+error.message);
    return;
  }

  if(typeof logActivity==='function'){
    logActivity('POTENTIAL_CONVERTED','POTENTIAL_DEALER',p.id,{dealerId});
  }

  await preparePotentialDealers(true);
  renderDealers();
  alert('Firma Bayiler listesine eklendi. Geçmiş görüşmeleri de bayi geçmişine aktarıldı.');
}
