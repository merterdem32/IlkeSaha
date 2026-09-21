async function renderManagementDashboard(){
  if(teamContext?.role!=='MANAGER' || !supabaseClient || !cloudUser) return;

  const today=todayStr();
  const orgId=teamContext.organizationId;

  try{
    const [membersRes,profilesRes,visitsRes,paymentsRes,activityRes]=await Promise.all([
      supabaseClient.from('organization_members')
        .select('user_id,role,is_active,created_at')
        .eq('organization_id',orgId)
        .eq('is_active',true),
      supabaseClient.from('profiles')
        .select('user_id,username,full_name,email'),
      supabaseClient.from('visits')
        .select('id,user_id,actor_user_id,dealer_id,visit_date,note,follow_up')
        .eq('organization_id',orgId)
        .gte('visit_date',today+'T00:00:00')
        .lt('visit_date',new Date(new Date(today+'T00:00:00').getTime()+86400000).toISOString()),
      supabaseClient.from('payment_promises')
        .select('id,user_id,actor_user_id,dealer_id,amount,promise_date,status,note')
        .eq('organization_id',orgId),
      supabaseClient.from('activity_log')
        .select('id,actor_user_id,action,entity_type,entity_id,details,created_at')
        .eq('organization_id',orgId)
        .order('created_at',{ascending:false})
        .limit(40)
    ]);

    for(const r of [membersRes,profilesRes,visitsRes,paymentsRes,activityRes]){
      if(r.error) throw r.error;
    }

    const profiles=new Map((profilesRes.data||[]).map(p=>[p.user_id,p]));
    const members=membersRes.data||[];
    const visits=visitsRes.data||[];
    const payments=paymentsRes.data||[];
    const activity=activityRes.data||[];

    const fieldStaff=members.filter(m=>m.role==='FIELD_STAFF');
    const pending=payments.filter(p=>!['paid','cancelled'].includes(p.status));
    const overdue=pending.filter(p=>p.promise_date<today);

    const staffCount=document.getElementById('mgrStaffCount');
    const visitCount=document.getElementById('mgrVisitCount');
    const paymentCount=document.getElementById('mgrPaymentCount');
    const overdueCount=document.getElementById('mgrOverdueCount');

    if(staffCount) staffCount.textContent=fieldStaff.length;
    if(visitCount) visitCount.textContent=visits.length;
    if(paymentCount) paymentCount.textContent=pending.length;
    if(overdueCount) overdueCount.textContent=overdue.length;

    const staffList=document.getElementById('managerStaffList');
    if(staffList){
      staffList.innerHTML=members.length?members.map(m=>{
        const p=profiles.get(m.user_id)||{};
        const personVisits=visits.filter(v=>(v.actor_user_id||v.user_id)===m.user_id);
        const name=p.full_name||p.username||p.email||'Kullanıcı';
        return '<div class="item">'+
          '<div class="toolbar" style="justify-content:space-between;align-items:center;margin:0">'+
            '<div><strong>'+esc(name)+'</strong>'+
              '<span class="muted">'+(p.username?esc(p.username)+' • ':'')+(m.role==='MANAGER'?'Yönetici':'Saha Personeli')+'</span></div>'+
            '<span class="badge '+(m.role==='MANAGER'?'b-info':'b-ok')+'">'+m.role+'</span>'+
          '</div>'+
          '<div class="muted" style="margin-top:8px">Bugünkü ziyaret: <strong>'+personVisits.length+'</strong></div>'+
          '<div class="toolbar" style="margin:10px 0 0"><button class="btn btn-ghost" onclick="openTeamUserEditor(\''+m.user_id+'\')">Kullanıcıyı Düzenle</button></div>'+
        '</div>';
      }).join(''):'<div class="muted">Aktif ekip üyesi yok.</div>';
    }

    setTimeout(()=>prepareManagerRouteControls(),0);

    const actList=document.getElementById('managerActivityList');
    if(actList){
      actList.innerHTML=activity.length?activity.map(a=>{
        const p=profiles.get(a.actor_user_id)||{};
        const who=p.full_name||p.username||p.email||'Sistem';
        const dealer=state.dealers.find(d=>d.id===a.entity_id);
        const entityName=dealer?.name||a.details?.username||a.entity_id||'';
        return '<div class="item">'+
          '<strong>'+esc(formatActivityAction(a.action))+'</strong>'+
          '<div>'+esc(who)+(entityName?' • '+esc(entityName):'')+'</div>'+
          '<div class="muted">'+new Date(a.created_at).toLocaleString('tr-TR')+'</div>'+
        '</div>';
      }).join(''):'<div class="muted">Henüz aktivite kaydı yok.</div>';
    }
  }catch(err){
    console.error('Manager dashboard error',err);
    const actList=document.getElementById('managerActivityList');
    if(actList) actList.innerHTML='<div class="muted">Yönetim verileri yüklenemedi: '+esc(err.message||err)+'</div>';
  }
}

