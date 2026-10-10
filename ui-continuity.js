// İlke Saha - güvenli UI sürekliliği
// Amaç: Uygulamadan çıkıp geri gelindiğinde scroll sıfırlandıysa geri yükle.
// Kullanıcı uygulama içindeyken kaydırıyorsa asla scroll ile mücadele etme.
(() => {
  const KEY='ilkeSahaScrollStateV3';
  let saveTimer=null;
  let restoreToken=0;
  let coldRestoreDone=false;

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
  function navScroller(){ return document.querySelector('nav'); }
  function pageY(){ return Math.max(0,window.scrollY||document.scrollingElement?.scrollTop||0); }
  function mainY(){ return Math.max(0,mainScroller()?.scrollTop||0); }

  function saveNow(){
    if(document.body?.classList.contains('auth-pending'))return;
    const section=activeSection();
    const all=read();
    const uid=userKey();
    all[uid]=all[uid]||{};
    all[uid][section]={
      pageY:pageY(),
      mainY:mainY(),
      navX:Math.max(0,navScroller()?.scrollLeft||0),
      savedAt:Date.now()
    };
    write(all);
  }

  function scheduleSave(){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(saveNow,100);
  }

  function savedFor(section){
    return read()?.[userKey()]?.[section]||null;
  }

  function cancelRestore(){
    restoreToken++;
  }

  function restoreIfNeeded({cold=false}={}){
    if(document.body?.classList.contains('auth-pending'))return;
    if(document.body?.classList.contains('auth-signed-out'))return;

    const section=activeSection();
    const pos=savedFor(section);
    if(!pos)return;

    const savedPage=Number(pos.pageY)||0;
    const savedMain=Number(pos.mainY)||0;
    const savedNav=Number(pos.navX)||0;
    const meaningfulSaved=Math.max(savedPage,savedMain)>100;
    if(!meaningfulSaved)return;

    const currentPage=pageY();
    const currentMain=mainY();

    // Uygulamaya normal dönüşte tarayıcı konumu koruduysa hiçbir şey yapma.
    // Böylece kullanıcı yukarı/aşağı kaydırırken uygulama eski noktaya geri çekmez.
    if(!cold && (currentPage>20||currentMain>20))return;

    const token=++restoreToken;
    [70,180,400].forEach((delay,index)=>setTimeout(()=>{
      if(token!==restoreToken)return;
      if(document.visibilityState==='hidden')return;
      if(activeSection()!==section)return;

      // İlk denemeden sonra kullanıcı veya tarayıcı hareket etmişse bırak.
      if(index>0 && (pageY()>40||mainY()>40))return;

      const main=mainScroller();
      const nav=navScroller();
      if(main&&savedMain>0)main.scrollTop=savedMain;
      if(nav&&savedNav>0)nav.scrollLeft=savedNav;
      if(savedPage>0)window.scrollTo(0,savedPage);
    },delay));
  }

  function installListeners(){
    window.addEventListener('scroll',scheduleSave,{passive:true});
    mainScroller()?.addEventListener('scroll',scheduleSave,{passive:true});
    navScroller()?.addEventListener('scroll',scheduleSave,{passive:true});

    // Gerçek kullanıcı etkileşimi tüm bekleyen otomatik scroll işlemlerini iptal eder.
    ['touchstart','pointerdown','wheel','keydown'].forEach(type=>{
      window.addEventListener(type,cancelRestore,{passive:true,capture:true});
    });

    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='hidden'){
        cancelRestore();
        clearTimeout(saveTimer);
        saveNow();
      }else{
        // Sadece uygulamadan geri dönüşte ve konum gerçekten sıfırlanmışsa düzelt.
        setTimeout(()=>restoreIfNeeded({cold:false}),90);
      }
    });

    window.addEventListener('pagehide',()=>{
      cancelRestore();
      saveNow();
    });

    // Gerçek soğuk açılışta auth + render tamamlandıktan sonra yalnızca bir kez dene.
    const observer=new MutationObserver(()=>{
      if(!coldRestoreDone&&document.body?.classList.contains('auth-signed-in')){
        coldRestoreDone=true;
        setTimeout(()=>restoreIfNeeded({cold:true}),160);
      }
    });
    if(document.body)observer.observe(document.body,{attributes:true,attributeFilter:['class']});
  }

  function init(){
    document.getElementById('authLoading')?.remove();
    installListeners();

    // Sayfa zaten imzalı durumda açıldıysa observer tetiklenmeyebilir.
    if(document.body?.classList.contains('auth-signed-in')){
      coldRestoreDone=true;
      setTimeout(()=>restoreIfNeeded({cold:true}),160);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
