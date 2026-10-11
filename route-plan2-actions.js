// İlke Saha - Rut Planı2 aksiyonları
// Mevcut Rut Planı kaynak verisine dokunmadan, seçili yeni planı bugünkü rut taslağına aktarır.
(() => {
  const norm=v=>String(v||'').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g,' ');

  function sourceNumbers(){
    return [...document.querySelectorAll('#route2List .route-stop')]
      .map(row=>{
        const btn=row.querySelector('button[onclick^="route2Dealer("]');
        const m=btn?.getAttribute('onclick')?.match(/route2Dealer\((\d+)\)/);
        return m?Number(m[1]):null;
      })
      .filter(Number.isFinite);
  }

  function dealerForSource(n){
    const id='imported-'+String(n).padStart(3,'0');
    let d=(state.dealers||[]).find(x=>x.id===id);
    if(d)return d;
    const row=[...document.querySelectorAll('#route2List .route-stop')].find(r=>{
      const btn=r.querySelector('button[onclick^="route2Dealer("]');
      return btn?.getAttribute('onclick')===`route2Dealer(${n})`;
    });
    const name=row?.querySelector('.route-info strong')?.textContent||'';
    return (state.dealers||[]).find(x=>norm(x.name)===norm(name))||null;
  }

  function selectedDealers(){
    return sourceNumbers().map(n=>dealerForSource(n)).filter(Boolean);
  }

  function setStatus(text){
    const el=document.getElementById('route2PublishStatus');
    if(el)el.textContent=text;
  }

  function loadRoute2Today(showAlert=true){
    if(typeof state==='undefined')return false;
    if(typeof renderRoute2==='function')renderRoute2();
    const nums=sourceNumbers();
    const dealers=selectedDealers();
    if(!nums.length){
      alert('Önce Rut Planı2 içinden hafta ve günü seç.');
      return false;
    }
    if(!dealers.length){
      alert('Seçili plandaki bayiler ana bayi listesiyle eşleşmedi.');
      return false;
    }
    state.todayRoute=dealers.map(d=>d.id);
    if(typeof persist==='function')persist();
    if(typeof markRouteDraftChanged==='function')markRouteDraftChanged();
    setStatus('Rut Planı2 seçimi bugünkü rut taslağına yüklendi. Henüz yöneticiyle paylaşılmadı.');
    if(showAlert && dealers.length!==nums.length){
      alert('Plan yüklendi. '+dealers.length+' bayi eşleşti; '+(nums.length-dealers.length)+' bayi ana listede bulunamadı.');
    }
    return true;
  }

  function optimizeRoute2(){
    if(!loadRoute2Today(false))return;
    if(typeof buildRoute==='function'){
      buildRoute();
      setStatus('Rut Planı2 seçimi optimize edildi. Henüz yöneticiyle paylaşılmadı.');
    }
  }

  async function publishRoute2(){
    if(!(state.todayRoute||[]).length){
      if(!loadRoute2Today(false))return;
    }
    if(typeof publishTodayRoute!=='function'){
      alert('Rut yayınlama fonksiyonu bulunamadı.');
      return;
    }
    const result=publishTodayRoute();
    if(result&&typeof result.then==='function')await result;
    setStatus('Bugünkü rut yöneticiye gönderildi / yayınlandı.');
  }

  function clearRoute2Today(){
    if(typeof clearTodayRoute==='function') clearTodayRoute();
    else {
      state.todayRoute=[];
      if(typeof persist==='function')persist();
    }
    setStatus('Bugünkü rut temizlendi. Rut Planı2 kaynak planı değişmedi.');
  }

  function installControls(){
    const section=document.getElementById('route2');
    if(!section)return false;
    if(document.getElementById('route2ActionPanel'))return true;
    const left=section.querySelector('.card.span-4');
    if(!left)return false;

    const panel=document.createElement('div');
    panel.id='route2ActionPanel';
    panel.innerHTML=`
      <button class="btn btn-primary" style="margin-top:12px;width:100%" onclick="openOutOfRouteVisit()">+ Rota Dışı Ziyaret Ekle</button>
      <div class="muted" style="margin-top:6px">Rutunda olmayan yeni bir firmayı ziyaret ettiysen firma ve görüşme bilgilerini buradan kaydet.</div>
      <hr style="border:0;border-top:1px solid #e2e8f0;margin:16px 0">
      <button class="btn btn-ghost" style="margin-top:10px;width:100%" onclick="loadRoute2Today()">Seçili Planı Bugüne Yükle</button>
      <button class="btn btn-accent" style="margin-top:12px;width:100%" onclick="optimizeRoute2()">En Mantıklı Rutu Oluştur</button>
      <div id="route2PublishStatus" class="muted" style="margin-top:12px">Bugünkü rut henüz yöneticiyle paylaşılmadı.</div>
      <button class="btn btn-primary" style="margin-top:8px;width:100%" onclick="publishRoute2()">✓ Bugünkü Rutu Onayla ve Yöneticiye Gönder</button>
      <button class="btn btn-ghost" style="margin-top:8px;width:100%" onclick="clearRoute2Today()">Bugünkü rutu temizle</button>`;
    left.appendChild(panel);
    return true;
  }

  window.loadRoute2Today=loadRoute2Today;
  window.optimizeRoute2=optimizeRoute2;
  window.publishRoute2=publishRoute2;
  window.clearRoute2Today=clearRoute2Today;

  function boot(){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(installControls()||tries>40)clearInterval(timer);
    },100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();