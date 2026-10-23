// İlke Saha - karayolu override'ından önce çalışan temel Rut Planlayıcı fonksiyonlarını sakla
(()=>{
  let tries=0;
  const t=setInterval(()=>{
    tries++;
    if(typeof window.buildTwoWeekRoutePlan==='function'){
      if(!window.__baseBuildTwoWeekRoutePlan)window.__baseBuildTwoWeekRoutePlan=window.buildTwoWeekRoutePlan;
      if(typeof window.approveTwoWeekRoutePlan==='function'&&!window.__baseApproveTwoWeekRoutePlan)window.__baseApproveTwoWeekRoutePlan=window.approveTwoWeekRoutePlan;
      clearInterval(t);
    }else if(tries>100)clearInterval(t);
  },80);
})();
