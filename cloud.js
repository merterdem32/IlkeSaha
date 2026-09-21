let supabaseClient=null;
let cloudUser=null;
let cloudSyncTimer=null;
let cloudSyncInProgress=false;
let cloudHydrating=false;
let teamContext={organizationId:null,organizationName:null,joinCode:null,role:null};

function updateCloudUi(message){
  const btn=document.getElementById('cloudAccountBtn');
  const status=document.getElementById('cloudStatus');
  if(btn){
    btn.textContent=cloudUser ? '☁ Bulut: Bağlı' : '☁ Bulut: Giriş Yap';
    btn.className='btn '+(cloudUser?'btn-primary':'btn-ghost');
  }
  if(status){
    const role=teamContext.role ? ' • '+teamContext.role : '';
    status.textContent=message || (cloudUser ? 'Bulut senkronizasyonu aktif'+role : 'Bu cihazdaki veriler henüz buluta bağlı değil.');
  }
  applyRoleUi();
}

function applyRoleUi(){
  const nav=document.getElementById('managementNavBtn');
  if(nav) nav.style.display=teamContext.role==='MANAGER'?'':'none';
  const badge=document.getElementById('managementRoleBadge');
  if(badge) badge.textContent=teamContext.role||'';
  const email=document.getElementById('cloudSignedInEmail');
  if(email && cloudUser){
    email.textContent=(cloudUser.email||'')+(teamContext.organizationName?' • '+teamContext.organizationName:'')+(teamContext.role?' • '+teamContext.role:'');
  }
  const join=document.getElementById('teamJoinCode');
  if(join) join.textContent=teamContext.joinCode||'-';
}

async function initCloud(){
  try{
    if(!window.supabase || !window.ILKE_SUPABASE) return;
    supabaseClient=window.supabase.createClient(
      window.ILKE_SUPABASE.url,
      window.ILKE_SUPABASE.publishableKey
    );

    const {data:{session}}=await supabaseClient.auth.getSession();
    cloudUser=session?.user||null;

    if(cloudUser){
      await ensureTeamContext();
      await cloudLoadOrMigrate();
    }else{
      updateCloudUi();
    }

    supabaseClient.auth.onAuthStateChange(async (_event,session)=>{
      cloudUser=session?.user||null;
      if(cloudUser){
        await ensureTeamContext();
        await cloudLoadOrMigrate();
      }else{
        teamContext={organizationId:null,organizationName:null,joinCode:null,role:null};
        updateCloudUi();
      }
    });
  }catch(err){
    console.error('Cloud init error',err);
    updateCloudUi('Bulut bağlantısı başlatılamadı: '+err.message);
  }
}

function openCloudAccount(){
  if(cloudUser){
    document.getElementById('cloudSignedOutBox').style.display='none';
    document.getElementById('cloudSignedInBox').style.display='block';
    updateCloudUi();
  }else{
    document.getElementById('cloudSignedOutBox').style.display='block';
    document.getElementById('cloudSignedInBox').style.display='none';
  }
  cloudDialog.showModal();
}

async function cloudSignUp(){
  const email=cloudEmail.value.trim();
  const password=cloudPassword.value;
  if(!email||password.length<6){alert('E-posta ve en az 6 karakterli parola gir.');return}
  const {data,error}=await supabaseClient.auth.signUp({
    email,
    password,
    options:{ emailRedirectTo: window.location.origin }
  });
  if(error){alert('Hesap oluşturulamadı: '+error.message);return}
  if(data.session){
    cloudUser=data.user;
    cloudDialog.close();
    await ensureTeamContext();
    await cloudLoadOrMigrate();
  }else{
    alert('Hesap oluşturuldu. E-posta doğrulaması açıksa gelen kutundaki bağlantıyı onayla, sonra giriş yap.');
  }
}

async function cloudResendConfirmation(){
  const email=cloudEmail.value.trim();
  if(!email){alert('Önce e-posta adresini gir.');return}
  const {error}=await supabaseClient.auth.resend({
    type:'signup',
    email,
    options:{ emailRedirectTo: window.location.origin }
  });
  if(error){alert('Doğrulama e-postası gönderilemedi: '+error.message);return}
  alert('Yeni doğrulama e-postası gönderildi.');
}

async function cloudSignIn(){
  const email=cloudEmail.value.trim();
  const password=cloudPassword.value;
  if(!email||!password){alert('E-posta ve parola gir.');return}
  const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
  if(error){alert('Giriş yapılamadı: '+error.message);return}
  cloudUser=data.user;
  cloudDialog.close();
  await ensureTeamContext();
  await cloudLoadOrMigrate();
}

async function cloudSignOut(){
  if(!supabaseClient)return;
  await supabaseClient.auth.signOut();
  cloudUser=null;
  teamContext={organizationId:null,organizationName:null,joinCode:null,role:null};
  updateCloudUi();
  cloudDialog.close();
}

