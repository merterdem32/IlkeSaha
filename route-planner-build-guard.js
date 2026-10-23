// İlke Saha - Rut Planlayıcı sonuç garantisi
(()=>{
  let patched=false,tries=0;
  function hasResult(){
    const box=document.getElementById('routePlannerResult');
    if(!box)return false;
    const text=String(box.textContent||'').trim();
    return !!text && !text.includes('Bayi seçip plan oluşturduğunda 12 günlük liste burada görünecek.');
  }
  function patch(){
    if(patched||typeof window.buildTwoWeekRoutePlan!=='function'||typeof window.__baseBuildTwoWeekRoutePlan!=='function')return false;
    const road=window.buildTwoWeekRoutePlan,base=window.__baseBuildTwoWeekRoutePlan;
    if(road===base)return false;
    window.buildTwoWeekRoutePlan=async function(){
      const status=document.getElementById('routePlannerStatus');
      try{
        await road.apply(this,arguments);
      }catch(err){
        console.warn('Karayolu planlayıcı hata verdi, temel planlayıcıya dönülüyor',err);
      }
      if(!hasResult()){
        if(status)status.textContent='Karayolu hesabı sonuç üretmedi; çalışan temel planlayıcı devreye alınıyor…';
        try{
          const r=base.apply(this,arguments);
          if(r?.then)await r;
          if(status&&hasResult())status.textContent='Plan hazır. Karayolu motoru sonuç üretmediği için yedek planlayıcı kullanıldı.';
        }catch(err){
          console.error('Temel Rut Planlayıcı da hata verdi',err);
          if(status)status.textContent='Plan oluşturulamadı: '+(err?.message||err);
          alert('Plan oluşturulamadı: '+(err?.message||err));
        }
      }
    };
    patched=true;
    return true;
  }
  const t=setInterval(()=>{tries++;if(patch()||tries>120)clearInterval(t)},100);
})();
