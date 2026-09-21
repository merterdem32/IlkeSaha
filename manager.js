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
    UPDATE_USER:'Kullanıcı bilgileri güncellendi'
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
