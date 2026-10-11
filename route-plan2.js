// İlke Saha - Rut Planı2
// Kaynak: Saha1_2_Haftalik_Rut_Plani_Guncel (6).xlsx
// Bu modül yalnızca Rut Planı2 kaynak listesini yönetir; ana Rut Planı verisine dokunmaz.
(() => {
  const DAYS=['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  const SOURCE_VERSION='2026-10-12-excel-6';
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

  function resetOldRoute2DraftsOnce(){
    try{
      const marker='ilkeSahaRoute2SourceVersion';
      if(localStorage.getItem(marker)===SOURCE_VERSION)return;
      ['ilkeSahaRoute2DraftsV1','ilkeSahaRoute2DraftsV2','ilkeSahaRoute2DraftsV3'].forEach(k=>localStorage.removeItem(k));
      localStorage.setItem(marker,SOURCE_VERSION);
    }catch(_){ }
  }

  function dealerBySource(n){
    if(typeof state==='undefined'||!Array.isArray(state.dealers))return null;
    const id='imported-'+String(n).padStart(3,'0');
    return state.dealers.find(d=>d.id===id)||null;
  }

  function selected(){
    try{return JSON.parse(localStorage.getItem('ilkeSahaRoute2SelectionV1')||'{}')||{};}catch(_){return {};}
  }

  function remember(){
    const week=Number(document.getElementById('route2Week')?.value||1);
    const day=document.getElementById('route2Day')?.value||'Pazartesi';
    try{localStorage.setItem('ilkeSahaRoute2SelectionV1',JSON.stringify({week,day}));}catch(_){ }
  }

  function route2Directions(n){
    const d=dealerBySource(n);
    if(!d){alert('Bayi ana listede bulunamadı. Kaynak sıra: '+n);return;}
    if(typeof openGoogleMapsDirections==='function'){openGoogleMapsDirections(d.id);return;}
    const dest=(typeof isValidDealerCoordinate==='function'&&isValidDealerCoordinate(d.lat,d.lng))?d.lat+','+d.lng:(d.address||'');
    if(!dest){alert('Bu bayi için adres veya koordinat yok.');return;}
    window.open('https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(dest),'_blank','noopener');
  }

  function route2Dealer(n){
    const d=dealerBySource(n);
    if(!d){alert('Bayi ana listede bulunamadı. Kaynak sıra: '+n);return;}
    if(typeof showDealer==='function')showDealer(d.id);
  }

  function route2Visit(n){
    const d=dealerBySource(n);
    if(!d){alert('Bayi ana listede bulunamadı. Kaynak sıra: '+n);return;}
    if(typeof openVisitModal==='function')openVisitModal(d.id);
  }

  function renderRoute2(){
    const week=Number(document.getElementById('route2Week')?.value||1);
    const day=document.getElementById('route2Day')?.value||'Pazartesi';
    const p=PLAN[week+'|'+day];
    remember();

    const list=document.getElementById('route2List');
    const sum=document.getElementById('route2Summary');
    if(!p||!list||!sum)return;

    const dealers=p.ids.map(n=>({n,d:dealerBySource(n)}));
    const missing=dealers.filter(x=>!x.d).length;
    const coordMissing=dealers.filter(x=>x.d&&typeof isValidDealerCoordinate==='function'&&!isValidDealerCoordinate(x.d.lat,x.d.lng)).length;
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
      const hasCoord=d&&typeof isValidDealerCoordinate==='function'&&isValidDealerCoordinate(d.lat,d.lng);
      return '<div class="item route-stop">'+
        '<div class="num">'+(i+1)+'</div>'+
        '<div class="route-info"><strong>'+esc2(name)+'</strong>'+
          (d?'<span class="muted">'+esc2(d.district||'-')+(d.phone?' • '+esc2(d.phone):'')+'</span>':'<span class="muted">Ana bayi listesinde eşleşme bulunamadı.</span>')+
          (d?.address?'<span class="muted" style="margin-top:3px">'+esc2(d.address)+'</span>':'')+
          '<div style="margin-top:6px">'+
            (hasCoord?'<span class="badge b-ok">Konum var</span>':'<span class="badge b-warn">Koordinat eksik</span>')+
            (d?.isZCode?' <span class="badge b-zcode">Z KODLU</span>':'')+
            (visited?' <span class="badge b-ok">Ziyaret edildi</span>':'')+
          '</div></div>'+
        '<div class="toolbar route-actions">'+
          '<button class="btn btn-ghost" onclick="route2Dealer('+x.n+')">Bayi Aç</button>'+
          '<button class="btn btn-primary" onclick="route2Visit('+x.n+')">Görüşme Notu</button>'+
          '<button class="btn btn-accent" onclick="route2Directions('+x.n+')">Yol Tarifi</button>'+
        '</div></div>';
    }).join('');

    if(typeof window.renderRoute2Workspace==='function')setTimeout(()=>window.renderRoute2Workspace(),0);
  }

  function install(){
    resetOldRoute2DraftsOnce();
    if(document.getElementById('route2')){
      window.renderRoute2=renderRoute2;
      renderRoute2();
      return;
    }

    const old=document.getElementById('routeNavBtn');
    if(old){
      const b=document.createElement('button');
      b.id='route2NavBtn';
      b.dataset.section='route2';
      b.textContent='Rut Planı2';
      b.onclick=()=>{if(typeof activateSection==='function')activateSection('route2');setTimeout(renderRoute2,0);};
      old.insertAdjacentElement('afterend',b);
    }

    const section=document.createElement('section');
    section.id='route2';
    section.className='section';
    section.innerHTML='<div class="grid">'+
      '<div class="card span-4"><h3>Rut Planı2</h3>'+ 
        '<div class="note"><strong>Güncel Excel planı</strong><br><span class="muted">Bu sekme son gönderdiğin 2 haftalık planı gösterir. Ana Rut Planı kaynak verisi değişmez.</span></div>'+ 
        '<label>Hafta</label><select id="route2Week"><option value="1">1. Hafta</option><option value="2">2. Hafta</option></select>'+ 
        '<label>Gün</label><select id="route2Day">'+DAYS.map(d=>'<option value="'+d+'">'+d+'</option>').join('')+'</select>'+ 
        '<button class="btn btn-primary" style="width:100%;margin-top:12px" onclick="renderRoute2()">Planı Göster</button>'+ 
      '</div>'+ 
      '<div class="card span-8"><h3>Yeni 2 Haftalık Rut</h3><div id="route2Summary" class="note">Plan hazırlanıyor…</div><div id="route2List" class="list"></div></div>'+ 
    '</div>';

    const main=document.querySelector('.app > main');
    const oldSection=document.getElementById('route');
    if(oldSection)oldSection.insertAdjacentElement('afterend',section); else main?.appendChild(section);

    const s=selected();
    if(s.week)document.getElementById('route2Week').value=String(s.week);
    if(DAYS.includes(s.day))document.getElementById('route2Day').value=s.day;
    document.getElementById('route2Week').addEventListener('change',renderRoute2);
    document.getElementById('route2Day').addEventListener('change',renderRoute2);
    renderRoute2();
  }

  window.renderRoute2=renderRoute2;
  window.route2Directions=route2Directions;
  window.route2Dealer=route2Dealer;
  window.route2Visit=route2Visit;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
})();