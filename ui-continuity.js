// İlke Saha - UI sürekliliği v4
// Amaç: uygulamadan çıkıp geri dönüldüğünde aynı sekme + aynı scroll noktasına dönmek.
// Kritik kural: kullanıcı uygulama içindeyken kaydırıyorsa otomatik scroll asla onunla mücadele etmez.
(()=>{
  const KEY='ilkeSahaScrollStateV4';
  let saveTimer=null;
  let restoreToken=0;
  let userInteracted=false;
  let lastSnapshot=null;
  let backgroundSnapshot=null;

  try{if('scrollRestoration' in history)history.scrollRestoration='manual';}catch(_){ }

  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){return {};}}
  function write(v){try{localStorage.setItem(KEY,JSON.stringify(v));}catch(_){}}
  function uid(){try{return cloudUser?.id||'default';}catch(_){return 'default';}}
  function section(){return document.querySelector('.section.active')?.id||'dashboard';}
  function main(){return document.querySelector('main');}
  function nav(){return document.querySelector('nav');}
  function pageY(){return Math.max(0,window.scrollY||document.scrollingElement?.scrollTop||0);}
  function mainY(){return Math.max(0,main()?.scrollTop||0);}
  function navX(){return Math.max(0,nav()?.scrollLeft||0);}

  function snapshot(){
    return {section:section(),pageY:pageY(),mainY:mainY(),navX:navX(),savedAt:Date.now()};
  }

  function persistSnapshot(s){
    if(!s||document.body?.classList.contains('auth-pending'))return;
    const all=read();all[uid()]=s;write(all);
  }

  function saveNow(){
    const s=snapshot();
    // Android bazı cihazlarda uygulama arka plana alınırken DOM scroll'u anlık 0'a çekebiliyor.
    // Daha önce anlamlı bir konumumuz varsa bu sahte 0 değeriyle üzerine yazma.
    if(lastSnapshot&&Math.max(lastSnapshot.pageY,lastSnapshot.mainY)>100&&Math.max(s.pageY,s.mainY)<20&&document.visibilityState==='hidden'){
      persistSnapshot(lastSnapshot);return;
    }
    lastSnapshot=s;persistSnapshot(s);
  }

  function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,70);}
  function stored(){return read()?.[uid()]||null;}
  function cancelRestore(){restoreToken++;userInteracted=true;}

  function maxScrollablePage(){const e=document.scrollingElement;return Math.max(0,(e?.scrollHeight||0)-(window.innerHeight||0));}
  function maxScrollableMain(){const e=main();return Math.max(0,(e?.scrollHeight||0)-(e?.clientHeight||0));}

  function restoreSection(target){
    if(!target||target===section())return;
    const el=document.getElementById(target);
    if(!el)return;
    try{
      if(typeof window.activateSection==='function')window.activateSection(target);
      else{
        document.querySelectorAll('.section').forEach(x=>x.classList.toggle('active',x.id===target));
        document.querySelectorAll('nav button[data-section]').forEach(b=>b.classList.toggle('active',b.dataset.section===target));
      }
    }catch(_){ }
  }

  function restoreFrom(s,{restoreTab=true}={}){
    if(!s||document.visibilityState==='hidden')return;
    const targetPage=Number(s.pageY)||0,targetMain=Number(s.mainY)||0,targetNav=Number(s.navX)||0;
    if(Math.max(targetPage,targetMain)<80&&targetNav<20)return;

    userInteracted=false;
    const token=++restoreToken;
    if(restoreTab)restoreSection(s.section);

    // İçerik/render yüksekliği hazır olana kadar bekle; hazır olduğunda SADECE BİR KEZ scroll uygula.
    const started=performance.now();
    function attempt(){
      if(token!==restoreToken||userInteracted||document.visibilityState==='hidden')return;
      if(restoreTab&&s.section&&section()!==s.section){
        if(performance.now()-started<650)return requestAnimationFrame(attempt);
        return;
      }
      const pageReady=targetPage<=20||maxScrollablePage()+24>=targetPage;
      const mainReady=targetMain<=20||maxScrollableMain()+24>=targetMain;
      if((!pageReady||!mainReady)&&performance.now()-started<650)return requestAnimationFrame(attempt);

      const m=main(),n=nav();
      if(targetMain>0&&m)m.scrollTop=Math.min(targetMain,maxScrollableMain());
      if(targetPage>0)window.scrollTo({top:Math.min(targetPage,maxScrollablePage()),left:0,behavior:'auto'});
      if(targetNav>0&&n)n.scrollLeft=targetNav;

      // Uyguladığımız scroll eventlerinin kaydı bozmasını engellemeden, yeni doğru konumu hafızaya al.
      lastSnapshot={...s,pageY:pageY(),mainY:mainY(),navX:navX(),savedAt:Date.now()};
      persistSnapshot(lastSnapshot);
    }
    requestAnimationFrame(()=>requestAnimationFrame(attempt));
  }

  function onHidden(){
    restoreToken++;
    clearTimeout(saveTimer);
    // Önce son gerçek scroll eventinden kalan snapshot'ı tercih et.
    const live=snapshot();
    const candidate=(lastSnapshot&&Math.max(lastSnapshot.pageY,lastSnapshot.mainY)>=Math.max(live.pageY,live.mainY))?lastSnapshot:live;
    backgroundSnapshot={...candidate,section:section(),savedAt:Date.now()};
    lastSnapshot=backgroundSnapshot;
    persistSnapshot(backgroundSnapshot);
  }

  function onVisible(){
    const s=backgroundSnapshot||lastSnapshot||stored();
    // WebView görünür olduktan sonra layout ilk frame'de hâlâ eski/0 ölçüler verebilir.
    setTimeout(()=>{
      if(!s)return;
      const currentAtTop=pageY()<25&&mainY()<25;
      const tabChanged=!!s.section&&section()!==s.section;
      if(currentAtTop||tabChanged)restoreFrom(s,{restoreTab:true});
      else if((nav()?.scrollLeft||0)<5&&(s.navX||0)>20){nav().scrollLeft=s.navX;}
    },90);
  }

  function init(){
    document.getElementById('authLoading')?.remove();
    const prior=stored();if(prior){lastSnapshot=prior;}

    window.addEventListener('scroll',scheduleSave,{passive:true});
    main()?.addEventListener('scroll',scheduleSave,{passive:true});
    nav()?.addEventListener('scroll',scheduleSave,{passive:true});

    // Kullanıcının gerçek müdahalesi otomatik restore'u anında iptal eder.
    ['touchstart','pointerdown','wheel','keydown'].forEach(type=>window.addEventListener(type,cancelRestore,{passive:true,capture:true}));

    // Sekme tıklaması yeni bilinçli konumdur; hemen kaydet.
    document.addEventListener('click',e=>{
      if(e.target?.closest?.('nav button[data-section]'))setTimeout(()=>{userInteracted=false;saveNow();},40);
    },true);

    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='hidden')onHidden();
      else onVisible();
    });
    window.addEventListener('pagehide',onHidden);
    window.addEventListener('pageshow',e=>{if(e.persisted)onVisible();});

    // Soğuk açılış / Android'in WebView'i öldürüp yeniden yaratması durumunda da son sekme+konumu geri getir.
    const observer=new MutationObserver(()=>{
      if(document.body?.classList.contains('auth-signed-in')){
        const s=stored();if(s)setTimeout(()=>restoreFrom(s,{restoreTab:true}),140);
      }
    });
    if(document.body)observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    if(document.body?.classList.contains('auth-signed-in')&&prior)setTimeout(()=>restoreFrom(prior,{restoreTab:true}),140);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
