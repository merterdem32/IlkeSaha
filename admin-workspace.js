// İlke Saha - Admin çalışma alanı
(()=>{
  let timer=null;

  function isManager(){return typeof teamContext!=='undefined'&&teamContext?.role==='MANAGER';}

  function go(section){
    try{
      if(typeof activateSection==='function')activateSection(section);
      if(section==='management'&&typeof renderManagementDashboard==='function')setTimeout(()=>renderManagementDashboard(),30);
      if(section==='routePlanner'&&typeof window.prepareRoutePlanner==='function')setTimeout(()=>window.prepareRoutePlanner(),30);
      if(section==='dailyreport'&&typeof window.loadDailyReport==='function')setTimeout(()=>window.loadDailyReport(),30);
      if(section==='mapsec'&&typeof window.renderMap==='function')setTimeout(()=>window.renderMap(),100);
    }catch(err){console.warn('Admin hızlı geçiş başarısız',err);}
  }

  function ensureStyles(){
    if(document.getElementById('adminWorkspaceStyles'))return;
    const s=document.createElement('style');
    s.id='adminWorkspaceStyles';
    s.textContent=`
      .admin-quick-grid{display:grid;grid-template-columns:repeat(6,minmax(130px,1fr));gap:10px;margin-top:12px}
      .admin-quick-btn{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:12px;text-align:left;cursor:pointer;min-height:76px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
      .admin-quick-btn:hover{border-color:#cbd5e1;box-shadow:0 4px 14px rgba(15,23,42,.08)}
      .admin-quick-btn strong{display:block;font-size:14px;color:#0f172a;margin-bottom:4px}
      .admin-quick-btn span{display:block;font-size:12px;color:#64748b;line-height:1.35}
      @media(max-width:1100px){.admin-quick-grid{grid-template-columns:repeat(3,minmax(130px,1fr))}}
      @media(max-width:700px){.admin-quick-grid{grid-template-columns:repeat(2,minmax(130px,1fr))}}
    `;
    document.head.appendChild(s);
  }

  function ensureQuickPanel(){
    if(!isManager())return;
    const sec=document.getElementById('management');
    const grid=sec?.querySelector('.grid');
    if(!grid||document.getElementById('adminQuickPanel'))return;
    const card=document.createElement('div');
    card.id='adminQuickPanel';
    card.className='card span-12';
    card.innerHTML=`
      <div>
        <h3 style="margin:0">Hızlı Yönetim</h3>
        <div class="muted">Saha operasyonunda en sık ihtiyaç duyulan yönetim ekranları.</div>
      </div>
      <div class="admin-quick-grid">
        <button class="admin-quick-btn" data-admin-go="mapsec"><strong>🗺 Harita</strong><span>Saha 1 / Saha 2 bayilerini filtrele ve rut planlarını haritadan yönet.</span></button>
        <button class="admin-quick-btn" data-admin-go="routePlanner"><strong>🧭 Rut Planlayıcı</strong><span>Personel bazında iki haftalık rutları karayoluna göre oluştur.</span></button>
        <button class="admin-quick-btn" data-admin-go="dealers"><strong>🏪 Bayiler</strong><span>Bayi, sorumlu personel, cari ve konum kayıtlarını yönet.</span></button>
        <button class="admin-quick-btn" data-admin-go="dailyreport"><strong>📋 Gün Sonu Raporu</strong><span>Personel ve tarih seçerek saha raporlarını incele.</span></button>
        <button class="admin-quick-btn" data-admin-go="payments"><strong>₺ Tahsilat</strong><span>Bekleyen ve geciken ödeme sözlerini ekip bazında takip et.</span></button>
        <button class="admin-quick-btn" data-admin-go="potentialDealers"><strong>🎯 Potansiyel Bayiler</strong><span>Yeni müşteri adaylarını ve görüşme sürecini takip et.</span></button>
      </div>`;
    const first=grid.firstElementChild;
    if(first)first.insertAdjacentElement('afterend',card);else grid.appendChild(card);
  }

  function repairAdminNav(){
    if(!isManager())return false;
    ensureStyles();
    const route=document.getElementById('routeNavBtn');
    const route2=document.getElementById('route2NavBtn');
    const dash=document.getElementById('dashboardNavBtn');
    const settings=document.getElementById('settingsNavBtn');
    if(route)route.style.display='none';
    if(route2)route2.style.display='none';
    if(dash)dash.style.display='none';
    if(settings)settings.style.display='none';
    const active=document.querySelector('.section.active');
    if(active&&['route','route2','dashboard','settings'].includes(active.id))go('management');
    ensureQuickPanel();
    return true;
  }

  document.addEventListener('click',e=>{
    const b=e.target?.closest?.('[data-admin-go]');
    if(b&&isManager()){e.preventDefault();go(b.dataset.adminGo);}
  },true);

  const obs=new MutationObserver(()=>{if(isManager())repairAdminNav();});
  if(document.body)obs.observe(document.body,{childList:true,subtree:true});

  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(repairAdminNav,80);});
  window.addEventListener('focus',()=>setTimeout(repairAdminNav,80));

  function start(){
    clearInterval(timer);let n=0;
    timer=setInterval(()=>{n++;if(isManager())repairAdminNav();if(n>240){clearInterval(timer);timer=null;}},200);
  }

  window.refreshAdminWorkspace=repairAdminNav;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();