function formatActivityAction(action){
  const map={
    CREATE_USER:'Kullanıcı oluşturuldu',
    MIGRATE_USER_TO_SAHA1:'Hesap saha1’e taşındı',
    VISIT_ADDED:'Ziyaret kaydı eklendi',
    VISIT_MARKED:'Bayi ziyaret edildi',
    VISIT_UNDONE:'Ziyaret işareti geri alındı',
    PAYMENT_ADDED:'Ödeme sözü eklendi',
    PAYMENT_PAID:'Ödeme ödendi olarak işaretlendi',
    DEALER_UPDATED:'Bayi bilgisi güncellendi',
    DEALER_DEACTIVATED:'Bayi rut dışı bırakıldı',
    MEETING_NOTE_ADDED:'Toplantı notu eklendi',
    MEETING_NOTE_DONE:'Toplantı notu tamamlandı',
    UPDATE_USER:'Kullanıcı bilgileri güncellendi',
    ROUTE_UPDATED:'Rut güncellendi'
  };
  return map[action]||action;
}

async function logActivity(action,entityType,entityId,details={}){
  if(!supabaseClient||!cloudUser||!teamContext?.organizationId) return;
  try{
    await supabaseClient.from('activity_log').insert({
      organization_id:teamContext.organizationId,
      actor_user_id:cloudUser.id,
      action,
      entity_type:entityType,
      entity_id:entityId||null,
      details:details||{}
    });
    if(teamContext.role==='MANAGER') setTimeout(()=>renderManagementDashboard(),200);
  }catch(err){
    console.warn('Activity log failed',err);
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  const btn=document.getElementById('managementNavBtn');
  if(btn) btn.addEventListener('click',()=>setTimeout(()=>renderManagementDashboard(),50));
});


let managerDirectoryCache={members:[],profiles:new Map()};

async function loadManagerDirectory(){
  const [mRes,pRes]=await Promise.all([
    supabaseClient.from('organization_members').select('user_id,role,is_active,created_at').eq('organization_id',teamContext.organizationId),
    supabaseClient.from('profiles').select('user_id,username,full_name,email')
  ]);
  if(mRes.error) throw mRes.error;
  if(pRes.error) throw pRes.error;
  managerDirectoryCache={members:mRes.data||[],profiles:new Map((pRes.data||[]).map(p=>[p.user_id,p]))};
}

async function openTeamUserEditor(userId){
  try{
    await loadManagerDirectory();
    const m=managerDirectoryCache.members.find(x=>x.user_id===userId);
    const p=managerDirectoryCache.profiles.get(userId)||{};
    if(!m){alert('Kullanıcı bulunamadı.');return}
    editTeamUserId.value=userId;
    editTeamUsername.textContent=p.username||p.email||userId;
    editTeamFullName.value=p.full_name||'';
    editTeamRole.value=m.role||'FIELD_STAFF';
    editTeamPassword.value='';
    editTeamActive.checked=m.is_active!==false;
    editTeamUserDialog.showModal();
  }catch(err){ alert('Kullanıcı bilgileri açılamadı: '+(err.message||err)); }
}

async function saveTeamUserEdit(){
  const body={
    userId:editTeamUserId.value,
    fullName:editTeamFullName.value.trim(),
    role:editTeamRole.value,
    password:editTeamPassword.value,
    isActive:editTeamActive.checked
  };
  if(body.password && body.password.length<8){alert('Yeni şifre en az 8 karakter olmalı.');return}
  const {data,error}=await supabaseClient.functions.invoke('update-team-user',{body});
  if(error){alert('Kullanıcı güncellenemedi: '+(error.message||error));return}
  if(!data?.ok){alert('Kullanıcı güncellenemedi: '+(data?.error||'Bilinmeyen hata'));return}
  editTeamUserDialog.close();
  await renderManagementDashboard();
  alert('Kullanıcı bilgileri güncellendi.');
}


let managerCurrentRouteId=null;
let managerCurrentRouteStops=[];

