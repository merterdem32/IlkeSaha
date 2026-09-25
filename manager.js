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
        .gte('visit_date',new Date(new Date(today+'T00:00:00').getTime()-6*86400000).toISOString())
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
    const todayVisits=visits.filter(v=>String(v.visit_date||'').slice(0,10)===today);
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
    if(visitCount) visitCount.textContent=uniqueVisitCount(todayVisits);
    if(paymentCount) paymentCount.textContent=pending.length;
    if(overdueCount) overdueCount.textContent=overdue.length;

    const staffList=document.getElementById('managerStaffList');
    if(staffList){
      staffList.innerHTML=members.length?members.map(m=>{
        const p=profiles.get(m.user_id)||{};
        const personVisits=todayVisits.filter(v=>(v.actor_user_id||v.user_id)===m.user_id);
        const name=p.full_name||p.username||p.email||'Kullanıcı';
        return '<div class="item">'+
          '<div class="toolbar" style="justify-content:space-between;align-items:center;margin:0">'+
            '<div><strong>'+esc(name)+'</strong>'+
              '<span class="muted">'+(p.username?esc(p.username)+' • ':'')+(m.role==='MANAGER'?'Yönetici':'Saha Personeli')+'</span></div>'+
            '<span class="badge '+(m.role==='MANAGER'?'b-info':'b-ok')+'">'+m.role+'</span>'+
          '</div>'+
          '<div class="muted" style="margin-top:8px">Bugünkü ziyaret: <strong>'+uniqueVisitCount(personVisits)+'</strong></div>'+
          '<div class="toolbar" style="margin:10px 0 0"><button class="btn btn-ghost" onclick="openTeamUserEditor(\''+m.user_id+'\')">Kullanıcıyı Düzenle</button></div>'+
        '</div>';
      }).join(''):'<div class="muted">Aktif ekip üyesi yok.</div>';
    }

    const perfList=document.getElementById('managerPerformanceList');
    if(perfList){
      const sevenDayStart=new Date(new Date(today+'T00:00:00').getTime()-6*86400000);
      const rows=fieldStaff.map(m=>{
        const p=profiles.get(m.user_id)||{};
        const who=p.full_name||p.username||p.email||'Personel';
        const username=p.username||'';
        const personToday=todayVisits.filter(v=>(v.actor_user_id||v.user_id)===m.user_id);
        const person7=visits.filter(v=>(v.actor_user_id||v.user_id)===m.user_id && new Date(v.visit_date)>=sevenDayStart);
        const personPending=pending.filter(x=>(x.actor_user_id||x.user_id)===m.user_id);
        const personOverdue=personPending.filter(x=>x.promise_date<today);
        const last=activity.find(a=>a.actor_user_id===m.user_id);

        return '<div class="item">'+
          '<div class="toolbar" style="justify-content:space-between;align-items:flex-start;margin:0">'+
            '<div><strong>'+esc(who)+'</strong>'+(username?'<span class="muted">'+esc(username)+'</span>':'')+'</div>'+
            '<button class="btn btn-ghost" onclick="managerFocusStaffRoute(\''+m.user_id+'\')">Rutunu Aç</button>'+
          '</div>'+
          '<div class="toolbar" style="margin:10px 0 0;gap:8px;flex-wrap:wrap">'+
            '<span class="badge b-ok">Bugün '+uniqueVisitCount(personToday)+' ziyaret</span>'+
            '<span class="badge b-info">7 gün '+uniqueVisitCount(person7)+' ziyaret</span>'+
            '<span class="badge '+(personPending.length?'b-warn':'b-info')+'">'+personPending.length+' bekleyen ödeme</span>'+
            (personOverdue.length?'<span class="badge b-bad">'+personOverdue.length+' geciken</span>':'')+
          '</div>'+
          '<div class="muted" style="margin-top:8px">'+
            (last?'Son aktivite: '+new Date(last.created_at).toLocaleString('tr-TR'):'Henüz aktivite yok')+
          '</div>'+
        '</div>';
      });
      perfList.innerHTML=rows.length?rows.join(''):'<div class="muted">Aktif saha personeli yok.</div>';
    }

    populateManagerStaffFilters();
    setTimeout(()=>prepareManagerRouteControls(),0);
    setTimeout(()=>prepareManagerReportControls(),0);

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
    ROUTE_UPDATED:'Rut güncellendi',
    ROUTE_PUBLISHED:'Günlük rut onaylandı ve paylaşıldı',
    DEALERS_IMPORTED:'Excel ile bayiler yüklendi'
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
    managerCurrentRouteStops=[];
    summary.innerHTML='<span class="badge b-warn">Personel bu tarih için rutunu henüz onaylayıp paylaşmadı.</span>';
    list.innerHTML='<div class="muted">Saha personeli kendi hesabından günlük rutunu oluşturup “Bugünkü Rutu Onayla ve Yöneticiye Gönder” dediğinde burada görünecek.</div>';
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

  const completed=managerCurrentRouteStops.filter(s=>visitedDealerIds.has(s.dealer_id)).length;
  summary.innerHTML='<strong>'+esc(staffName)+'</strong> • '+routeDate+
    ' • <strong>'+managerCurrentRouteStops.length+' bayi</strong>'+
    ' • <strong>'+completed+'/'+managerCurrentRouteStops.length+'</strong> ziyaret tamamlandı'+
    ' • <span class="muted">son kontrol '+new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})+'</span>';

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


