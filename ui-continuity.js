// İlke Saha - UI sürekliliği
// Uygulamadan çıkıp geri gelindiğinde aktif sekmeyi ve gerçek scroll konumunu korur.
(() => {
  const KEY='ilkeSahaScrollStateV2';
  let restoring=false;
  let saveTimer=null;
  let restoreRun=0;

  function read(){
    try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){return {};}
  }

  function write(value){
    try{localStorage.setItem(KEY,JSON.stringify(value));}catch(_){}
  }

  function userKey(){
    try{return (typeof cloudUser!=='undefined'&&cloudUser?.id)?cloudUser.id:'default';}catch(_){return 'default';}
  }

  function activeSection(){
    return document.querySelector('.section.active')?.id||
      (typeof readUiState==='function'?readUiState().section:null)||'dashboard';
  }

  function mainScroller(){ return document.querySelector('main'); }
  function pageScroller(){ return document.scrollingElement||document.documentElement; }
  function navScroller(){ return document.querySelector('nav'); }

  function saveNow(){
    if(restoring)return;
    if(document.body?.classList.contains('auth-pending'))return;
    const section=activeSection();
    const all=read();
    const uid=userKey();
    all[uid]=all[uid]||{};
    all[uid][section]={
      pageY:Math.max(0,window.scrollY||pageScroller()?.scrollTop||0),
      mainY:Math.max(0,mainScroller()?.scrollTop||0),
      navX:Math.max(0,navScroller()?.scrollLeft||0),
      savedAt:Date.now()
    };
    write(all);
  }

  function scheduleSave(){
    if(restoring)return;
    clearTimeout(saveTimer);
    saveTimer=setTimeout(saveNow,80);
  }

  function savedFor(section){
    const all=read();
    return all?.[userKey()]?.[section]||null;
  }

  function applyPosition(section,pos){
    if(!pos||activeSection()!==section)return false;
    const main=mainScroller();
    const nav=navScroller();
    if(main && Number.isFinite(Number(pos.mainY))) main.scrollTop=Number(pos.mainY)||0;
    if(nav && Number.isFinite(Number(pos.navX))) nav.scrollLeft=Number(pos.navX)||0;
    if(Number.isFinite(Number(pos.pageY))) window.scrollTo(0,Number(pos.pageY)||0);
    return true;
  }

  function restoreSection(section,force=false){
    const pos=savedFor(section);
    if(!pos)return;

    // Aynı oturumda tarayıcı konumu zaten koruduysa gereksiz zıplama yapma.
    const currentPage=window.scrollY||pageScroller()?.scrollTop||0;
    const currentMain=mainScroller()?.scrollTop||0;
    if(!force && (currentPage>8 || currentMain>8))return;

    const run=++restoreRun;
    restoring=true;
    const delays=[0,40,120,260,500,900,1400,2200];
    delays.forEach((delay,index)=>setTimeout(()=>{
      if(run!==restoreRun)return;
      applyPosition(section,pos);
      if(index===delays.length-1){
        setTimeout(()=>{ if(run===restoreRun) restoring=false; },80);
      }
    },delay));
  }

  function restoreWhenReady(force=false){
    if(document.body?.classList.contains('auth-pending'))return;
    if(document.body?.classList.contains('auth-signed-out'))return;
    const section=activeSection();
    restoreSection(section,force);
  }

  // Sekme değiştirirken eski sekmenin konumunu kaydet, yeni sekmenin eski konumunu geri yükle.
  function installSectionWrapper(){
    if(typeof window.activateSection!=='function'||window.activateSection.__scrollWrapped)return;
    const original=window.activateSection;
    const wrapped=function(sectionId){
      saveNow();
      const result=original.apply(this,arguments);
      setTimeout(()=>restoreSection(sectionId,true),25);
      return result;
    };
    wrapped.__scrollWrapped=true;
    window.activateSection=wrapped;
  }

  function installListeners(){
    window.addEventListener('scroll',scheduleSave,{passive:true});
    const main=mainScroller();
    const nav=navScroller();
    if(main)main.addEventListener('scroll',scheduleSave,{passive:true});
    if(nav)nav.addEventListener('scroll',scheduleSave,{passive:true});

    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='hidden') saveNow();
      else setTimeout(()=>restoreWhenReady(false),80);
    });
    window.addEventListener('pagehide',saveNow);
    window.addEventListener('beforeunload',saveNow);
    window.addEventListener('pageshow',()=>setTimeout(()=>restoreWhenReady(false),60));

    // Auth tamamlandığında cloud load/render sonrası restore et.
    const observer=new MutationObserver(()=>{
      if(document.body?.classList.contains('auth-signed-in')){
        installSectionWrapper();
        setTimeout(()=>restoreWhenReady(true),50);
      }
    });
    if(document.body)observer.observe(document.body,{attributes:true,attributeFilter:['class']});
  }

  function init(){
    // Eski tam ekran bekleme kartını artık göstermiyoruz.
    document.getElementById('authLoading')?.remove();
    installSectionWrapper();
    installListeners();
    setTimeout(()=>restoreWhenReady(true),80);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
