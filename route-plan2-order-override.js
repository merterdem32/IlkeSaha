// İlke Saha - Rut Planı2 güncel sıralama
// 11.10.2026 tarihinde yüklenen Saha1_2_Haftalik_Rut_Plani_Guncel (5).xlsx sırasını kullanır.
(() => {
  const PLAN_VERSION='20261011-5';
  try{
    if(localStorage.getItem('ilkeSahaRoute2PlanVersion')!==PLAN_VERSION){
      // Önceki Excel sırasından kalan günlük/optimize taslak yeni planın üstüne binmesin.
      localStorage.removeItem('ilkeSahaRoute2DraftsV2');
      localStorage.setItem('ilkeSahaRoute2PlanVersion',PLAN_VERSION);
    }
  }catch(_){ }

  const DAYS=['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  const PLAN={
    '1|Pazartesi':{date:'2026-10-12',ids:[63,61,91,82,143,68,56,54,136,36,141,10]},
    '1|Salı':{date:'2026-10-13',ids:[32,142,11,21,98,146,60,118,132,35,134,53,15]},
    '1|Çarşamba':{date:'2026-10-14',ids:[113,4,6,129,80,101,77,107,1,71]},
    '1|Perşembe':{date:'2026-10-15',ids:[81,74,144,8,140,114,43,27,45,152,49,12,108,24,109,75,9,139]},
    '1|Cuma':{date:'2026-10-16',ids:[42,116,30,52,117,55,95,97,20,115,88,83,90,93,100,59]},
    '1|Cumartesi':{date:'2026-10-17',ids:[73,79,16,44,14,133,125]},
    '2|Pazartesi':{date:'2026-10-19',ids:[7,138,47,145,96,17]},
    '2|Salı':{date:'2026-10-20',ids:[57,76,28,112,123,135,40,22,104]},
    '2|Çarşamba':{date:'2026-10-21',ids:[46,3,50,103,151,131,120,111,86,58,37,66,105]},
    '2|Perşembe':{date:'2026-10-22',ids:[23,33,26,19,137,13,94,89,34,48,99,124]},
    '2|Cuma':{date:'2026-10-23',ids:[64,78,110,130,65,128,106,87,147]},
    '2|Cumartesi':{date:'2026-10-24',ids:[41,18,72,148,25,5,92]}
  };

  const esc2=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function dealerBySource(n){
    if(typeof state==='undefined'||!Array.isArray(state.dealers))return null;
    const id='imported-'+String(n).padStart(3,'0');
    return state.dealers.find(d=>d.id===id)||null;
  }

  function renderLatestRoute2(){
    const week=Number(document.getElementById('route2Week')?.value||1);
    const day=document.getElementById('route2Day')?.value||'Pazartesi';
    const p=PLAN[week+'|'+day];
    const list=document.getElementById('route2List');
    const sum=document.getElementById('route2Summary');
    if(!p||!list||!sum)return;

    try{
      localStorage.setItem('ilkeSahaRoute2SelectionV1',JSON.stringify({week,day}));
    }catch(_){ }

    const dealers=p.ids.map(n=>({n,d:dealerBySource(n)}));
    const missing=dealers.filter(x=>!x.d).length;
    const coordMissing=dealers.filter(x=>x.d&&!isValidDealerCoordinate(x.d.lat,x.d.lng)).length;
    const districts=[...new Set(dealers.map(x=>x.d?.district).filter(Boolean))];
    const dateLabel=new Date(p.date+'T12:00:00').toLocaleDateString('tr-TR');

    sum.innerHTML='<strong>'+week+'. Hafta • '+esc2(day)+' • '+dateLabel+'</strong>'+
      '<div class="muted" style="margin-top:5px">'+p.ids.length+' bayi'+
      (coordMissing?' • <span class="badge b-warn">'+coordMissing+' koordinatsız</span>':'')+
      (missing?' • <span class="badge b-bad">'+missing+' eşleşmeyen kayıt</span>':'')+
      '</div><div class="muted" style="margin-top:5px">'+esc2(districts.join(' • '))+'</div>';

    list.innerHTML=dealers.map((x,i)=>{
      const d=x.d;
      const name=d?.name||('Kaynak bayi '+x.n);
      const visited=d&&Array.isArray(state.visits)&&state.visits.some(v=>v.dealerId===d.id&&String(v.date||'').slice(0,10)===p.date);
      return '<div class="item route-stop"><div class="num">'+(i+1)+'</div><div class="route-info"><strong>'+esc2(name)+'</strong>'+ 
        (d?'<span class="muted">'+esc2(d.district||'-')+(d.phone?' • '+esc2(d.phone):'')+'</span>':'<span class="muted">Ana bayi listesinde eşleşme bulunamadı.</span>')+
        (d?.address?'<span class="muted" style="margin-top:3px">'+esc2(d.address)+'</span>':'')+
        '<div style="margin-top:6px">'+(d&&isValidDealerCoordinate(d.lat,d.lng)?'<span class="badge b-ok">Konum var</span>':'<span class="badge b-warn">Koordinat eksik</span>')+(d?.isZCode?' <span class="badge b-zcode">Z KODLU</span>':'')+(visited?' <span class="badge b-ok">Ziyaret edildi</span>':'')+'</div></div>'+ 
        '<div class="toolbar route-actions"><button class="btn btn-ghost" onclick="route2Dealer('+x.n+')">Bayi Aç</button><button class="btn btn-primary" onclick="route2Visit('+x.n+')">Görüşme Notu</button><button class="btn btn-accent" onclick="route2Directions('+x.n+')">Yol Tarifi</button></div></div>';
    }).join('');
  }

  function install(){
    window.renderRoute2=renderLatestRoute2;
    const week=document.getElementById('route2Week');
    const day=document.getElementById('route2Day');
    if(week&&!week.dataset.latestRoute2){
      week.dataset.latestRoute2='1';
      week.addEventListener('change',()=>setTimeout(renderLatestRoute2,0));
    }
    if(day&&!day.dataset.latestRoute2){
      day.dataset.latestRoute2='1';
      day.addEventListener('change',()=>setTimeout(renderLatestRoute2,0));
    }
    const nav=document.getElementById('route2NavBtn');
    if(nav&&!nav.dataset.latestRoute2){
      nav.dataset.latestRoute2='1';
      nav.onclick=()=>{
        if(typeof activateSection==='function')activateSection('route2');
        setTimeout(renderLatestRoute2,0);
      };
    }
    renderLatestRoute2();
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(document.getElementById('route2')){
      clearInterval(timer);
      install();
    }else if(tries>50){clearInterval(timer);}
  },100);
})();