let managerRouteAutoRefreshTimer=null;

function startManagerRouteAutoRefresh(){
  if(managerRouteAutoRefreshTimer) clearInterval(managerRouteAutoRefreshTimer);
  managerRouteAutoRefreshTimer=setInterval(()=>{
    if(teamContext?.role!=='MANAGER')return;
    const section=document.getElementById('management');
    if(section?.classList.contains('active')) loadManagerRoute();
  },30000);
}

document.addEventListener('DOMContentLoaded',()=>startManagerRouteAutoRefresh());


async function managerFocusStaffRoute(userId){
  const sel=document.getElementById('managerRouteStaff');
  const dateEl=document.getElementById('managerRouteDate');
  if(!sel||!dateEl)return;
  if(!dateEl.value) dateEl.value=todayStr();
  if(![...sel.options].some(o=>o.value===userId)){
    await prepareManagerRouteControls();
  }
  sel.value=userId;
  await loadManagerRoute();
  document.getElementById('managerRouteSummary')?.scrollIntoView({behavior:'smooth',block:'center'});
}


function populateManagerStaffFilters(){
  if(teamContext?.role!=='MANAGER')return;
  const fieldMembers=managerDirectoryCache.members.filter(m=>m.role==='FIELD_STAFF'&&m.is_active!==false);

  const options=['<option value="all">Tüm personel</option>'].concat(fieldMembers.map(m=>{
    const p=managerDirectoryCache.profiles.get(m.user_id)||{};
    const label=p.full_name||p.username||p.email||m.user_id;
    return '<option value="'+esc(m.user_id)+'">'+esc(label)+(p.username?' ('+esc(p.username)+')':'')+'</option>';
  })).join('');

  const dealerFilter=document.getElementById('managerDealerStaffFilter');
  const paymentFilter=document.getElementById('managerPaymentStaffFilter');

  if(dealerFilter){
    const current=dealerFilter.value||'all';
    dealerFilter.innerHTML=options;
    if([...dealerFilter.options].some(o=>o.value===current)) dealerFilter.value=current;
  }
  if(paymentFilter){
    const current=paymentFilter.value||'all';
    paymentFilter.innerHTML=options;
    if([...paymentFilter.options].some(o=>o.value===current)) paymentFilter.value=current;
  }
}


function localDateInputValue(d){
  const x=new Date(d);
  x.setMinutes(x.getMinutes()-x.getTimezoneOffset());
  return x.toISOString().slice(0,10);
}

function setManagerReportRange(days){
  const end=new Date();
  const start=new Date(end.getTime()-(Math.max(1,days)-1)*86400000);
  const startEl=document.getElementById('managerReportStart');
  const endEl=document.getElementById('managerReportEnd');
  if(startEl) startEl.value=localDateInputValue(start);
  if(endEl) endEl.value=localDateInputValue(end);
  loadManagerReport();
}

async function prepareManagerReportControls(){
  if(teamContext?.role!=='MANAGER')return;
  await loadManagerDirectory();

  const staffEl=document.getElementById('managerReportStaff');
  const startEl=document.getElementById('managerReportStart');
  const endEl=document.getElementById('managerReportEnd');
  if(!staffEl||!startEl||!endEl)return;

  const current=staffEl.value||'all';
  const fieldMembers=managerDirectoryCache.members.filter(m=>m.role==='FIELD_STAFF'&&m.is_active!==false);
  staffEl.innerHTML='<option value="all">Tüm personel</option>'+fieldMembers.map(m=>{
    const p=managerDirectoryCache.profiles.get(m.user_id)||{};
    const label=p.full_name||p.username||p.email||m.user_id;
    return '<option value="'+esc(m.user_id)+'">'+esc(label)+(p.username?' ('+esc(p.username)+')':'')+'</option>';
  }).join('');
  if([...staffEl.options].some(o=>o.value===current)) staffEl.value=current;

  if(!endEl.value) endEl.value=todayStr();
  if(!startEl.value){
    const end=new Date(endEl.value+'T12:00:00');
    startEl.value=localDateInputValue(new Date(end.getTime()-6*86400000));
  }

  await loadManagerReport();
}

