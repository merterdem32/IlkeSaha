let supabaseClient=null;
let cloudUser=null;
let cloudSyncTimer=null;
let cloudSyncInProgress=false;
let cloudHydrating=false;

function updateCloudUi(message){
  const btn=document.getElementById('cloudAccountBtn');
  const status=document.getElementById('cloudStatus');
  if(btn){
    btn.textContent=cloudUser ? '☁ Bulut: Bağlı' : '☁ Bulut: Giriş Yap';
    btn.className='btn '+(cloudUser?'btn-primary':'btn-ghost');
  }
  if(status) status.textContent=message || (cloudUser ? 'Bulut senkronizasyonu aktif.' : 'Bu cihazdaki veriler henüz buluta bağlı değil.');
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
    updateCloudUi();

    supabaseClient.auth.onAuthStateChange(async (_event,session)=>{
      cloudUser=session?.user||null;
      updateCloudUi();
      if(cloudUser) await cloudLoadOrMigrate();
    });

    if(cloudUser) await cloudLoadOrMigrate();
  }catch(err){
    console.error('Cloud init error',err);
    updateCloudUi('Bulut bağlantısı başlatılamadı: '+err.message);
  }
}

function openCloudAccount(){
  if(cloudUser){
    document.getElementById('cloudSignedInEmail').textContent=cloudUser.email||'';
    document.getElementById('cloudSignedOutBox').style.display='none';
    document.getElementById('cloudSignedInBox').style.display='block';
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
  const {data,error}=await supabaseClient.auth.signUp({email,password});
  if(error){alert('Hesap oluşturulamadı: '+error.message);return}
  if(data.session){
    cloudUser=data.user;
    cloudDialog.close();
    await cloudLoadOrMigrate();
  }else{
    alert('Hesap oluşturuldu. Supabase e-posta doğrulaması açıksa gelen kutundaki bağlantıyı onayla, sonra giriş yap.');
  }
}

async function cloudSignIn(){
  const email=cloudEmail.value.trim();
  const password=cloudPassword.value;
  if(!email||!password){alert('E-posta ve parola gir.');return}
  const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
  if(error){alert('Giriş yapılamadı: '+error.message);return}
  cloudUser=data.user;
  cloudDialog.close();
  await cloudLoadOrMigrate();
}

async function cloudSignOut(){
  if(!supabaseClient)return;
  await supabaseClient.auth.signOut();
  cloudUser=null;
  updateCloudUi();
  cloudDialog.close();
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
    id:d.id,user_id:cloudUser.id,name:d.name||'',contact:d.contact||null,phone:d.phone||null,
    district:d.district||null,address:d.address||null,lat:d.lat??null,lng:d.lng??null,
    location_status:d.locationStatus||'unset',frequency:Number(d.frequency||14),
    priority:Number(d.priority||1),general_note:d.generalNote||null,
    planned_week:d.plannedWeek||null,planned_day:d.plannedDay||null,
    planned_order:d.plannedOrder??null,planned_stage:d.plannedStage||null,
    original_route_logic:d.originalRouteLogic||null,departure:d.departure||null,
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
    originalRouteLogic:d.original_route_logic||'',departure:d.departure||'08:30'
  };
}

async function syncStateToCloud(initial=false){
  if(!cloudUser||!supabaseClient||cloudSyncInProgress)return;
  cloudSyncInProgress=true;
  try{
    updateCloudUi(initial?'İlk veriler buluta aktarılıyor…':'Buluta kaydediliyor…');

    const dealerRows=state.dealers.map(dealerToDb);
    if(dealerRows.length){
      const {error}=await supabaseClient.from('dealers').upsert(dealerRows,{onConflict:'user_id,id'});
      if(error) throw error;
    }

    // Visits are reconciled as a full set so "Geri Al" also deletes the cloud record.
    {
      const {error:delErr}=await supabaseClient.from('visits').delete().eq('user_id',cloudUser.id);
      if(delErr) throw delErr;
      if(state.visits.length){
        const rows=state.visits.map(v=>({
          id:v.id,user_id:cloudUser.id,dealer_id:v.dealerId,
          visit_date:new Date(v.date).toISOString(),note:v.note||null,
          follow_up:v.followUp||null,updated_at:new Date().toISOString()
        }));
        const {error}=await supabaseClient.from('visits').insert(rows);
        if(error) throw error;
      }
    }

    {
      const {error:delErr}=await supabaseClient.from('payment_promises').delete().eq('user_id',cloudUser.id);
      if(delErr) throw delErr;
      if(state.payments.length){
        const rows=state.payments.map(p=>({
          id:p.id,user_id:cloudUser.id,dealer_id:p.dealerId,
          amount:Number(p.amount||0),promise_date:p.date,note:p.note||null,
          status:p.status||'pending',paid_at:p.paidAt||null,updated_at:new Date().toISOString()
        }));
        const {error}=await supabaseClient.from('payment_promises').insert(rows);
        if(error) throw error;
      }
    }

    const settings={
      user_id:cloudUser.id,
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
    const {error:settingsErr}=await supabaseClient.from('user_settings').upsert(settings,{onConflict:'user_id'});
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
    updateCloudUi('Buluttaki kayıtlar yükleniyor…');
    const [dRes,vRes,pRes,sRes]=await Promise.all([
      supabaseClient.from('dealers').select('*').order('name'),
      supabaseClient.from('visits').select('*').order('visit_date',{ascending:false}),
      supabaseClient.from('payment_promises').select('*').order('promise_date'),
      supabaseClient.from('user_settings').select('*').maybeSingle()
    ]);
    for(const r of [dRes,vRes,pRes,sRes]) if(r.error) throw r.error;

    const cloudDealers=(dRes.data||[]).map(dealerFromDb);
    const byId=new Map(cloudDealers.map(d=>[d.id,d]));
    for(const seeded of seededDealers) if(!byId.has(seeded.id)) byId.set(seeded.id,seeded);

    state.dealers=[...byId.values()];
    state.visits=(vRes.data||[]).map(v=>({
      id:v.id,dealerId:v.dealer_id,date:v.visit_date,note:v.note||'',followUp:v.follow_up||''
    }));
    state.payments=(pRes.data||[]).map(p=>({
      id:p.id,dealerId:p.dealer_id,amount:Number(p.amount),date:p.promise_date,
      note:p.note||'',status:p.status||'pending',paidAt:p.paid_at||null
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
    updateCloudUi('Buluttan yüklendi • '+new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}));
  }catch(err){
    console.error('Cloud load error',err);
    updateCloudUi('Buluttan yükleme başarısız: '+err.message);
  }finally{
    cloudHydrating=false;
  }
}

window.addEventListener('load',()=>initCloud());
