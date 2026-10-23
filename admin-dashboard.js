// İlke Saha - Yönetim Dashboard v1
(()=>{
  let loading=false,lastLoadedAt=0,timer=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const isManager=()=>typeof teamContext!=='undefined'&&teamContext?.role==='MANAGER';
  const today=()=>typeof todayStr==='function'?todayStr():new Date().toISOString().slice(0,10);
  const money=n=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(n||0));
  const dayDiff=date=>{
    if(!date)return 9999;
    const a=new Date(String(date).slice(0,10)+'T12:00:00'),b=new Date(today()+'T12:00:00');
    return Math.max(0,Math.floor((b-a)/86400000));
  };
  const labelFor=(id,profiles)=>{
    const p=profiles.get(id)||{};
    return p.full_name||p.username||p.email||'Personel';
  };

  function ensureStyles(){
    if(document.getElementById('adminDashboardStyles'))return;
    const s=document.createElement('style');s.id='adminDashboardStyles';
    s.textContent=`
      .adm-dash{grid-column:span 12;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}
      .adm-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;min-width:0}
      .adm-kpi{font-size:28px;font-weight:850;line-height:1.05;color:#0f172a;margin-top:5px}
      .adm-kpi-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;grid-column:span 12}
      .adm-staff-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .adm-staff{border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#fff}
      .adm-progress{height:9px;border-radius:999px;background:#e2e8f0;overflow:hidden;margin-top:8px}
      .adm-progress>i{display:block;height:100%;background:#16a34a;border-radius:999px}
      .adm-alert{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #edf2f7}
      .adm-alert:last-child{border-bottom:0}.adm-alert-dot{width:9px;height:9px;border-radius:50%;margin-top:6px;flex:0 0 auto}
      .adm-alert.bad .adm-alert-dot{background:#dc2626}.adm-alert.warn .adm-alert-dot{background:#f59e0b}.adm-alert.ok .adm-alert-dot{background:#16a34a}
      .adm-table{width:100%;border-collapse:collapse}.adm-table th,.adm-table td{padding:8px 7px;border-bottom:1px solid #eef2f7;text-align:left;font-size:13px;vertical-align:top}
      .adm-table th{color:#64748b;font-weight:700}.adm-title-row{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}
      .adm-span-12{grid-column:span 12}.adm-span-7{grid-column:span 7}.adm-span-5{grid-column:span 5}.adm-span-6{grid-column:span 6}
      @media(max-width:1000px){.adm-kpi-row{grid-template-columns:repeat(2,minmax(0,1fr))}.adm-span-7,.adm-span-5,.adm-span-6{grid-column:span 12}}
      @media(max-width:700px){.adm-kpi-row,.adm-staff-grid{grid-template-columns:1fr}.adm-kpi{font-size:24px}}
    `;
    document.head.appendChild(s);
  }

  function ensureShell(){
    if(!isManager())return null;
    ensureStyles();
    const mgmt=document.getElementById('management'),grid=mgmt?.querySelector('.grid');
    if(!grid)return null;
    let host=document.getElementById('adminOpsDashboard');
    if(host)return host;
    host=document.createElement('div');host.id='adminOpsDashboard';host.className='adm-dash';
    host.innerHTML='<div class="adm-card adm-span-12"><strong>Yönetim dashboard hazırlanıyor…</strong><div class="muted" style="margin-top:5px">Saha, rut, tahsilat ve ziyaret riskleri yükleniyor.</div></div>';
    const quick=document.getElementById('adminQuickPanel');
    if(quick)quick.insertAdjacentElement('afterend',host);else{
      const header=grid.firstElementChild;if(header)header.insertAdjacentElement('afterend',host);else grid.appendChild(host);
    }
    return host;
  }

  async function queryData(){
    const org=teamContext.organizationId,t=today(),start30=new Date(new Date(t+'T12:00:00').getTime()-30*86400000).toISOString();
    const [membersRes,profilesRes,routesRes,visitsRes,paymentsRes,activityRes]=await Promise.all([
      supabaseClient.from('organization_members').select('user_id,role,is_active').eq('organization_id',org).eq('is_active',true),
      supabaseClient.from('profiles').select('user_id,username,full_name,email'),
      supabaseClient.from('daily_routes').select('id,assigned_user_id,route_date,status,updated_at').eq('organization_id',org).eq('route_date',t),
      supabaseClient.from('visits').select('dealer_id,actor_user_id,user_id,visit_date').eq('organization_id',org).gte('visit_date',start30),
      supabaseClient.from('payment_promises').select('id,dealer_id,actor_user_id,user_id,amount,promise_date,status').eq('organization_id',org),
      supabaseClient.from('activity_log').select('actor_user_id,action,created_at').eq('organization_id',org).order('created_at',{ascending:false}).limit(150)
    ]);
    for(const r of [membersRes,profilesRes,routesRes,visitsRes,paymentsRes,activityRes])if(r.error)throw r.error;
    const routes=routesRes.data||[];
    let stops=[];
    if(routes.length){
      const sr=await supabaseClient.from('route_stops').select('route_id,dealer_id,stop_order').in('route_id',routes.map(r=>r.id));
      if(sr.error)throw sr.error;stops=sr.data||[];
    }
    return {members:membersRes.data||[],profiles:new Map((profilesRes.data||[]).map(p=>[p.user_id,p])),routes,stops,visits:visitsRes.data||[],payments:paymentsRes.data||[],activity:activityRes.data||[]};
  }

  function render(data){
    const host=ensureShell();if(!host)return;
    const t=today(),field=data.members.filter(m=>m.role==='FIELD_STAFF');
    const activeDealers=(state.dealers||[]).filter(d=>d.isActive!==false);
    const visitsToday=data.visits.filter(v=>String(v.visit_date||'').slice(0,10)===t);
    const uniqueToday=new Set(visitsToday.map(v=>v.dealer_id)).size;
    const pending=data.payments.filter(p=>!['paid','cancelled'].includes(String(p.status||'pending')));
    const overdue=pending.filter(p=>String(p.promise_date||'')<t);
    const overdueAmount=overdue.reduce((s,p)=>s+Number(p.amount||0),0);

    const latestVisit=new Map();
    for(const v of data.visits){const old=latestVisit.get(v.dealer_id);if(!old||new Date(v.visit_date)>new Date(old))latestVisit.set(v.dealer_id,v.visit_date);}
    // state.visits can contain older history than the 30-day query; use it too.
    for(const v of (state.visits||[])){const old=latestVisit.get(v.dealerId);if(!old||new Date(v.date)>new Date(old))latestVisit.set(v.dealerId,v.date);}
    const neglected=activeDealers.map(d=>({d,last:latestVisit.get(d.id)||null,days:dayDiff(latestVisit.get(d.id))})).filter(x=>x.days>=21).sort((a,b)=>b.days-a.days);
    const critical=neglected.filter(x=>x.days>=30);

    const staffRows=field.map(m=>{
      const uid=m.user_id,name=labelFor(uid,data.profiles),assigned=activeDealers.filter(d=>d.assignedUserId===uid);
      const route=data.routes.find(r=>r.assigned_user_id===uid),planned=route?data.stops.filter(s=>s.route_id===route.id):[];
      const personVisits=visitsToday.filter(v=>(v.actor_user_id||v.user_id)===uid);
      const visitedIds=new Set(personVisits.map(v=>v.dealer_id));
      const plannedIds=new Set(planned.map(s=>s.dealer_id));
      const planVisited=[...visitedIds].filter(id=>plannedIds.has(id)).length;
      const pct=planned.length?Math.round(planVisited/planned.length*100):0;
      const pOver=overdue.filter(p=>(p.actor_user_id||p.user_id)===uid);
      const lastAct=data.activity.find(a=>a.actor_user_id===uid);
      return {uid,name,assigned:assigned.length,route,planned:planned.length,visits:visitedIds.size,planVisited,pct,pOver,lastAct};
    });

    const alerts=[];
    for(const r of staffRows){
      if(!r.route)alerts.push({type:'bad',text:r.name+' bugün rut paylaşmadı.',action:'managerFocusStaffRoute',id:r.uid});
      else if(r.planned&&r.pct<50)alerts.push({type:'warn',text:r.name+' plan uyumu %'+r.pct+' ('+r.planVisited+'/'+r.planned+').',action:'managerFocusStaffRoute',id:r.uid});
    }
    if(overdue.length)alerts.push({type:'bad',text:overdue.length+' geciken ödeme sözü var • '+money(overdueAmount),section:'payments'});
    if(critical.length)alerts.push({type:'warn',text:critical.length+' bayi 30+ gündür ziyaret edilmemiş.',section:'dealers'});
    if(!alerts.length)alerts.push({type:'ok',text:'Şu anda kritik yönetim uyarısı yok.'});

    const staffHtml=staffRows.map(r=>{
      const last=r.lastAct?new Date(r.lastAct.created_at).toLocaleString('tr-TR'):'Aktivite yok';
      return `<div class="adm-staff">
        <div class="adm-title-row"><div><strong>${esc(r.name)}</strong><div class="muted">${r.assigned} aktif bayi</div></div><span class="badge ${r.route?'b-ok':'b-bad'}">${r.route?'Rut paylaşıldı':'Rut yok'}</span></div>
        <div class="toolbar" style="margin:6px 0;gap:6px;flex-wrap:wrap"><span class="badge b-info">${r.planned} planlanan</span><span class="badge b-ok">${r.visits} ziyaret</span><span class="badge ${r.pOver.length?'b-bad':'b-info'}">${r.pOver.length} geciken</span></div>
        <div><strong>Plan uyumu: %${r.pct}</strong> <span class="muted">(${r.planVisited}/${r.planned||0})</span></div>
        <div class="adm-progress"><i style="width:${Math.max(0,Math.min(100,r.pct))}%"></i></div>
        <div class="muted" style="margin-top:8px">Son aktivite: ${esc(last)}</div>
        <div class="toolbar" style="margin-top:10px"><button class="btn btn-ghost" onclick="managerFocusStaffRoute('${esc(r.uid)}')">Rutunu Aç</button><button class="btn btn-ghost" onclick="activateSection('dailyreport');setTimeout(()=>{const s=document.getElementById('dailyReportStaff');if(s){s.value='${esc(r.uid)}';s.dispatchEvent(new Event('change',{bubbles:true}));}},50)">Raporu Aç</button></div>
      </div>`;
    }).join('')||'<div class="muted">Aktif saha personeli yok.</div>';

    const alertHtml=alerts.map(a=>`<div class="adm-alert ${a.type}"><span class="adm-alert-dot"></span><div style="flex:1"><strong>${esc(a.text)}</strong>${a.section?`<div style="margin-top:6px"><button class="btn btn-ghost" onclick="activateSection('${a.section}')">İncele</button></div>`:''}</div></div>`).join('');

    const neglectedHtml=neglected.slice(0,12).map(x=>{
      const owner=labelFor(x.d.assignedUserId,data.profiles),last=x.last?new Date(x.last).toLocaleDateString('tr-TR'):'Hiç ziyaret yok';
      return `<tr><td><strong>${esc(x.d.cariCode?x.d.cariCode+' - '+x.d.name:x.d.name)}</strong><div class="muted">${esc(x.d.district||'-')}</div></td><td>${esc(owner)}</td><td>${esc(last)}</td><td><span class="badge ${x.days>=30?'b-bad':'b-warn'}">${x.days>=9999?'Hiç':x.days+' gün'}</span></td></tr>`;
    }).join('')||'<tr><td colspan="4" class="muted">21+ gündür bekleyen bayi yok.</td></tr>';

    host.innerHTML=`
      <div class="adm-kpi-row">
        <div class="adm-card"><div class="muted">Bugünkü farklı ziyaret</div><div class="adm-kpi">${uniqueToday}</div></div>
        <div class="adm-card"><div class="muted">Rut paylaşan personel</div><div class="adm-kpi">${data.routes.length}/${field.length}</div></div>
        <div class="adm-card"><div class="muted">Geciken tahsilat</div><div class="adm-kpi">${overdue.length}</div><div class="muted">${money(overdueAmount)}</div></div>
        <div class="adm-card"><div class="muted">30+ gündür ziyaret yok</div><div class="adm-kpi">${critical.length}</div></div>
      </div>
      <div class="adm-card adm-span-7"><div class="adm-title-row"><div><h3 style="margin:0">Bugünkü Saha Durumu</h3><div class="muted">Planlanan / gerçekleşen / plana uyum</div></div><button class="btn btn-ghost" onclick="refreshAdminOpsDashboard(true)">↻ Yenile</button></div><div class="adm-staff-grid">${staffHtml}</div></div>
      <div class="adm-card adm-span-5"><h3 style="margin-top:0">Müdahale Gerektirenler</h3>${alertHtml}</div>
      <div class="adm-card adm-span-12"><div class="adm-title-row"><div><h3 style="margin:0">Uzun Süredir Ziyaret Edilmeyen Bayiler</h3><div class="muted">21 gün ve üzeri • en uzun bekleyenler üstte</div></div><button class="btn btn-ghost" onclick="activateSection('dealers')">Tüm Bayiler</button></div><div style="overflow:auto"><table class="adm-table"><thead><tr><th>Bayi</th><th>Sorumlu</th><th>Son ziyaret</th><th>Bekleme</th></tr></thead><tbody>${neglectedHtml}</tbody></table></div></div>
      <div class="adm-card adm-span-12"><div class="muted">Son güncelleme: ${new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</div></div>`;
  }

  async function load(force=false){
    if(!isManager()||!supabaseClient||!cloudUser||!teamContext?.organizationId||loading)return;
    if(!force&&Date.now()-lastLoadedAt<45000)return;
    const host=ensureShell();if(!host)return;
    loading=true;
    if(force)host.innerHTML='<div class="adm-card adm-span-12"><strong>Dashboard yenileniyor…</strong></div>';
    try{const data=await queryData();render(data);lastLoadedAt=Date.now();}
    catch(err){console.error('Admin ops dashboard',err);host.innerHTML='<div class="adm-card adm-span-12"><strong>Dashboard verileri yüklenemedi.</strong><div class="muted" style="margin-top:5px">'+esc(err.message||err)+'</div><button class="btn btn-ghost" style="margin-top:10px" onclick="refreshAdminOpsDashboard(true)">Tekrar Dene</button></div>';}
    finally{loading=false;}
  }

  window.refreshAdminOpsDashboard=load;
  document.addEventListener('click',e=>{const b=e.target?.closest?.('nav button[data-section]');if(b?.dataset.section==='management')setTimeout(()=>load(true),80);},true);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&document.getElementById('management')?.classList.contains('active'))setTimeout(()=>load(false),150);});
  function start(){ensureShell();setTimeout(()=>load(true),300);clearInterval(timer);timer=setInterval(()=>{if(document.getElementById('management')?.classList.contains('active'))load(false);},120000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