async function ensureTeamContext(){
  if(!cloudUser||!supabaseClient)return;

  updateCloudUi('Ekip bilgisi kontrol ediliyor…');

  let {data:memberships,error}=await supabaseClient
    .from('organization_members')
    .select('organization_id,role,is_active')
    .eq('user_id',cloudUser.id)
    .eq('is_active',true)
    .limit(1);

  if(error) throw error;

  if(!memberships?.length){
    const {data,error:rpcError}=await supabaseClient.rpc('bootstrap_organization',{
      company_name:'İlke Akü',
      person_name:null
    });
    if(rpcError) throw rpcError;
    const row=Array.isArray(data)?data[0]:data;
    memberships=[{
      organization_id:row.organization_id,
      role:row.role,
      is_active:true
    }];
  }

  const membership=memberships[0];
  const {data:org,error:orgError}=await supabaseClient
    .from('organizations')
    .select('id,name,join_code')
    .eq('id',membership.organization_id)
    .single();

  if(orgError) throw orgError;

  teamContext={
    organizationId:org.id,
    organizationName:org.name,
    joinCode:org.join_code,
    role:membership.role
  };

  await supabaseClient.from('profiles').upsert({
    user_id:cloudUser.id,
    email:cloudUser.email||null,
    updated_at:new Date().toISOString()
  },{onConflict:'user_id'});

  await backupCurrentBrowserStateOnce();
  await attachLegacyRowsToOrganization();
  updateCloudUi('İlke Akü ekibine bağlı • '+teamContext.role);
}

async function backupCurrentBrowserStateOnce(){
  if(!cloudUser||!teamContext.organizationId)return;

  const label='pre-team-browser-migration-2026-09-21';
  const {data,error}=await supabaseClient
    .from('data_backups')
    .select('id')
    .eq('user_id',cloudUser.id)
    .eq('label',label)
    .limit(1);

  if(error) throw error;
  if(data?.length)return;

  const {error:insertError}=await supabaseClient.from('data_backups').insert({
    user_id:cloudUser.id,
    organization_id:teamContext.organizationId,
    label,
    snapshot:state
  });
  if(insertError) throw insertError;
}

async function attachLegacyRowsToOrganization(){
  const org=teamContext.organizationId;
  const uid=cloudUser.id;
  if(!org||!uid)return;

  const operations=[
    supabaseClient.from('dealers')
      .update({organization_id:org,created_by:uid,updated_by:uid})
      .eq('user_id',uid).is('organization_id',null),
    supabaseClient.from('visits')
      .update({organization_id:org,actor_user_id:uid})
      .eq('user_id',uid).is('organization_id',null),
    supabaseClient.from('payment_promises')
      .update({organization_id:org,actor_user_id:uid})
      .eq('user_id',uid).is('organization_id',null),
    supabaseClient.from('meeting_notes')
      .update({organization_id:org,actor_user_id:uid})
      .eq('user_id',uid).is('organization_id',null),
    supabaseClient.from('user_settings')
      .update({organization_id:org})
      .eq('user_id',uid)
  ];

  const results=await Promise.all(operations);
  const failed=results.find(r=>r.error);
  if(failed?.error) throw failed.error;
}

function scheduleCloudSync(){
  if(!cloudUser || cloudHydrating)return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer=setTimeout(()=>syncStateToCloud(false),700);
}

async function cloudLoadOrMigrate(){
  if(!cloudUser||!supabaseClient)return;
  updateCloudUi('Bulut verileri kontrol ediliyor…');

  const {count,error}=await supabaseClient
    .from('dealers')
    .select('id',{count:'exact',head:true});

  if(error){
    updateCloudUi('Bulut tabloları hazır değil: '+error.message);
    return;
  }

  if((count||0)===0){
    updateCloudUi('Bu hesabın ilk kurulumu yapılıyor…');
    await syncStateToCloud(true);
  }else{
    await loadStateFromCloud();
  }
}

function dealerToDb(d){
  return {
    id:d.id,
    user_id:d._ownerUserId||cloudUser.id,
    organization_id:teamContext.organizationId,
    created_by:d._createdBy||d._ownerUserId||cloudUser.id,
    updated_by:cloudUser.id,
    name:d.name||'',contact:d.contact||null,phone:d.phone||null,
    district:d.district||null,address:d.address||null,lat:d.lat??null,lng:d.lng??null,
    location_status:d.locationStatus||'unset',frequency:Number(d.frequency||14),
    priority:Number(d.priority||1),general_note:d.generalNote||null,
    planned_week:d.plannedWeek||null,planned_day:d.plannedDay||null,
    planned_order:d.plannedOrder??null,planned_stage:d.plannedStage||null,
    original_route_logic:d.originalRouteLogic||null,departure:d.departure||null,
    is_active:d.isActive!==false,
    updated_at:new Date().toISOString()
  };
}

