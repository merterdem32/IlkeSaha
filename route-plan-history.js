// İlke Saha - Rut Planı sürüm geçmişi / güvenli geri alma
(()=>{
  const DAYS=['PAZARTESİ','SALI','ÇARŞAMBA','PERŞEMBE','CUMA','CUMARTESİ'];
  const MAX=5;
  const PREFIX='ilkeSahaRoutePlanHistoryV1';
  let restoring=false;

  const norm=v=>String(v||'').trim().toLocaleUpperCase('tr-TR');
  const weekText=w=>Number(w)===2?'2. HAFTA':'1. HAFTA';
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const ready=()=>typeof supabaseClient!=='undefined'&&supabaseClient&&typeof cloudUser!=='undefined'&&cloudUser&&typeof teamContext!=='undefined'&&teamContext?.organizationId;
  const key=(planType,staffId)=>[PREFIX,teamContext?.organizationId||'org',planType||'ROUTE1',staffId||'me'].join(':');

  function read(planType,staffId){
    try{const x=JSON.parse(localStorage.getItem(key(planType,staffId))||'[]');return Array.isArray(x)?x:[];}catch(_){return[];}
  }
  function write(planType,staffId,rows){try{localStorage.setItem(key(planType,staffId),JSON.stringify(rows.slice(0,MAX)));}catch(_){}}
  function normalizedRows(rows){
    const by=new Map((rows||[]).map(r=>[Number(r.week_no)+'|'+norm(r.day_name),Array.isArray(r.dealer_ids)?r.dealer_ids.slice():[]]));
    const out=[];for(const w of [1,2])for(const d of DAYS)out.push({week_no:w,day_name:d,dealer_ids:(by.get(w+'|'+d)||[]).slice()});return out;
  }
  function signature(rows){return JSON.stringify(normalizedRows(rows).map(r=>[r.week_no,r.day_name,r.dealer_ids]));}

  function fallbackRoute1(staffId){
    const out=[];
    for(const w of [1,2])for(const d of DAYS){
      const ids=((typeof state!=='undefined'&&state?.dealers)||[]).filter(x=>x.isActive!==false&&x.assignedUserId===staffId&&x.plannedWeek===weekText(w)&&norm(x.plannedDay)===d)
        .sort((a,b)=>(Number(a.plannedOrder)||999)-(Number(b.plannedOrder)||999)).map(x=>x.id);
      out.push({week_no:w,day_name:d,dealer_ids:ids});
    }
    return out;
  }

  async function currentRows(planType,staffId){
    if(!ready())return [];
    const {data,error}=await supabaseClient.from('route_plan_templates').select('week_no,day_name,dealer_ids')
      .eq('organization_id',teamContext.organizationId).eq('plan_type',planType).eq('staff_user_id',staffId);
    if(error)throw error;
    if((data||[]).length)return normalizedRows(data);
    return planType==='ROUTE1'?normalizedRows(fallbackRoute1(staffId)):normalizedRows([]);
  }

  async function capture(planType='ROUTE1',staffId=null,reason='Plan değişikliği öncesi'){
    if(restoring||!ready())return null;
    staffId=staffId||cloudUser.id;
    try{
      const rows=await currentRows(planType,staffId);const sig=signature(rows);const hist=read(planType,staffId);
      if(hist[0]?.signature===sig)return hist[0];
      const snap={id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())),createdAt:new Date().toISOString(),reason:String(reason||'Plan değişikliği öncesi'),planType,staffId,rows,signature:sig};
      hist.unshift(snap);write(planType,staffId,hist);return snap;
    }catch(err){console.warn('Rut planı yedeği alınamadı',err);return null;}
  }

  async function syncLegacyRoute1(staffId,rows){
    const placement=new Map();
    normalizedRows(rows).forEach(r=>(r.dealer_ids||[]).forEach((id,i)=>placement.set(id,{week:r.week_no,day:r.day_name,order:i+1})));
    const mine=((typeof state!=='undefined'&&state?.dealers)||[]).filter(d=>d.assignedUserId===staffId);
    const now=new Date().toISOString();
    for(const d of mine){
      const p=placement.get(d.id);
      const next=p?{planned_week:weekText(p.week),planned_day:p.day,planned_order:p.order}:{planned_week:null,planned_day:null,planned_order:null};
      const same=(d.plannedWeek||null)===(next.planned_week||null)&&(d.plannedDay||null)===(next.planned_day||null)&&Number(d.plannedOrder||0)===Number(next.planned_order||0);
      if(same)continue;
      const {error}=await supabaseClient.from('organization_dealers').update({...next,updated_by:cloudUser.id,updated_at:now}).eq('organization_id',teamContext.organizationId).eq('id',d.id);
      if(error)throw error;
      d.plannedWeek=next.planned_week;d.plannedDay=next.planned_day;d.plannedOrder=next.planned_order;
    }
  }

  async function restore(planType,staffId,snapshotId){
    if(!ready()||restoring)return;
    const hist=read(planType,staffId),snap=hist.find(x=>x.id===snapshotId);if(!snap){alert('Seçilen plan yedeği bulunamadı.');return;}
    if(!confirm(new Date(snap.createdAt).toLocaleString('tr-TR')+' tarihli plan geri yüklensin mi?\n\nMevcut plan da geri yüklemeden önce otomatik yedeklenecek.'))return;
    restoring=true;
    try{
      restoring=false;await capture(planType,staffId,'Geri yükleme öncesi otomatik yedek');restoring=true;
      const now=new Date().toISOString();
      const payload=normalizedRows(snap.rows).map(r=>({organization_id:teamContext.organizationId,plan_type:planType,staff_user_id:staffId,week_no:r.week_no,day_name:r.day_name,dealer_ids:r.dealer_ids,updated_by:cloudUser.id,updated_at:now}));
      const {error}=await supabaseClient.from('route_plan_templates').upsert(payload,{onConflict:'organization_id,plan_type,staff_user_id,week_no,day_name'});if(error)throw error;
      if(planType==='ROUTE1')await syncLegacyRoute1(staffId,snap.rows);
      try{if(typeof storeKey!=='undefined'&&typeof state!=='undefined')localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){ }
      if(typeof loadStateFromCloud==='function')await loadStateFromCloud();
      if(typeof renderAll==='function')renderAll();
      if(planType==='ROUTE2'&&staffId===cloudUser.id&&typeof refreshRoutePlan2Templates==='function')await refreshRoutePlan2Templates();
      if(typeof refreshMapRouteLivePanel==='function')setTimeout(()=>refreshMapRouteLivePanel(),100);
      document.getElementById('routePlanHistoryDialog')?.close();
      alert('Plan önceki sürüme geri yüklendi.');
    }catch(err){console.error('Rut planı geri yüklenemedi',err);alert('Plan geri yüklenemedi: '+(err?.message||err));}
    finally{restoring=false;}
  }

  function ensureDialog(){
    if(document.getElementById('routePlanHistoryDialog'))return;
    const d=document.createElement('dialog');d.id='routePlanHistoryDialog';d.innerHTML='<div class="modal" style="max-width:680px"><div class="toolbar" style="justify-content:space-between;align-items:center"><div><h2 style="margin:0">Önceki Planlar</h2><div id="routePlanHistorySub" class="muted"></div></div><button class="btn btn-ghost" type="button" onclick="document.getElementById(\'routePlanHistoryDialog\').close()">Kapat</button></div><div id="routePlanHistoryList" style="margin-top:12px"></div></div>';document.body.appendChild(d);
  }
  function currentStaff(){return document.getElementById('mapRouteLiveStaff')?.value||document.getElementById('routeTemplateStaff')?.value||cloudUser?.id||'';}
  function open(planType='ROUTE1',staffId=null){
    if(!ready()){alert('Bulut bağlantısı henüz hazır değil.');return;}ensureDialog();staffId=staffId||currentStaff();const hist=read(planType,staffId),list=document.getElementById('routePlanHistoryList'),sub=document.getElementById('routePlanHistorySub');
    if(sub)sub.textContent=(planType==='ROUTE1'?'Rut Planı':'Rut Planı2')+' • Son '+MAX+' sürüm bu cihazda saklanır.';
    if(list)list.innerHTML=hist.length?hist.map((x,i)=>'<div class="card" style="margin:8px 0;padding:12px"><div class="toolbar" style="justify-content:space-between;align-items:center"><div><strong>'+(i+1)+'. '+esc(new Date(x.createdAt).toLocaleString('tr-TR'))+'</strong><div class="muted" style="margin-top:4px">'+esc(x.reason||'Plan yedeği')+'</div></div><button class="btn btn-primary" type="button" onclick="routePlanHistoryRestore(\''+esc(planType)+'\',\''+esc(staffId)+'\',\''+esc(x.id)+'\')">Bu Plana Dön</button></div></div>').join(''):'<div class="note">Henüz plan yedeği oluşmadı. İlk plan değişikliğinde otomatik olarak alınacak.</div>';
    const dialog=document.getElementById('routePlanHistoryDialog');dialog?.showModal();
  }

  function addButton(sectionId,planType){
    const sec=document.getElementById(sectionId);if(!sec||document.getElementById('routePlanHistoryBtn-'+planType))return;
    const card=sec.querySelector('.card.span-4')||sec.querySelector('.card');if(!card)return;
    const b=document.createElement('button');b.id='routePlanHistoryBtn-'+planType;b.type='button';b.className='btn btn-ghost';b.style.width='100%';b.style.marginTop='8px';b.textContent='↶ Önceki Planlar';b.onclick=()=>open(planType,currentStaff());card.appendChild(b);
  }

  function wrap(name,flag,context){
    const fn=window[name];if(typeof fn!=='function'||window[flag])return false;
    window[flag]=true;window[name]=async function(){
      try{const c=context();if(c?.staffId)await capture(c.planType,c.staffId,c.reason);}catch(err){console.warn('Plan yedeği atlandı',err);}
      return fn.apply(this,arguments);
    };return true;
  }
  function wrapAll(){
    wrap('mapRouteLiveMutate','__routeHistoryMapLiveWrapped',()=>({planType:document.getElementById('mapRouteLivePlan')?.value||'ROUTE1',staffId:document.getElementById('mapRouteLiveStaff')?.value||cloudUser?.id,reason:'Harita plan düzenlemesi öncesi'}));
    wrap('mapRouteAddSave','__routeHistoryMapAddWrapped',()=>({planType:document.getElementById('mapRoutePlanType')?.value||'ROUTE1',staffId:document.getElementById('mapRouteStaff')?.value||cloudUser?.id,reason:'Haritadan güne bayi ekleme öncesi'}));
    wrap('routeTemplateEditorSave','__routeHistoryEditorWrapped',()=>({planType:document.getElementById('routeTemplatePlanType')?.value||'ROUTE1',staffId:document.getElementById('routeTemplateStaff')?.value||cloudUser?.id,reason:'Rut planı editörü kaydı öncesi'}));
    wrap('approveTwoWeekRoutePlan','__routeHistoryPlannerWrapped',()=>({planType:'ROUTE1',staffId:cloudUser?.id,reason:'Rut Planlayıcı onayı öncesi'}));
    wrap('deactivateDealerFromRoute','__routeHistoryDeactivate1Wrapped',()=>({planType:'ROUTE1',staffId:cloudUser?.id,reason:'Bayi rut dışı bırakma öncesi'}));
    wrap('deactivateRoute2Dealer','__routeHistoryDeactivate2Wrapped',()=>({planType:'ROUTE2',staffId:cloudUser?.id,reason:'Rut Planı2 bayi rut dışı bırakma öncesi'}));
  }

  function install(){ensureDialog();addButton('route','ROUTE1');addButton('route2','ROUTE2');wrapAll();}
  window.routePlanHistory={capture,list:read,restore,open};
  window.openRoutePlanHistory=open;
  window.routePlanHistoryRestore=restore;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,100),{once:true});else setTimeout(install,0);
  let tries=0;const t=setInterval(()=>{tries++;install();if(tries>240)clearInterval(t);},500);
})();