async function loadManagerReport(){
  if(teamContext?.role!=='MANAGER'||!supabaseClient)return;

  const staffId=document.getElementById('managerReportStaff')?.value||'all';
  const start=document.getElementById('managerReportStart')?.value;
  const end=document.getElementById('managerReportEnd')?.value;
  const list=document.getElementById('managerReportList');
  const summary=document.getElementById('managerReportSummary');

  if(!start||!end||!list||!summary)return;
  if(start>end){
    summary.textContent='Başlangıç tarihi bitiş tarihinden sonra olamaz.';
    return;
  }

  summary.textContent='Rapor yükleniyor…';

  const startIso=start+'T00:00:00';
  const endExclusive=new Date(new Date(end+'T00:00:00').getTime()+86400000).toISOString();

  let visitsQ=supabaseClient.from('visits')
    .select('id,user_id,actor_user_id,dealer_id,visit_date,note,follow_up')
    .eq('organization_id',teamContext.organizationId)
    .gte('visit_date',startIso)
    .lt('visit_date',endExclusive);

  let paymentsQ=supabaseClient.from('payment_promises')
    .select('id,user_id,actor_user_id,dealer_id,amount,promise_date,status,note,created_at')
    .eq('organization_id',teamContext.organizationId)
    .gte('created_at',startIso)
    .lt('created_at',endExclusive);

  if(staffId!=='all'){
    visitsQ=visitsQ.eq('actor_user_id',staffId);
    paymentsQ=paymentsQ.eq('actor_user_id',staffId);
  }

  const [vRes,pRes]=await Promise.all([visitsQ,paymentsQ]);
  if(vRes.error||pRes.error){
    summary.textContent='Rapor yüklenemedi: '+(vRes.error?.message||pRes.error?.message||'Bilinmeyen hata');
    return;
  }

  const visits=vRes.data||[];
  const payments=pRes.data||[];
  const dealerIds=[...new Set(visits.map(v=>v.dealer_id).filter(Boolean))];

  const vEl=document.getElementById('mgrReportVisits');
  const dEl=document.getElementById('mgrReportDealers');
  const pEl=document.getElementById('mgrReportPayments');
  const aEl=document.getElementById('mgrReportPaymentAmount');

  const uniqueVisits=uniqueVisitCount(visits);
  if(vEl)vEl.textContent=uniqueVisits;
  if(dEl)dEl.textContent=dealerIds.length;
  if(pEl)pEl.textContent=payments.length;
  if(aEl)aEl.textContent=fmtMoney(payments.reduce((s,p)=>s+Number(p.amount||0),0));

  const byDay=new Map();
  const ensureDay=date=>{
    if(!byDay.has(date))byDay.set(date,{visitKeys:new Set(),dealers:new Set(),payments:0,amount:0});
    return byDay.get(date);
  };

  visits.forEach(v=>{
    const day=String(v.visit_date||'').slice(0,10);
    const x=ensureDay(day);
    if(v.dealer_id){
      const actor=v.actor_user_id||v.user_id||'unknown';
      x.visitKeys.add(actor+'|'+v.dealer_id);
      x.dealers.add(v.dealer_id);
    }
  });
  payments.forEach(p=>{
    const day=String(p.created_at||p.promise_date||'').slice(0,10);
    const x=ensureDay(day);
    x.payments++;
    x.amount+=Number(p.amount||0);
  });

  const rows=[...byDay.entries()].sort((a,b)=>b[0].localeCompare(a[0]));
  list.innerHTML=rows.length?rows.map(([date,x])=>{
    return '<div class="item">'+
      '<strong>'+new Date(date+'T12:00:00').toLocaleDateString('tr-TR',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'})+'</strong>'+
      '<div class="toolbar" style="margin:8px 0 0;gap:8px;flex-wrap:wrap">'+
        '<span class="badge b-ok">'+x.visitKeys.size+' ziyaret</span>'+
        '<span class="badge b-info">'+x.dealers.size+' bayi</span>'+
        '<span class="badge b-warn">'+x.payments+' ödeme sözü</span>'+
        (x.amount?'<span class="badge b-info">'+fmtMoney(x.amount)+'</span>':'')+
      '</div>'+
    '</div>';
  }).join(''):'<div class="muted">Seçili tarih aralığında kayıt yok.</div>';

  const personLabel=staffId==='all'
    ? 'Tüm personel'
    : (managerDirectoryCache.profiles.get(staffId)?.full_name||managerDirectoryCache.profiles.get(staffId)?.username||'Personel');

  summary.innerHTML='<strong>'+esc(personLabel)+'</strong> • '+start+' → '+end+
    ' • '+uniqueVisits+' ziyaret • '+dealerIds.length+' farklı bayi';
}