function dealerFromDb(d){
  return {
    id:d.id,name:d.name,contact:d.contact||'',phone:d.phone||'',district:d.district||'',
    address:d.address||'',lat:d.lat,lng:d.lng,locationStatus:d.location_status||'unset',
    frequency:d.frequency||14,priority:d.priority||1,generalNote:d.general_note||'',
    plannedWeek:d.planned_week||'',plannedDay:d.planned_day||'',
    plannedOrder:d.planned_order??0,plannedStage:d.planned_stage||'',
    originalRouteLogic:d.original_route_logic||'',departure:d.departure||'08:30',
    isActive:d.is_active!==false,
    _ownerUserId:d.user_id,
    _createdBy:d.created_by||d.user_id
  };
}

async function syncStateToCloud(initial=false){
  if(!cloudUser||!supabaseClient||cloudSyncInProgress)return;
  cloudSyncInProgress=true;

  try{
    updateCloudUi(initial?'İlk veriler buluta aktarılıyor…':'Buluta kaydediliyor…');

    const dealerRows=state.dealers.map(dealerToDb);
    if(dealerRows.length){
      const {error}=await supabaseClient.from('dealers')
        .upsert(dealerRows,{onConflict:'user_id,id'});
      if(error) throw error;
    }

    // Yalnızca mevcut kullanıcının oluşturduğu ziyaretleri uzlaştır.
    // Başka personelin kayıtlarına dokunulmaz.
    const myVisits=state.visits.filter(v=>(v._ownerUserId||cloudUser.id)===cloudUser.id);
    {
      const {error:delErr}=await supabaseClient.from('visits')
        .delete().eq('user_id',cloudUser.id);
      if(delErr) throw delErr;

      if(myVisits.length){
        const rows=myVisits.map(v=>({
          id:v.id,user_id:cloudUser.id,
          organization_id:teamContext.organizationId,
          actor_user_id:v._actorUserId||cloudUser.id,
          dealer_id:v.dealerId,
          visit_date:new Date(v.date).toISOString(),
          note:v.note||null,follow_up:v.followUp||null,
          updated_at:new Date().toISOString()
        }));
        const {error}=await supabaseClient.from('visits').insert(rows);
        if(error) throw error;
      }
    }

    const myPayments=state.payments.filter(p=>(p._ownerUserId||cloudUser.id)===cloudUser.id);
    {
      const {error:delErr}=await supabaseClient.from('payment_promises')
        .delete().eq('user_id',cloudUser.id);
      if(delErr) throw delErr;

      if(myPayments.length){
        const rows=myPayments.map(p=>({
          id:p.id,user_id:cloudUser.id,
          organization_id:teamContext.organizationId,
          actor_user_id:p._actorUserId||cloudUser.id,
          dealer_id:p.dealerId,amount:Number(p.amount||0),
          promise_date:p.date,note:p.note||null,
          status:p.status||'pending',paid_at:p.paidAt||null,
          updated_at:new Date().toISOString()
        }));
        const {error}=await supabaseClient.from('payment_promises').insert(rows);
        if(error) throw error;
      }
    }

    const myMeetingNotes=(state.meetingNotes||[])
      .filter(m=>(m._ownerUserId||cloudUser.id)===cloudUser.id);
    {
      const {error:delErr}=await supabaseClient.from('meeting_notes')
        .delete().eq('user_id',cloudUser.id);
      if(delErr) throw delErr;

      if(myMeetingNotes.length){
        const rows=myMeetingNotes.map(m=>({
          id:m.id,user_id:cloudUser.id,
          organization_id:teamContext.organizationId,
          actor_user_id:m._actorUserId||cloudUser.id,
          title:m.title||'Toplantı Notu',note:m.note||'',
          meeting_date:m.meetingDate||null,status:m.status||'open',
          created_at:m.createdAt||new Date().toISOString(),
          updated_at:new Date().toISOString()
        }));
        const {error}=await supabaseClient.from('meeting_notes').insert(rows);
        if(error) throw error;
      }
    }

    const settings={
      user_id:cloudUser.id,
      organization_id:teamContext.organizationId,
      home_lat:state.home?.lat??null,
      home_lng:state.home?.lng??null,
      start_time:document.getElementById('startTime')?.value||'08:30',
      end_time:document.getElementById('endTime')?.value||'18:30',
      visit_minutes:Number(document.getElementById('visitMinutes')?.value||20),
      max_stops:Number(document.getElementById('maxStops')?.value||12),
      prioritize_payments:document.getElementById('prioritizePayments')?.checked??true,
      prefer_home_finish:document.getElementById('preferHomeFinish')?.checked??true,
      today_route:state.todayRoute||[],
      updated_at:new Date().toISOString()
    };
    const {error:settingsErr}=await supabaseClient.from('user_settings')
      .upsert(settings,{onConflict:'user_id'});
    if(settingsErr) throw settingsErr;

    updateCloudUi('Buluta kaydedildi • '+new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}));
  }catch(err){
    console.error('Cloud sync error',err);
    updateCloudUi('Bulut kaydı başarısız: '+err.message);
  }finally{
    cloudSyncInProgress=false;
  }
}

