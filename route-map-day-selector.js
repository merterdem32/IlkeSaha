// İlke Saha - Rut Planı / Rut Planı2 harita üstü gün seçici
// Harita seçicileri ana hafta/gün kontrollerini aynalar; ayrı rota state'i oluşturmaz.
(()=>{
  const DAYS1=['PAZARTESİ','SALI','ÇARŞAMBA','PERŞEMBE','CUMA','CUMARTESİ'];
  const DAYS2=['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  let timer=null;

  function ensureStyles(){
    if(document.getElementById('routeMapDaySelectorStyles'))return;
    const s=document.createElement('style');
    s.id='routeMapDaySelectorStyles';
    s.textContent=`
      .route-map-topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:10px}
      .route-map-status{min-width:0;flex:1 1 420px}
      .route-map-day-picker{display:flex;align-items:center;gap:8px;flex:0 0 auto;flex-wrap:wrap}
      .route-map-day-picker .route-map-picker-label{font-weight:800;color:#334155;margin-right:2px;white-space:nowrap}
      .route-map-day-picker select{width:auto;min-width:118px;max-width:160px;margin:0;padding:7px 30px 7px 9px;font-size:13px}
      @media(max-width:720px){.route-map-topbar{display:block}.route-map-day-picker{margin-top:8px}.route-map-day-picker select{flex:1 1 125px;max-width:none}}
    `;
    document.head.appendChild(s);
  }

  function emitChange(el){
    if(!el)return;
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function decorate(infoId,kind){
    const info=document.getElementById(infoId);if(!info)return false;
    const wrapId=kind==='r1'?'routeMapTopbar':'route2MapTopbar';
    let top=document.getElementById(wrapId);
    if(!top){
      top=document.createElement('div');top.id=wrapId;top.className='route-map-topbar';
      const status=document.createElement('div');status.className='route-map-status';status.id=infoId+'Status';
      while(info.firstChild)status.appendChild(info.firstChild);
      const picker=document.createElement('div');picker.className='route-map-day-picker';
      picker.innerHTML='<span class="route-map-picker-label">Haritada gün:</span>'+
        '<select id="'+(kind==='r1'?'routeMapWeekPicker':'route2MapWeekPicker')+'"></select>'+
        '<select id="'+(kind==='r1'?'routeMapDayPicker':'route2MapDayPicker')+'"></select>';
      top.append(status,picker);info.appendChild(top);
    }
    bind(kind);
    return true;
  }

  function mainEls(kind){
    return kind==='r1'
      ? {week:document.getElementById('planWeek'),day:document.getElementById('planDay')}
      : {week:document.getElementById('route2Week'),day:document.getElementById('route2Day')};
  }
  function pickerEls(kind){
    return kind==='r1'
      ? {week:document.getElementById('routeMapWeekPicker'),day:document.getElementById('routeMapDayPicker')}
      : {week:document.getElementById('route2MapWeekPicker'),day:document.getElementById('route2MapDayPicker')};
  }

  function fill(kind){
    const p=pickerEls(kind);if(!p.week||!p.day)return;
    if(!p.week.options.length){
      if(kind==='r1')p.week.innerHTML='<option value="1. HAFTA">1. Hafta</option><option value="2. HAFTA">2. Hafta</option>';
      else p.week.innerHTML='<option value="1">1. Hafta</option><option value="2">2. Hafta</option>';
    }
    if(!p.day.options.length){
      const days=kind==='r1'?DAYS1:DAYS2;
      p.day.innerHTML=days.map(d=>'<option value="'+d+'">'+(kind==='r1'?(d.charAt(0)+d.slice(1).toLocaleLowerCase('tr-TR')):d)+'</option>').join('');
    }
  }

  function sync(kind){
    fill(kind);const m=mainEls(kind),p=pickerEls(kind);if(!m.week||!m.day||!p.week||!p.day)return;
    if(p.week.value!==m.week.value)p.week.value=m.week.value;
    if(p.day.value!==m.day.value)p.day.value=m.day.value;
  }

  function bind(kind){
    fill(kind);const m=mainEls(kind),p=pickerEls(kind);if(!m.week||!m.day||!p.week||!p.day)return;
    if(!p.week.dataset.bound){
      p.week.dataset.bound='1';
      p.week.addEventListener('change',()=>{
        if(m.week.value!==p.week.value)m.week.value=p.week.value;
        emitChange(m.week);
        setTimeout(()=>sync(kind),30);
      });
    }
    if(!p.day.dataset.bound){
      p.day.dataset.bound='1';
      p.day.addEventListener('change',()=>{
        if(m.day.value!==p.day.value)m.day.value=p.day.value;
        emitChange(m.day);
        setTimeout(()=>sync(kind),30);
      });
    }
    if(!m.week.dataset.mapMirrorBound){m.week.dataset.mapMirrorBound='1';m.week.addEventListener('change',()=>setTimeout(()=>sync(kind),0));}
    if(!m.day.dataset.mapMirrorBound){m.day.dataset.mapMirrorBound='1';m.day.addEventListener('change',()=>setTimeout(()=>sync(kind),0));}
    sync(kind);
  }

  function repair(){
    ensureStyles();
    decorate('routeMapInfo','r1');
    decorate('route2MapInfo','r2');
  }

  function start(){
    clearInterval(timer);let n=0;
    timer=setInterval(()=>{n++;repair();if(n>300){clearInterval(timer);timer=null;}},200);
  }
  document.addEventListener('click',e=>{
    const b=e.target?.closest?.('nav button[data-section]');
    if(b?.dataset.section==='route'||b?.dataset.section==='route2')setTimeout(repair,120);
  },true);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(repair,100);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();