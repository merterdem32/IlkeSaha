// İlke Saha - Rut Planlayıcı çalışma zamanı
// Tek görevi: temel planlayıcıyı saklamak ve karayolu planlayıcısı sonuç üretmezse güvenli fallback çalıştırmak.
(()=>{
  const baseBuild=typeof window.buildTwoWeekRoutePlan==='function'?window.buildTwoWeekRoutePlan:null;
  if(!baseBuild){
    console.warn('Rut Planlayıcı temel build fonksiyonu bulunamadı');
    return;
  }

  let wrappedRoad=null;
  let timer=null;
  let tries=0;

  function hasResult(){
    const box=document.getElementById('routePlannerResult');
    if(!box)return false;
    const text=String(box.textContent||'').trim();
    return !!text && !text.includes('Bayi seçip plan oluşturduğunda 12 günlük liste burada görünecek.');
  }

  async function runBase(args){
    const status=document.getElementById('routePlannerStatus');
    if(status)status.textContent='Karayolu hesabı sonuç üretmedi; temel planlayıcı devreye alınıyor…';
    const r=baseBuild.apply(window,args);
    if(r?.then)await r;
    if(status&&hasResult())status.textContent='Plan hazır. Karayolu motoru sonuç üretmediği için yedek planlayıcı kullanıldı.';
  }

  function install(){
    const current=window.buildTwoWeekRoutePlan;
    if(typeof current!=='function')return false;
    if(current===baseBuild)return false;
    if(current===wrappedRoad||current._ilkeRuntimeWrapped)return true;

    const roadBuild=current;
    const wrapper=async function(){
      const args=arguments;
      const status=document.getElementById('routePlannerStatus');
      try{
        await roadBuild.apply(this,args);
      }catch(err){
        console.warn('Karayolu planlayıcı hata verdi',err);
      }

      if(hasResult())return;

      try{
        await runBase(args);
      }catch(err){
        console.error('Rut Planlayıcı fallback de hata verdi',err);
        const msg=String(err?.message||err);
        if(status)status.textContent='Plan oluşturulamadı: '+msg;
        alert('Plan oluşturulamadı: '+msg);
      }
    };
    wrapper._ilkeRuntimeWrapped=true;
    wrappedRoad=wrapper;
    window.__baseBuildTwoWeekRoutePlan=baseBuild;
    window.buildTwoWeekRoutePlan=wrapper;
    return true;
  }

  function start(){
    clearInterval(timer);
    tries=0;
    timer=setInterval(()=>{
      tries++;
      if(install()||tries>160){clearInterval(timer);timer=null;}
    },100);
  }

  start();
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&window.buildTwoWeekRoutePlan!==wrappedRoad)setTimeout(start,80);
  });
})();