async function loadStateFromCloud(){
  if(!cloudUser||!supabaseClient)return;
  cloudHydrating=true;
  try{
    updateCloudUi('Buluttaki ekip verileri yükleniyor…');

    const [dRes,vRes,pRes,mRes,sRes]=await Promise.all([
      supabaseClient.from('dealers').select('*').order('name'),
      supabaseClient.from('visits').select('*').order('visit_date',{ascending:false}),
      supabaseClient.from('payment_promises').select('*').order('promise_date'),
      supabaseClient.from('meeting_notes').select('*').order('created_at',{ascending:false}),
      supabaseClient.from('user_settings').select('*').eq('user_id',cloudUser.id).maybeSingle()
    ]);
    for(const r of [dRes,vRes,pRes,mRes,sRes]) if(r.error) throw r.error;

    // Aynı dealer id birden fazla kullanıcı altında eski kopya olarak varsa,
    // organization kayıtlarından en güncel olanı kullan.
    const byId=new Map();
    for(const row of (dRes.data||[])){
      const current=byId.get(row.id);
      if(!current || new Date(row.updated_at||0)>new Date(current.updated_at||0)){
        byId.set(row.id,row);
      }
    }

    const cloudDealers=[...byId.values()].map(dealerFromDb);
    const dealerMap=new Map(cloudDealers.map(d=>[d.id,d]));
    for(const seeded of seededDealers){
      if(!dealerMap.has(seeded.id)) dealerMap.set(seeded.id,seeded);
    }
    state.dealers=[...dealerMap.values()];

    state.visits=(vRes.data||[]).map(v=>({
      id:v.id,dealerId:v.dealer_id,date:v.visit_date,
      note:v.note||'',followUp:v.follow_up||'',
      _ownerUserId:v.user_id,_actorUserId:v.actor_user_id||v.user_id
    }));

    state.payments=(pRes.data||[]).map(p=>({
      id:p.id,dealerId:p.dealer_id,amount:Number(p.amount),
      date:p.promise_date,note:p.note||'',status:p.status||'pending',
      paidAt:p.paid_at||null,
      _ownerUserId:p.user_id,_actorUserId:p.actor_user_id||p.user_id
    }));

    state.meetingNotes=(mRes.data||[]).map(m=>({
      id:m.id,title:m.title,note:m.note||'',meetingDate:m.meeting_date||'',
      status:m.status||'open',createdAt:m.created_at,
      _ownerUserId:m.user_id,_actorUserId:m.actor_user_id||m.user_id
    }));

    const s=sRes.data;
    if(s){
      if(s.home_lat!==null&&s.home_lng!==null) state.home={lat:s.home_lat,lng:s.home_lng};
      state.todayRoute=Array.isArray(s.today_route)?s.today_route:[];
      if(document.getElementById('startTime')) startTime.value=String(s.start_time||'08:30').slice(0,5);
      if(document.getElementById('endTime')) endTime.value=String(s.end_time||'18:30').slice(0,5);
      if(document.getElementById('visitMinutes')) visitMinutes.value=s.visit_minutes||20;
      if(document.getElementById('maxStops')) maxStops.value=s.max_stops||12;
      if(document.getElementById('prioritizePayments')) prioritizePayments.checked=s.prioritize_payments!==false;
      if(document.getElementById('preferHomeFinish')) preferHomeFinish.checked=s.prefer_home_finish!==false;
    }

    localStorage.setItem(storeKey,JSON.stringify(state));
    renderAll();
    if(typeof renderManagementDashboard==='function') await renderManagementDashboard();
    updateCloudUi('Ekip verileri yüklendi • '+new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}));
  }catch(err){
    console.error('Cloud load error',err);
    updateCloudUi('Buluttan yükleme başarısız: '+err.message);
  }finally{
    cloudHydrating=false;
  }
}

async function joinExistingOrganization(){
  if(!cloudUser||!supabaseClient)return;
  const code=(document.getElementById('teamJoinCodeInput')?.value||'').trim();
  if(!code){alert('Ekip kodunu gir.');return}

  const {data,error}=await supabaseClient.rpc('join_organization',{
    invite_code:code,
    person_name:null
  });
  if(error){alert('Ekibe katılma başarısız: '+error.message);return}

  await ensureTeamContext();
  await loadStateFromCloud();
  alert('İlke Akü ekibine katıldın.');
}

window.addEventListener('load',()=>initCloud());
