// İlke Saha - mobil uygulama/sekme geçişlerinde ekran konumunu korur.
(() => {
  const KEY='ilkeSahaUiStateV1';
  let scrollTimer=null;
  let hiddenAt=0;

  function read(){
    try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){return {};}
  }

  function write(data){
    try{localStorage.setItem(KEY,JSON.stringify(data));}catch(_){}
  }

  function activeSectionId(){
    return document.querySelector('.section.active')?.id || read().section || 'dashboard';
  }

  function saveScroll(){
    if(document.body?.classList.contains('auth-signed-out'))return;
    const data=read();
    const section=activeSectionId();
    data.section=section;
    data.scrollPositions=data.scrollPositions||{};
    data.scrollPositions[section]=Math.max(0,Math.round(window.scrollY||document.documentElement.scrollTop||0));
    data.updatedAt=new Date().toISOString();
    write(data);
  }

  function restoreScroll(){
    if(document.body?.classList.contains('auth-signed-out'))return;
    const data=read();
    const section=activeSectionId();
    const y=Number(data.scrollPositions?.[section]);
    if(!Number.isFinite(y)||y<0)return;

    // Bulut verileri/render işlemleri sayfa yüksekliğini sonradan değiştirebildiği için
    // birkaç kez aynı noktayı teyit ediyoruz.
    [0,120,350,750].forEach(delay=>{
      setTimeout(()=>{
        if(activeSectionId()!==section)return;
        window.scrollTo({top:y,left:0,behavior:'auto'});
      },delay);
    });
  }

  window.addEventListener('scroll',()=>{
    clearTimeout(scrollTimer);
    scrollTimer=setTimeout(saveScroll,120);
  },{passive:true});

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'){
      hiddenAt=Date.now();
      clearTimeout(scrollTimer);
      saveScroll();
    }else if(document.visibilityState==='visible'){
      // Gerçek bir uygulama/sekme dönüşünde geri yükle.
      if(hiddenAt)restoreScroll();
    }
  });

  window.addEventListener('pagehide',saveScroll);
  window.addEventListener('pageshow',()=>setTimeout(restoreScroll,80));

  // Android uygulamayı bellekten atıp yeniden oluşturduğunda auth tamamlandıktan sonra
  // eski sekme + kaydırma konumuna dön.
  const observer=new MutationObserver(()=>{
    if(document.body?.classList.contains('auth-signed-in')) restoreScroll();
  });
  if(document.body) observer.observe(document.body,{attributes:true,attributeFilter:['class']});

  // activateSection çağrılarından sonra hedef sekmenin kendi eski konumunu uygula.
  document.addEventListener('click',e=>{
    const navBtn=e.target?.closest?.('nav button[data-section]');
    if(!navBtn)return;
    saveScroll();
    setTimeout(restoreScroll,80);
  },true);
})();
