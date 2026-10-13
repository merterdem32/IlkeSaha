// İlke Saha - ortak Rut Planı / Rut Planı2 kaynak plan editörü
(()=>{
  const DAYS=['PAZARTESİ','SALI','ÇARŞAMBA','PERŞEMBE','CUMA','CUMARTESİ'];
  const DAY_LABELS={PAZARTESİ:'Pazartesi',SALI:'Salı',ÇARŞAMBA:'Çarşamba',PERŞEMBE:'Perşembe',CUMA:'Cuma',CUMARTESİ:'Cumartesi'};
  const route2Cache=new Map();
  let editorItems=[];
  let editorLoadedKey='';
  let editorOpenContext=null;
  let installTimer=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const normDay=v=>String(v||'').trim().toLocaleUpperCase('tr-TR');
  const weekText=n=>Number(n)===2?'2. HAFTA':'1. HAFTA';
  const cacheKey=(staffId,week,day)=>staffId+'|'+Number(week)+'|'+normDay(day);

  function isReady(){
    return typeof supabaseClient!=='undefined'&&supabaseClient&&
      typeof cloudUser!=='undefined'&&cloudUser&&
      typeof teamContext!=='undefined'&&teamContext?.organizationId;
  }

  function isManager(){return typeof teamContext!=='undefined'&&teamContext?.role==='MANAGER';}
  function isField(){return typeof teamContext!=='undefined'&&teamContext?.role==='FIELD_STAFF';}

  function canEditStaff(staffId){
    if(!staffId||!cloudUser)return false;
    if(isManager())return true;
    return isField()&&staffId===cloudUser.id;
  }

  function fieldMembers(){
    if(!isManager()){
      if(!cloudUser)return [];
      const p=(typeof teamProfilesById!=='undefined'&&teamProfilesById)?teamProfilesById.get(cloudUser.id):null;
      return [{userId:cloudUser.id,label:p?.full_name||p?.username||cloudUser.email||'Ben'}];
    }
    const members=(typeof managerDirectoryCache!=='undefined'&&managerDirectoryCache?.members)||[];
    const profiles=(typeof managerDirectoryCache!=='undefined'&&managerDirectoryCache?.profiles)||new Map();
    return members.filter(m=>m.role==='FIELD_STAFF'&&m.is_active!==false).map(m=>{
      const p=profiles.get(m.user_id)||{};
      return {userId:m.user_id,label:p.full_name||p.username||p.email||m.user_id,username:p.username||''};
    });
  }

  function staffLabel(id){
    if(!id)return '';
    const p=(typeof teamProfilesById!=='undefined'&&teamProfilesById)?teamProfilesById.get(id):null;
    if(p)return p.full_name||p.username||p.email||id;
    if(typeof managerDirectoryCache!=='undefined'&&managerDirectoryCache?.profiles){
      const x=managerDirectoryCache.profiles.get(id)||{};
      return x.full_name||x.username||x.email||id;
    }
    return id===cloudUser?.id?'Ben':id;
  }

  function ensureStyles(){
    if(document.getElementById('routeTemplateEditorStyles'))return;
    const s=document.createElement('style');
    s.id='routeTemplateEditorStyles';
    s.textContent=`
      #routeTemplateEditorDialog{max-width:760px}
      .route-template-editor-list{display:flex;flex-direction:column;gap:8px;margin-top:10px;max-height:46vh;overflow:auto;padding-right:2px}
      .route-template-editor-row{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid var(--brand-border);border-radius:12px;padding:10px;background:#fff}
      .route-template-editor-row .num{width:30px;height:30px}
      .route-template-editor-actions{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}
      .route-template-editor-actions .btn{padding:7px 9px;min-height:34px}
      .route-plan-edit-launch{margin-top:10px;width:100%}
      #managerRouteTemplateQuickCard .toolbar{margin-bottom:0}
      @media(max-width:600px){
        .route-template-editor-row{grid-template-columns:32px minmax(0,1fr)}
        .route-template-editor-actions{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr)}
        .route-template-editor-actions .btn{width:100%}
      }
    `;
    document.head.appendChild(s);
  }

  function ensureDialog(){
    if(document.getElementById('routeTemplateEditorDialog'))return;
    const d=document.createElement('dialog');
    d.id='routeTemplateEditorDialog';
    d.innerHTML=`<div class="modal">
      <div class="toolbar" style="justify-content:space-between;align-items:center">
        <div>
          <h2 id="routeTemplateEditorTitle" style="margin:0">Rut Planını Düzenle</h2>
          <div id="routeTemplateEditorSub" class="muted"></div>
        </div>
        <button class="btn btn-ghost" type="button" onclick="routeTemplateEditorClose()">Kapat</button>
      </div>
      <div class="row">
        <div id="routeTemplatePlanWrap"><label>Plan</label><select id="routeTemplatePlanType"><option value="ROUTE1">Rut Planı</option><option value="ROUTE2">Rut Planı2</option></select></div>
        <div id="routeTemplateStaffWrap"><label>Personel</label><select id="routeTemplateStaff"></select></div>
      </div>
      <div class="row">
        <div><label>Hafta</label><select id="routeTemplateWeek"><option value="1">1. Hafta</option><option value="2">2. Hafta</option></select></div>
        <div><label>Gün</label><select id="routeTemplateDay">${DAYS.map(x=>'<option value="'+x+'">'+DAY_LABELS[x]+'</option>').join('')}</select></div>
      </div>
      <div id="routeTemplateEditorStatus" class="note" style="margin-top:12px">Plan yükleniyor…</div>
      <label>Bu güne bayi ekle</label>
      <div class="toolbar" style="align-items:center">
        <select id="routeTemplateAddDealer" style="flex:1;min-width:220px"></select>
        <button class="btn btn-accent" type="button" onclick="routeTemplateEditorAdd()">+ Ekle</button>
      </div>
      <div id="routeTemplateEditorList" class="route-template-editor-list"></div>
      <div class="toolbar" style="justify-content:flex-end;margin-top:14px">
        <button class="btn btn-ghost" type="button" onclick="routeTemplateEditorReload()">↻ Yenile</button>
        <button class="btn btn-primary" type="button" onclick="routeTemplateEditorSave()">Kaydet</button>
      </div>
    </div>`;
    document.body.appendChild(d);
    ['routeTemplatePlanType','routeTemplateStaff','routeTemplateWeek','routeTemplateDay'].forEach(id=>{
      document.getElementById(id)?.addEventListener('change',()=>loadEditorDay());
    });
  }

  async function ensureDirectory(){
    if(isManager()&&typeof loadManagerDirectory==='function'){
      try{await loadManagerDirectory();}catch(_){ }
    }
  }

  function fillStaffSelect(selected){
    const sel=document.getElementById('routeTemplateStaff');
    if(!sel)return;
    const rows=fieldMembers();
    sel.innerHTML=rows.map(x=>'<option value="'+esc(x.userId)+'">'+esc(x.label)+(x.username?' ('+esc(x.username)+')':'')+'</option>').join('');
    if(selected&&rows.some(x=>x.userId===selected))sel.value=selected;
    else if(rows.some(x=>x.userId===cloudUser?.id))sel.value=cloudUser.id;
  }

  function currentEditorSelection(){
    return {
      planType:document.getElementById('routeTemplatePlanType')?.value||'ROUTE1',
      staffId:document.getElementById('routeTemplateStaff')?.value||cloudUser?.id||'',
      week:Number(document.getElementById('routeTemplateWeek')?.value||1),
      day:normDay(document.getElementById('routeTemplateDay')?.value||'PAZARTESİ')
    };
  }

  function route1Fallback(staffId,week,day){
    return (state.dealers||[])
      .filter(d=>d.isActive!==false&&d.assignedUserId===staffId&&d.plannedWeek===weekText(week)&&normDay(d.plannedDay)===day)
      .sort((a,b)=>(Number(a.plannedOrder)||999)-(Number(b.plannedOrder)||999))
      .map(d=>d.id);
  }

  function route2Fallback(staffId,week,day){
    // Şu anki Excel kaynak Rut Planı2, saha1 için uygulamaya gömülü. Kendi planı
    // düzenlenirken bu kaynak başlangıç noktası olarak kullanılır. Başka personelde
    // kayıt yoksa boş plan açılır ve yönetici sıfırdan dizebilir.
    if(!window.route2Plan||!window.route2DealerBySource)return [];
    const canUseSource=staffId===cloudUser?.id || (isManager()&&staffLabel(staffId).toLocaleLowerCase('tr-TR').includes('saha1'));
    if(!canUseSource)return [];
    const key=String(week)+'|'+DAY_LABELS[day];
    const source=window.route2Plan[key]?.ids||[];
    return source.map(n=>window.route2DealerBySource(n)?.id).filter(Boolean);
  }

  async function fetchTemplate(planType,staffId,week,day){
    const {data,error}=await supabaseClient.from('route_plan_templates')
      .select('dealer_ids,updated_at,updated_by')
      .eq('organization_id',teamContext.organizationId)
      .eq('plan_type',planType)
      .eq('staff_user_id',staffId)
      .eq('week_no',week)
      .eq('day_name',day)
      .maybeSingle();
    if(error)throw error;
    return data||null;
  }

  async function loadEditorDay(){
    if(!isReady())return;
    const s=currentEditorSelection();
    if(!canEditStaff(s.staffId)){
      alert('Bu personelin planını düzenleme yetkin yok.');
      return;
    }
    const status=document.getElementById('routeTemplateEditorStatus');
    const list=document.getElementById('routeTemplateEditorList');
    if(status)status.textContent='Plan yükleniyor…';
    if(list)list.innerHTML='';
    editorLoadedKey=s.planType+'|'+s.staffId+'|'+s.week+'|'+s.day;
    try{
      const row=await fetchTemplate(s.planType,s.staffId,s.week,s.day);
      let ids=row?.dealer_ids||[];
      let source='Bulut planı';
      if(!row){
        ids=s.planType==='ROUTE1'?route1Fallback(s.staffId,s.week,s.day):route2Fallback(s.staffId,s.week,s.day);
        source=s.planType==='ROUTE1'?'Mevcut Rut Planı':'Mevcut Rut Planı2 kaynağı';
      }
      editorItems=ids.map(id=>state.dealers.find(d=>d.id===id)).filter(Boolean);
      renderEditor(source,row?.updated_at||null);
    }catch(err){
      console.error('Route template load failed',err);
      editorItems=[];
      renderEditor('');
      if(status) status.innerHTML='<span class="badge b-bad">Plan tablosu hazır değil</span><div class="muted" style="margin-top:5px">Supabase SQL Editor’de <strong>supabase-team-phase11-route-plan-editor.sql</strong> dosyasını bir kez çalıştır.</div>';
    }
  }

  function renderEditor(source='',updatedAt=null){
    const s=currentEditorSelection();
    const status=document.getElementById('routeTemplateEditorStatus');
    const list=document.getElementById('routeTemplateEditorList');
    if(status){
      status.innerHTML='<strong>'+esc(s.planType==='ROUTE1'?'Rut Planı':'Rut Planı2')+' • '+esc(staffLabel(s.staffId))+' • '+s.week+'. Hafta • '+esc(DAY_LABELS[s.day])+'</strong>'+
        '<div class="muted" style="margin-top:4px">'+editorItems.length+' bayi'+(source?' • Kaynak: '+esc(source):'')+(updatedAt?' • Son kayıt: '+new Date(updatedAt).toLocaleString('tr-TR'):'')+'</div>';
    }
    if(list){
      list.innerHTML=editorItems.length?editorItems.map((d,i)=>
        '<div class="route-template-editor-row">'+
          '<div class="num">'+(i+1)+'</div>'+
          '<div style="min-width:0"><strong>'+esc(d.name)+'</strong><div class="muted">'+esc(d.district||'')+(d.locationStatus==='verified'?' • Konum doğrulandı':d.locationStatus==='estimated'?' • Tahmini konum':' • Konum girilmedi')+'</div></div>'+
          '<div class="route-template-editor-actions">'+
            '<button class="btn btn-ghost" type="button" '+(i===0?'disabled':'')+' onclick="routeTemplateEditorMove('+i+',-1)">↑</button>'+
            '<button class="btn btn-ghost" type="button" '+(i===editorItems.length-1?'disabled':'')+' onclick="routeTemplateEditorMove('+i+',1)">↓</button>'+
            '<button class="btn btn-danger" type="button" onclick="routeTemplateEditorRemove('+i+')">Çıkar</button>'+
          '</div></div>'
      ).join(''):'<div class="muted">Bu gün için bayi yok. Aşağıdaki listeden bayi ekleyebilirsin.</div>';
    }
    renderAddOptions();
  }

  function renderAddOptions(){
    const sel=document.getElementById('routeTemplateAddDealer');
    if(!sel)return;
    const s=currentEditorSelection();
    const inPlan=new Set(editorItems.map(d=>d.id));
    const rows=(state.dealers||[])
      .filter(d=>d.isActive!==false&&d.assignedUserId===s.staffId&&!inPlan.has(d.id))
      .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'tr'));
    sel.innerHTML=rows.length?rows.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.name)+(d.district?' • '+esc(d.district):'')+'</option>').join(''):'<option value="">Eklenebilecek bayi yok</option>';
  }

  function moveEditor(index,delta){
    const j=index+delta;
    if(index<0||j<0||index>=editorItems.length||j>=editorItems.length)return;
    const t=editorItems[index];editorItems[index]=editorItems[j];editorItems[j]=t;renderEditor('Düzenleniyor');
  }
  function removeEditor(index){
    if(index<0||index>=editorItems.length)return;
    editorItems.splice(index,1);renderEditor('Düzenleniyor');
  }
  function addEditor(){
    const id=document.getElementById('routeTemplateAddDealer')?.value;
    const d=(state.dealers||[]).find(x=>x.id===id);
    if(!d)return;
    if(!editorItems.some(x=>x.id===id))editorItems.push(d);
    renderEditor('Düzenleniyor');
  }

  async function saveTemplateRow(s,ids){
    const payload={
      organization_id:teamContext.organizationId,
      plan_type:s.planType,
      staff_user_id:s.staffId,
      week_no:s.week,
      day_name:s.day,
      dealer_ids:ids,
      updated_by:cloudUser.id,
      updated_at:new Date().toISOString()
    };
    const {error}=await supabaseClient.from('route_plan_templates')
      .upsert(payload,{onConflict:'organization_id,plan_type,staff_user_id,week_no,day_name'});
    if(error)throw error;
  }

  async function updateLegacyRoute1(s,ids){
    // Eski Rut Planı ekranı planned_week/day/order alanlarını kullanmaya devam ediyor.
    // Kaynak plan editörü kaydedildiğinde bu alanları da güvenli biçimde eşitliyoruz.
    const current=(state.dealers||[]).filter(d=>d.assignedUserId===s.staffId&&d.plannedWeek===weekText(s.week)&&normDay(d.plannedDay)===s.day);
    const desired=new Set(ids);
    const toClear=current.filter(d=>!desired.has(d.id));

    for(const d of toClear){
      const {error}=await supabaseClient.from('organization_dealers')
        .update({planned_week:null,planned_day:null,planned_order:null,updated_by:cloudUser.id,updated_at:new Date().toISOString()})
        .eq('organization_id',teamContext.organizationId).eq('id',d.id);
      if(error)throw error;
      d.plannedWeek=null;d.plannedDay=null;d.plannedOrder=null;
    }

    for(let i=0;i<ids.length;i++){
      const d=(state.dealers||[]).find(x=>x.id===ids[i]);
      if(!d)continue;
      const {error}=await supabaseClient.from('organization_dealers')
        .update({planned_week:weekText(s.week),planned_day:s.day,planned_order:i+1,updated_by:cloudUser.id,updated_at:new Date().toISOString()})
        .eq('organization_id',teamContext.organizationId).eq('id',d.id);
      if(error)throw error;
      d.plannedWeek=weekText(s.week);d.plannedDay=s.day;d.plannedOrder=i+1;
    }
  }

  async function saveEditor(){
    if(!isReady())return;
    const s=currentEditorSelection();
    if(!canEditStaff(s.staffId)){alert('Bu planı düzenleme yetkin yok.');return;}
    const expected=s.planType+'|'+s.staffId+'|'+s.week+'|'+s.day;
    if(expected!==editorLoadedKey){alert('Seçim değişti. Önce planın yüklenmesini bekleyip tekrar kaydet.');return;}
    const ids=editorItems.map(d=>d.id);
    const btn=document.querySelector('#routeTemplateEditorDialog .btn-primary:last-child');
    if(btn)btn.disabled=true;
    try{
      await saveTemplateRow(s,ids);
      if(s.planType==='ROUTE1')await updateLegacyRoute1(s,ids);
      if(s.planType==='ROUTE2'){
        route2Cache.set(cacheKey(s.staffId,s.week,s.day),ids.slice());
        if(s.staffId===cloudUser.id)applyRoute2Override(s.week,s.day,ids);
      }
      try{localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){ }
      if(typeof renderAll==='function')renderAll();
      if(typeof renderRoute2==='function'&&s.planType==='ROUTE2'&&s.staffId===cloudUser.id)setTimeout(()=>renderRoute2(),0);
      if(typeof logActivity==='function'){
        try{await logActivity('ROUTE_TEMPLATE_UPDATED','ROUTE',s.staffId,{planType:s.planType,week:s.week,day:s.day,count:ids.length});}catch(_){ }
      }
      renderEditor('Bulut planı',new Date().toISOString());
      alert((s.planType==='ROUTE1'?'Rut Planı':'Rut Planı2')+' güncellendi.\n'+s.week+'. Hafta '+DAY_LABELS[s.day]+': '+ids.length+' bayi');
      if(isManager()&&typeof loadManagerRouteTemplate==='function'&&s.planType==='ROUTE1')setTimeout(()=>loadManagerRouteTemplate(),0);
    }catch(err){
      console.error('Route template save failed',err);
      alert('Rut planı kaydedilemedi: '+(err.message||err));
    }finally{if(btn)btn.disabled=false;}
  }

  function openEditor(planType='ROUTE1',staffId=null){
    if(!isReady()){alert('Bulut bağlantısı henüz hazır değil.');return;}
    ensureStyles();ensureDialog();
    ensureDirectory().then(()=>{
      editorOpenContext={planType,staffId:staffId||cloudUser.id};
      const plan=document.getElementById('routeTemplatePlanType');
      const planWrap=document.getElementById('routeTemplatePlanWrap');
      const staffWrap=document.getElementById('routeTemplateStaffWrap');
      if(plan){plan.value=planType;plan.disabled=!isManager()&&!!planType;}
      if(planWrap)planWrap.style.display=isManager()?'':'none';
      fillStaffSelect(staffId||cloudUser.id);
      if(staffWrap)staffWrap.style.display=isManager()?'':'none';

      if(planType==='ROUTE1'){
        const pw=document.getElementById('planWeek')?.value||'1. HAFTA';
        const pd=normDay(document.getElementById('planDay')?.value||'PAZARTESİ');
        if(document.getElementById('routeTemplateWeek'))routeTemplateWeek.value=pw.startsWith('2')?'2':'1';
        if(document.getElementById('routeTemplateDay')&&DAYS.includes(pd))routeTemplateDay.value=pd;
      }else{
        const w=document.getElementById('route2Week')?.value||'1';
        const d=normDay(document.getElementById('route2Day')?.value||'PAZARTESİ');
        if(document.getElementById('routeTemplateWeek'))routeTemplateWeek.value=String(w);
        if(document.getElementById('routeTemplateDay')&&DAYS.includes(d))routeTemplateDay.value=d;
      }

      const title=document.getElementById('routeTemplateEditorTitle');
      const sub=document.getElementById('routeTemplateEditorSub');
      if(title)title.textContent=isManager()?'Rut Planlarını Düzenle':'Rut Planını Düzenle';
      if(sub)sub.textContent='Bayi ekle, günden çıkar ve sıralamayı yukarı/aşağı değiştir. Değişiklikler buluta kaydedilir.';
      routeTemplateEditorDialog.showModal();
      loadEditorDay();
    });
  }

  function closeEditor(){document.getElementById('routeTemplateEditorDialog')?.close();}

  function addFieldLaunchButton(sectionId,planType){
    const sec=document.getElementById(sectionId);
    if(!sec||!isField())return;
    const card=sec.querySelector('.card.span-4')||sec.querySelector('.card');
    if(!card||card.querySelector('[data-route-template-launch="'+planType+'"]'))return;
    const b=document.createElement('button');
    b.type='button';b.className='btn btn-ghost route-plan-edit-launch';b.dataset.routeTemplateLaunch=planType;
    b.textContent='✎ Rut Planını Düzenle';
    b.onclick=()=>openEditor(planType,cloudUser.id);
    const firstHr=card.querySelector('hr');
    if(firstHr)firstHr.insertAdjacentElement('beforebegin',b);else card.appendChild(b);
  }

  function addManagerQuickCard(){
    if(!isManager())return;
    const sec=document.getElementById('management');
    if(!sec||document.getElementById('managerRouteTemplateQuickCard'))return;
    const grid=sec.querySelector('.grid');
    if(!grid)return;
    const c=document.createElement('div');
    c.id='managerRouteTemplateQuickCard';c.className='card span-12';
    c.innerHTML='<div class="toolbar" style="justify-content:space-between;align-items:center"><div><h3 style="margin:0">Rut Planlarını Düzenle</h3><div class="muted">Saha1 / Saha2 için 1. veya 2. hafta, istediğin güne bayi ekle-çıkar ve sırayı değiştir.</div></div><div class="toolbar" style="margin:0"><button class="btn btn-primary" type="button" onclick="openRouteTemplateEditor(\'ROUTE1\')">Rut Planı</button><button class="btn btn-accent" type="button" onclick="openRouteTemplateEditor(\'ROUTE2\')">Rut Planı2</button></div></div>';
    grid.insertBefore(c,grid.firstChild);
  }

  function applyRoute2Override(week,day,ids){
    if(!window.route2Plan||!window.route2Names||!Array.isArray(ids))return;
    const key=String(week)+'|'+DAY_LABELS[normDay(day)];
    const p=window.route2Plan[key];
    if(!p)return;
    const nums=[];
    ids.forEach((id,i)=>{
      const d=(state.dealers||[]).find(x=>x.id===id);
      if(!d)return;
      const n=900000+(Number(week)*10000)+(DAYS.indexOf(normDay(day))+1)*1000+i+1;
      window.route2Names[String(n)]=d.name;
      nums.push(n);
    });
    p.ids=nums;
  }

  async function loadMyRoute2Overrides(){
    if(!isReady()||!window.route2Plan||!cloudUser)return;
    try{
      const {data,error}=await supabaseClient.from('route_plan_templates')
        .select('week_no,day_name,dealer_ids')
        .eq('organization_id',teamContext.organizationId)
        .eq('plan_type','ROUTE2')
        .eq('staff_user_id',cloudUser.id);
      if(error)throw error;
      (data||[]).forEach(r=>{
        const k=cacheKey(cloudUser.id,r.week_no,r.day_name);
        route2Cache.set(k,(r.dealer_ids||[]).slice());
        applyRoute2Override(r.week_no,r.day_name,r.dealer_ids||[]);
      });
      if(typeof renderRoute2==='function')setTimeout(()=>renderRoute2(),0);
    }catch(err){
      // Faz 11 SQL henüz çalıştırılmadıysa mevcut statik Rut Planı2 aynen çalışmaya devam eder.
      console.warn('Rut Planı2 override yüklenemedi',err?.message||err);
    }
  }

  function installUi(){
    if(!cloudUser||!teamContext?.role)return false;
    ensureStyles();ensureDialog();
    if(isField()){
      addFieldLaunchButton('route','ROUTE1');
      addFieldLaunchButton('route2','ROUTE2');
    }
    if(isManager())addManagerQuickCard();
    return true;
  }

  function start(){
    clearInterval(installTimer);
    installTimer=setInterval(()=>{
      if(installUi()){
        clearInterval(installTimer);
        setTimeout(loadMyRoute2Overrides,150);
      }
    },150);
  }

  window.openRouteTemplateEditor=(planType,staffId)=>openEditor(planType||'ROUTE1',staffId||null);
  window.routeTemplateEditorClose=closeEditor;
  window.routeTemplateEditorMove=moveEditor;
  window.routeTemplateEditorRemove=removeEditor;
  window.routeTemplateEditorAdd=addEditor;
  window.routeTemplateEditorSave=saveEditor;
  window.routeTemplateEditorReload=loadEditorDay;
  window.refreshRoutePlan2Templates=loadMyRoute2Overrides;

  document.addEventListener('DOMContentLoaded',start,{once:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&isReady())setTimeout(()=>{installUi();loadMyRoute2Overrides();},120)});
  setTimeout(start,0);
})();
