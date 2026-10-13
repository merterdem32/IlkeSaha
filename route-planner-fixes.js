// İlke Saha - Rut Planlayıcı UX düzeltmeleri
// 1) Bayi Seçerek modunda bayi listesini daima görünür tutar.
// 2) Bölge seçildiği anda o bölgenin bayilerini gün kartında önizler.
(()=>{
  const norm=v=>String(v||'').trim().toLocaleUpperCase('tr-TR');
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  let dealerMirror=new Set();
  let lastStaff='';

  function ready(){return typeof cloudUser!=='undefined'&&cloudUser&&typeof state!=='undefined'&&state;}
  function staffId(){return document.getElementById('routePlannerStaff')?.value||cloudUser?.id||'';}
  function dealers(){const uid=staffId();return (state.dealers||[]).filter(d=>d.isActive!==false&&d.assignedUserId===uid);}
  function cityOf(d){return typeof inferDealerCity==='function'?inferDealerCity(d):'BELİRSİZ';}

  function ensureStyle(){
    if(document.getElementById('routePlannerFixStyles'))return;
    const s=document.createElement('style');s.id='routePlannerFixStyles';s.textContent=`
      #routePlannerDealerMode #routePlannerDealerList{display:block!important;max-height:520px!important;min-height:120px;overflow:auto!important;border:1px solid var(--brand-border)!important;border-radius:12px;background:#fff}
      #routePlannerDealerMode .rp-dealer-row{display:grid!important}
      .rp-region-preview{margin-top:8px;border-top:1px dashed #dfe3e8;padding-top:8px}
      .rp-region-preview-title{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:5px}
      .rp-region-preview-list{display:flex;flex-direction:column;gap:4px}
      .rp-region-preview-item{display:grid;grid-template-columns:24px minmax(0,1fr);gap:7px;align-items:center;padding:5px 0}
      .rp-region-preview-num{width:22px;height:22px;border-radius:50%;background:#eef2f7;display:grid;place-items:center;font-size:11px;font-weight:800}
      .rp-region-preview-empty{font-size:12px;color:#6b7280;padding:4px 0}
    `;document.head.appendChild(s);
  }

  function syncMirrorFromBase(){
    const uid=staffId();
    if(uid!==lastStaff){lastStaff=uid;dealerMirror=new Set();}
    const checks=[...document.querySelectorAll('#routePlannerDealerList input[type="checkbox"]')];
    if(checks.length){
      dealerMirror=new Set(checks.filter(x=>x.checked).map(x=>x.closest('label')?.querySelector('strong')?.textContent?.trim()).filter(Boolean).map(name=>dealers().find(d=>d.name===name)?.id).filter(Boolean));
      return;
    }
    if(!dealerMirror.size)dealers().forEach(d=>dealerMirror.add(d.id));
  }

  function renderDealerListFixed(){
    const list=document.getElementById('routePlannerDealerList'),sum=document.getElementById('routePlannerSelectionSummary');
    if(!list||!ready())return;
    const all=dealers();
    const q=String(document.getElementById('routePlannerSearch')?.value||'').toLocaleLowerCase('tr-TR');
    const rows=all.filter(d=>!q||[d.name,d.district,d.address].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR').includes(q));
    if(sum)sum.innerHTML='<strong>'+dealerMirror.size+' / '+all.length+' bayi seçili</strong>';
    list.innerHTML=rows.length?rows.map(d=>'<label class="rp-dealer-row"><input type="checkbox" '+(dealerMirror.has(d.id)?'checked':'')+' onchange="routePlannerFixToggle(\''+d.id+'\',this.checked)"><div><strong>'+esc(d.name)+'</strong><div class="muted">'+esc(d.district||'')+(d.address?' • '+esc(d.address):'')+'</div></div><span class="badge '+((d.lat!=null&&d.lng!=null)?'b-ok':'b-info')+'">'+((d.lat!=null&&d.lng!=null)?'Konum var':'Konum yok')+'</span></label>').join(''):'<div class="muted" style="padding:12px">Bayi bulunamadı.</div>';
  }

  function toggleDealer(id,on){
    if(on)dealerMirror.add(id);else dealerMirror.delete(id);
    if(typeof window.routePlannerToggleDealer==='function')window.routePlannerToggleDealer(id,on);
    renderDealerListFixed();
  }

  function bindDealerMode(){
    const search=document.getElementById('routePlannerSearch');
    if(search&&!search.dataset.fixBound){
      search.dataset.fixBound='1';
      search.addEventListener('input',()=>setTimeout(renderDealerListFixed,0));
    }
    const staff=document.getElementById('routePlannerStaff');
    if(staff&&!staff.dataset.fixDealerBound){
      staff.dataset.fixDealerBound='1';
      staff.addEventListener('change',()=>{
        lastStaff=staffId();dealerMirror=new Set();
        // Ana planlayıcı personel değişiminde seçimi temizliyor; görünür listeyi de aynı davranışla aç.
        setTimeout(renderDealerListFixed,50);
      });
    }
    const dealerTab=document.getElementById('rpModeDealer');
    if(dealerTab&&!dealerTab.dataset.fixBound){dealerTab.dataset.fixBound='1';dealerTab.addEventListener('click',()=>setTimeout(()=>{syncMirrorFromBase();renderDealerListFixed();},30));}
  }

  function selectedRegionsForDay(dayIndex){
    const card=document.querySelectorAll('#routePlannerRegionDays .rp-region-day')[dayIndex];
    if(!card)return [];
    return [...card.querySelectorAll('.rp-region-chip')].map(chip=>{
      const text=(chip.childNodes[0]?.textContent||chip.textContent||'').replace('×','').trim();
      if(text.startsWith('İlçe:'))return {type:'DISTRICT',value:text.replace(/^İlçe:\s*/,'').trim()};
      if(text.startsWith('İl:'))return {type:'CITY',value:text.replace(/^İl:\s*/,'').trim()};
      return null;
    }).filter(Boolean);
  }

  function matches(d,r){return r.type==='CITY'?norm(cityOf(d))===norm(r.value):norm(d.district)===norm(r.value);}
  function previewDay(dayIndex){
    const cards=[...document.querySelectorAll('#routePlannerRegionDays .rp-region-day')],card=cards[dayIndex];if(!card)return;
    card.querySelector('.rp-region-preview')?.remove();
    const regs=selectedRegionsForDay(dayIndex);
    if(!regs.length)return;
    const ds=dealers().filter(d=>regs.some(r=>matches(d,r)));
    const wrap=document.createElement('div');wrap.className='rp-region-preview';
    wrap.innerHTML='<div class="rp-region-preview-title"><strong>Bu güne gelecek bayiler</strong><span class="badge b-info">'+ds.length+' bayi</span></div>'+
      (ds.length?'<div class="rp-region-preview-list">'+ds.map((d,i)=>'<div class="rp-region-preview-item"><span class="rp-region-preview-num">'+(i+1)+'</span><div><strong>'+esc(d.name)+'</strong><div class="muted">'+esc(d.district||'')+(d.address?' • '+esc(d.address):'')+'</div></div></div>').join('')+'</div>':'<div class="rp-region-preview-empty">Seçilen bölgelerde bu personele ait bayi bulunamadı.</div>');
    card.appendChild(wrap);
  }
  function previewAllDays(){[...document.querySelectorAll('#routePlannerRegionDays .rp-region-day')].forEach((_,i)=>previewDay(i));}

  function patchRegionFunctions(){
    if(typeof window.addRoutePlannerRegion==='function'&&!window.addRoutePlannerRegion._fixWrapped){
      const old=window.addRoutePlannerRegion;
      const fn=function(i){old(i);setTimeout(()=>previewDay(i),30)};fn._fixWrapped=true;window.addRoutePlannerRegion=fn;
    }
    if(typeof window.removeRoutePlannerRegion==='function'&&!window.removeRoutePlannerRegion._fixWrapped){
      const old=window.removeRoutePlannerRegion;
      const fn=function(i,r){old(i,r);setTimeout(()=>previewDay(i),30)};fn._fixWrapped=true;window.removeRoutePlannerRegion=fn;
    }
  }

  function install(){
    if(!ready()||!document.getElementById('routePlanner'))return false;
    ensureStyle();bindDealerMode();patchRegionFunctions();
    const dealerMode=document.getElementById('routePlannerDealerMode');
    if(dealerMode&&dealerMode.style.display!=='none'){
      syncMirrorFromBase();renderDealerListFixed();
    }
    previewAllDays();
    return true;
  }

  window.routePlannerFixToggle=toggleDealer;
  const t=setInterval(()=>{if(install())clearInterval(t)},180);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(install,120)});
  setTimeout(install,0);
})();