async function prepareManagerRouteControls(){
  if(teamContext?.role!=='MANAGER')return;
  const staffSel=document.getElementById('managerRouteStaff');
  const dateEl=document.getElementById('managerRouteDate');
  const dealerSel=document.getElementById('managerRouteAddDealer');
  if(!staffSel||!dateEl||!dealerSel)return;

  await loadManagerDirectory();

  const fieldMembers=managerDirectoryCache.members.filter(m=>m.role==='FIELD_STAFF'&&m.is_active!==false);
  const current=staffSel.value;
  staffSel.innerHTML=fieldMembers.map(m=>{
    const p=managerDirectoryCache.profiles.get(m.user_id)||{};
    const label=p.full_name||p.username||p.email||m.user_id;
    return '<option value="'+esc(m.user_id)+'">'+esc(label)+(p.username?' ('+esc(p.username)+')':'')+'</option>';
  }).join('');
  if(current&&fieldMembers.some(m=>m.user_id===current)) staffSel.value=current;

  if(!dateEl.value) dateEl.value=todayStr();

  dealerSel.innerHTML=state.dealers
    .filter(d=>d.isActive!==false)
    .sort((a,b)=>String(a.name).localeCompare(String(b.name),'tr'))
    .map(d=>'<option value="'+esc(d.id)+'">'+esc(d.name)+' • '+esc(d.district||'')+'</option>')
    .join('');

  await loadManagerRoute();
}

