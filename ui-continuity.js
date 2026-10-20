// İlke Saha - UI sürekliliği v5
// Amaç: uygulamadan çıkıp geri dönüldüğünde aynı sekme + aynı scroll noktasına dönmek.
// Kullanıcının aktif kaydırmasına asla müdahale etmez; arka plandan dönüşte tek seferlik restore yapar.
(()=>{
  const KEY='ilkeSahaScrollStateV5';
  const OLD_KEYS=['ilkeSahaScrollStateV4','ilkeSahaScrollStateV3'];
  let saveRaf=0;
  let restoreToken=0;
  let userInteracted=false;
  let lastSnapshot=null;
  let hiddenSnapshot=null;
  let wasHidden=false;

  try{if('scrollRestoration' in history)history.scrollRestoration='manual';}catch(_){ }

  function readKey(k){try{return JSON.parse(localStorage.getItem(k)||'{}')||{};}catch(_){return {};}}
  function read(){
    const cur=readKey(KEY);if(Object.keys(cur).length)return cur;
    for(const k of OLD_KEYS){const v=readKey(k);if(Object.keys(v).length)return v;}
    return {};
  }
  function write(v){try{localStorage.setItem(KEY,JSON.stringify(v));}catch(_){}}
  function uid(){try{return cloudUser?.id||'default';}catch(_){return 'default';}}
  function section(){return document.querySelector('.section.active')?.id||'dashboard';}
  function main(){return document.querySelector('main');}
  function nav(){return document.querySelector('nav');}
  function pageY(){return Math.max(0,window.scrollY||document.scrollingElement?.scrollTop||0);}
  function mainY(){return Math.max(0,main()?.scrollTop||0);}
  function navX(){return Math.max(0,nav()?.scrollLeft||0);}

  function anchorSnapshot(){
    try{
      const x=Math.min(window.innerWidth-8,Math.max(8,window.innerWidth/2));
      const y=Math.min(window.innerHeight-8,Math.max(8,110));
      let el=document.elementFromPoint(x,y);
      el=el?.closest?.('[data-route2-source],.route-stop,.item,[id]');
      if(!el)return null;
      let selector='';
      if(el.id)selector='#'+CSS.escape(el.id);
      else if(el.dataset?.route2Source)selector='[data-route2-source="'+CSS.escape(el.dataset.route2Source)+'"]';
      if(!selector)return null;
      return {selector,offset:el.getBoundingClientRect().top};
    }catch(_){return null;}
  }

  function snapshot(){
    return {section:section(),pageY:pageY(),mainY:mainY(),navX:navX(),anchor:anchorSnapshot(),savedAt:Date.now()};
  }
  function persistSnapshot(s){
    if(!s||document.body?.classList.contains('auth-pending'))return;
    const all=read();all[uid()]=s;write(all);
  }
  function commitSnapshot(){
    const s=snapshot();
    lastSnapshot=s;
    persistSnapshot(s);
  }
  function scheduleSave(){
    if(saveRaf)return;
    saveRaf=requestAnimationFrame(()=>{saveRaf=0;commitSnapshot();});
  }
  function stored(){return read()?.[uid()]||null;}
  function cancelRestore(){restoreToken++;userInteracted=true;}
  function maxScrollablePage(){const e=document.scrollingElement;return Math.max(0,(e?.scrollHeight||0)-(window.innerHeight||0));}
  function maxScrollableMain(){const e=main();return Math.max(0,(e?.scrollHeight||0)-(e?.clientHeight||0));}

  function restoreSection(target){
    if(!target||target===section())return;
    const el=document.getElementById(target);if(!el)return;
    try{
      if(typeof window.activateSection==='function')window.activateSection(target);
      else{
        document.querySelectorAll('.section').forEach(x=>x.classList.toggle('active',x.id===target));
        document.querySelectorAll('nav button[data-section]').forEach(b=>b.classList.toggle('active',b.dataset.section===target));
      }
    }catch(_){ }
  }

  function restoreAnchor(a){
    if(!a?.selector)return false;
    try{
      const el=document.querySelector(a.selector);if(!el)return false;
      const delta=el.getBoundingClientRect().top-Number(a.offset||0);
      if(Math.abs(delta)>2)window.scrollBy({top:delta,left:0,behavior:'auto'});
      return true;
    }catch(_){return false;}
  }

  function restoreFrom(s,{restoreTab=true,force=false}={}){
    if(!s||document.visibilityState==='hidden')return;
    const targetPage=Number(s.pageY)||0,targetMain=Number(s.mainY)||0,targetNav=Number(s.navX)||0;
    if(!force&&Math.max(targetPage,targetMain)<50&&targetNav<20&&!s.anchor)return;

    userInteracted=false;
    const token=++restoreToken;
    if(restoreTab)restoreSection(s.section);
    const started=performance.now();

    function attempt(){
      if(token!==restoreToken||userInteracted||document.visibilityState==='hidden')return;
      if(restoreTab&&s.section&&section()!==s.section){
        if(performance.now()-started<1200)return requestAnimationFrame(attempt);
        return;
      }
      const pageReady=targetPage<=20||maxScrollablePage()+32>=targetPage;
      const mainReady=targetMain<=20||maxScrollableMain()+32>=targetMain;
      if((!pageReady||!mainReady)&&performance.now()-started<1200)return requestAnimationFrame(attempt);

      const m=main(),n=nav();
      if(targetMain>0&&m)m.scrollTop=Math.min(targetMain,maxScrollableMain());
      if(targetPage>0)window.scrollTo({top:Math.min(targetPage,maxScrollablePage()),left:0,behavior:'auto'});
      if(targetNav>0&&n)n.scrollLeft=targetNav;

      // Dinamik liste yüksekliği değişmişse piksel yerine görünür elemanı referans alarak son düzeltmeyi yap.
      requestAnimationFrame(()=>{
        if(token!==restoreToken||userInteracted)return;
        restoreAnchor(s.anchor);
        lastSnapshot={...s,pageY:pageY(),mainY:mainY(),navX:navX(),savedAt:Date.now()};
        persistSnapshot(lastSnapshot);
        try{window.dispatchEvent(new CustomEvent('ilke:ui-restored'));}catch(_){ }
      });
    }
    requestAnimationFrame(()=>requestAnimationFrame(attempt));
  }

  function captureBeforeBackground(){
    // blur/freeze çoğu Android cihazda visibilitychange'den önce gelir; gerçek konumu burada yakala.
    if(document.visibilityState==='visible')commitSnapshot();
  }

  function onHidden(){
    wasHidden=true;
    restoreToken++;
    if(saveRaf){cancelAnimationFrame(saveRaf);saveRaf=0;}
    // visibility hidden anında WebView scroll'u 0 yaptıysa son gerçek snapshot'ı koru.
    const live=snapshot();
    const liveLooksReset=Math.max(live.pageY,live.mainY)<20&&lastSnapshot&&Math.max(lastSnapshot.pageY,lastSnapshot.mainY)>80;
    hiddenSnapshot={...(liveLooksReset?lastSnapshot:live),section:section(),savedAt:Date.now()};
    lastSnapshot=hiddenSnapshot;
    persistSnapshot(hiddenSnapshot);
  }

  function onVisible(){
    if(!wasHidden)return;
    wasHidden=false;
    const s=hiddenSnapshot||lastSnapshot||stored();
    if(!s)return;
    // Android WebView önce görünür olup, birkaç frame sonra scroll/layout'u sıfırlayabiliyor.
    // Bu yüzden tek restore işlemini biraz gecikmeli başlatıyoruz; restore kendi içinde yalnızca bir kez scroll uygular.
    setTimeout(()=>restoreFrom(s,{restoreTab:true,force:true}),180);
  }

  function init(){
    document.getElementById('authLoading')?.remove();
    const prior=stored();if(prior)lastSnapshot=prior;

    window.addEventListener('scroll',scheduleSave,{passive:true});
    main()?.addEventListener('scroll',scheduleSave,{passive:true});
    nav()?.addEventListener('scroll',scheduleSave,{passive:true});

    ['touchstart','pointerdown','wheel','keydown'].forEach(type=>window.addEventListener(type,cancelRestore,{passive:true,capture:true}));
    document.addEventListener('click',e=>{
      if(e.target?.closest?.('nav button[data-section]'))setTimeout(()=>{userInteracted=false;commitSnapshot();},40);
    },true);

    // Android/PWA yaşam döngüsünü mümkün olduğunca erken yakala.
    window.addEventListener('blur',captureBeforeBackground,{passive:true});
    document.addEventListener('freeze',captureBeforeBackground);
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='hidden')onHidden();else onVisible();
    });
    window.addEventListener('pagehide',onHidden);
    window.addEventListener('pageshow',e=>{if(e.persisted){wasHidden=true;onVisible();}});

    // Soğuk açılış / Android WebView öldürülüp yeniden yaratılırsa son sekme ve konumu geri getir.
    let coldRestored=false;
    const coldRestore=()=>{
      if(coldRestored||!document.body?.classList.contains('auth-signed-in'))return;
      const s=stored();if(!s)return;
      coldRestored=true;setTimeout(()=>restoreFrom(s,{restoreTab:true,force:true}),220);
    };
    const observer=new MutationObserver(coldRestore);
    if(document.body)observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    coldRestore();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