async function loadManagerRoute(){
  if(teamContext?.role!=='MANAGER')return;
  const staffId=document.getElementById('managerRouteStaff')?.value;
  const routeDate=document.getElementById('managerRouteDate')?.value||todayStr();
  const list=document.getElementById('managerRouteList');
  const summary=document.getElementById('managerRouteSummary');
  if(!staffId||!list||!summary)return;

  summary.textContent='Rut yükleniyor…';
  list.innerHTML='';

  const {data:route,error}=await supabaseClient
    .from('daily_routes')
    .select('id,status,assigned_user_id,route_date')
    .eq('organization_id',teamContext.organizationId)
    .eq('assigned_user_id',staffId)
    .eq('route_date',routeDate)
    .maybeSingle();

  if(error){
    managerCurrentRouteId=null;
    managerCurrentRouteStops=[];
    summary.textContent='Rut tablosu hazır değil veya yüklenemedi: '+error.message;
    return;
  }

  managerCurrentRouteId=route?.id||null;

  if(!route){
    try{
      const createdId=await materializeDailyRouteFromRecurring(staffId,routeDate);
      if(createdId){
        managerCurrentRouteId=createdId;
        return await loadManagerRoute();
      }
    }catch(err){
      console.warn('Recurring route materialization failed',err);
    }

    managerCurrentRouteStops=[];
    const cycle=getRouteCycleForDate(routeDate);
    summary.innerHTML='<span class="badge b-warn">Bu tarih için rut yok.</span> '+
      '<span class="muted">'+cycle.cycleWeek+'. hafta / '+cycle.weekday+'. gün için sabit rut şablonu bulunamadı.</span>';
    list.innerHTML='<div class="muted">Bu personel için önce sabit haftalık rut tanımlanmalı veya aşağıdan bayi eklenebilir.</div>';
    return;
  }

  const {data:stops,error:stopsError}=await supabaseClient
    .from('route_stops')
    .select('id,dealer_id,stop_order')
    .eq('route_id',route.id)
    .order('stop_order');

  if(stopsError){
    summary.textContent='Rut durakları yüklenemedi: '+stopsError.message;
    return;
  }

  managerCurrentRouteStops=stops||[];
  const visitsForDay=state.visits.filter(v=>
    (v._actorUserId||v._ownerUserId)===staffId &&
    String(v.date||'').slice(0,10)===routeDate
  );

  const visitedDealerIds=new Set(visitsForDay.map(v=>v.dealerId));
  const p=managerDirectoryCache.profiles.get(staffId)||{};
  const staffName=p.full_name||p.username||'Personel';

  const cycle=getRouteCycleForDate(routeDate);
  const cycleLabel=cycle.weekday<=6 ? cycle.cycleWeek+'. HAFTA • '+['','PAZARTESİ','SALI','ÇARŞAMBA','PERŞEMBE','CUMA','CUMARTESİ'][cycle.weekday] : 'PAZAR';
  summary.innerHTML='<strong>'+esc(staffName)+'</strong> • '+routeDate+' • '+cycleLabel+
    ' • <strong>'+managerCurrentRouteStops.length+' bayi</strong>'+
    ' • '+managerCurrentRouteStops.filter(s=>visitedDealerIds.has(s.dealer_id)).length+' ziyaret kaydı';

  list.innerHTML=managerCurrentRouteStops.length?managerCurrentRouteStops.map((s,i)=>{
    const d=state.dealers.find(x=>x.id===s.dealer_id);
    const visited=visitedDealerIds.has(s.dealer_id);
    return '<div class="item">'+
      '<div class="toolbar" style="justify-content:space-between;align-items:center;margin:0">'+
        '<div style="min-width:0;flex:1">'+
          '<strong>'+(i+1)+'. '+esc(d?.name||s.dealer_id)+'</strong>'+
          '<span class="muted">'+esc(d?.district||'')+(visited?' • Bugün ziyaret kaydı var':'')+'</span>'+
        '</div>'+
        '<div class="toolbar" style="margin:0">'+
          '<button class="btn btn-ghost" '+(i===0?'disabled':'')+' onclick="managerMoveRouteStop('+i+',-1)">↑</button>'+
          '<button class="btn btn-ghost" '+(i===managerCurrentRouteStops.length-1?'disabled':'')+' onclick="managerMoveRouteStop('+i+',1)">↓</button>'+
          '<button class="btn btn-danger" onclick="managerRemoveRouteStop('+i+')">Çıkar</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join(''):'<div class="muted">Bu rut henüz boş.</div>';
}

async function ensureManagerRoute(){
  const staffId=document.getElementById('managerRouteStaff')?.value;
  const routeDate=document.getElementById('managerRouteDate')?.value||todayStr();
  if(!staffId) throw new Error('Personel seçilmedi.');

  if(managerCurrentRouteId)return managerCurrentRouteId;

  const {data,error}=await supabaseClient.from('daily_routes').insert({
    organization_id:teamContext.organizationId,
    assigned_user_id:staffId,
    route_date:routeDate,
    status:'PLANNED',
    created_by:cloudUser.id,
    updated_by:cloudUser.id
  }).select('id').single();

  if(error) throw error;
  managerCurrentRouteId=data.id;
  return data.id;
}

async function saveManagerRouteStops(){
  if(!managerCurrentRouteId)return;

  const {error:delError}=await supabaseClient.from('route_stops')
    .delete().eq('route_id',managerCurrentRouteId);
  if(delError) throw delError;

  if(managerCurrentRouteStops.length){
    const rows=managerCurrentRouteStops.map((s,i)=>({
      route_id:managerCurrentRouteId,
      dealer_id:s.dealer_id,
      stop_order:i+1
    }));
    const {error}=await supabaseClient.from('route_stops').insert(rows);
    if(error) throw error;
  }

  await supabaseClient.from('daily_routes').update({
    updated_by:cloudUser.id,
    updated_at:new Date().toISOString()
  }).eq('id',managerCurrentRouteId);
}

async function managerAddRouteDealer(){
  try{
    const dealerId=document.getElementById('managerRouteAddDealer')?.value;
    if(!dealerId){alert('Bayi seç.');return}
    if(managerCurrentRouteStops.some(s=>s.dealer_id===dealerId)){
      alert('Bu bayi zaten rut içinde.');
      return;
    }
    await ensureManagerRoute();
    managerCurrentRouteStops.push({dealer_id:dealerId,stop_order:managerCurrentRouteStops.length+1});
    await saveManagerRouteStops();
    await logActivity('ROUTE_UPDATED','ROUTE',managerCurrentRouteId,{action:'ADD_STOP',dealer_id:dealerId});
    await loadManagerRoute();
  }catch(err){alert('Bayi ruta eklenemedi: '+(err.message||err))}
}

async function managerRemoveRouteStop(index){
  try{
    const item=managerCurrentRouteStops[index];
    if(!item)return;
    const d=state.dealers.find(x=>x.id===item.dealer_id);
    if(!confirm((d?.name||'Bayi')+' bu günlük ruttan çıkarılsın mı?'))return;
    managerCurrentRouteStops.splice(index,1);
    await saveManagerRouteStops();
    await logActivity('ROUTE_UPDATED','ROUTE',managerCurrentRouteId,{action:'REMOVE_STOP',dealer_id:item.dealer_id});
    await loadManagerRoute();
  }catch(err){alert('Rut güncellenemedi: '+(err.message||err))}
}

async function managerMoveRouteStop(index,delta){
  const target=index+delta;
  if(target<0||target>=managerCurrentRouteStops.length)return;
  const tmp=managerCurrentRouteStops[index];
  managerCurrentRouteStops[index]=managerCurrentRouteStops[target];
  managerCurrentRouteStops[target]=tmp;
  try{
    await saveManagerRouteStops();
    await logActivity('ROUTE_UPDATED','ROUTE',managerCurrentRouteId,{action:'REORDER'});
    await loadManagerRoute();
  }catch(err){alert('Rut sırası güncellenemedi: '+(err.message||err))}
}
