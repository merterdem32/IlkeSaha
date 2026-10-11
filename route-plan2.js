// İlke Saha - Rut Planı2
// Yeni Saha1 rutunu mevcut Rut Planı verisine dokunmadan ayrı sekmede gösterir.
(() => {
  const DAYS=['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  const PLAN={
    '1|Pazartesi':{date:'2026-10-12',ids:[63,61,91,82,143,68,56,54,136,36,141,10]},
    '1|Salı':{date:'2026-10-13',ids:[32,142,11,21,98,146,60,118,132,35,134,53,15]},
    '1|Çarşamba':{date:'2026-10-14',ids:[113,4,6,129,64,78,80,101,77,107,1,71]},
    '1|Perşembe':{date:'2026-10-15',ids:[46,3,50,103,151,131,120,111,86,58,37,66,105]},
    '1|Cuma':{date:'2026-10-16',ids:[81,45,144,8,27,43,114,140,75,109,9]},
    '1|Cumartesi':{date:'2026-10-17',ids:[73,79,16,44,14,133,125]},
    '2|Pazartesi':{date:'2026-10-19',ids:[7,138,130,110,65,128,106,51,47,145,96,17]},
    '2|Salı':{date:'2026-10-20',ids:[57,102,112,123,28,76,147,87,135,40,22,104]},
    '2|Çarşamba':{date:'2026-10-21',ids:[42,116,24,74,108,12,49,152,139,115,20,88]},
    '2|Perşembe':{date:'2026-10-22',ids:[23,33,26,19,137,13,94,89,34,48,99,124]},
    '2|Cuma':{date:'2026-10-23',ids:[121,30,52,97,95,83,90,117,55,100,93,59]},
    '2|Cumartesi':{date:'2026-10-24',ids:[41,18,72,148,25,5,92]}
  };
  const NAMES={63:'İSMAİL ŞEN-ADIM OTO ELEKTRİK',61:'İMDAT DEMİR-ÖMER OTO',91:'MURAT OTO BAKIM SERVİSİ',82:'KÜBRA OTO - OSMAN USTA',143:'UMT GARAGE UMUT OTO YEDEK PARÇA ELEKTRONİK VE AKSEUARLARI SAN. TİC. LTD. ŞTİ.',68:'KADİR ERENSES KARAGÖZ AKÜ MARKET',56:'GÜLERSAM İNŞAAT OTO.TUR.SAN.VE TİC.LTD.ŞTİ.',54:'GURUR GÜRBÜZ',136:'TEMUR OTO- OSMAN NURİ TEMUR',36:'EMEK OTOMOTİV MUSTAFA BALIK',141:'TÜM OTOMOTİV TAŞIMACILIK TİCARET SAN. LTD. ŞTİ.',10:'ARKADAŞ OTO ELEKTRİK-ÇETİN AKDENİZ',32:'DENİZ YEDEK PARÇA SERVİS VE OTOMOTİV  TİC. LTD ŞTİ',142:'ULAŞ OTOMOTİV YEDEK PARÇA TİCARET LİMİTED ŞİRKETİ',11:'ARS OTOMOBİL YEDEK PARÇA SAN.VE TİC.LTD.ŞTİ',21:'BİLAL OSMAN TANRIYATAPAN - MİR OTOMOTİV',98:'NERMİN DİLEK-EMİR OTO ELEKTRİK',146:'UZMANLAR İSTİF MAKİNA BAKIM ONARIM TİC.LTD.ŞTİ.',60:'İBRAHİM DOĞAN DOĞAN AKÜ',118:'RAGIP FIRAT AKTAŞ - NEF OTOMOTİV',132:'SEVENKAR OTOMOTIV ITHALAT IHRACAT SANAYİ VE TİCARE',35:'ELİT OTOMOTİV YEDEK PARÇA- ŞABAN DİKÇAL',134:'ŞEHMUS SEVEN OTO ÜMİT KARDEŞLER',53:'GÖRLER OTO 2- AHMET GÖRLER',15:'AYDIN DEMİRTAŞ - HONDA MERKEZ OTO',113:'ÖZGRUP AKÜ MARKET -EMRE ÖZ',4:'AHMET ÖZEL OTO',6:'ALİ KESKİN-KESKİNLER OTOMOTİV',129:'SELİM ÖZER - SOYKAN OTOMOTİV',64:'İSTANBUL REKLAMCILIK JANT LASTİK İNŞ. GIDA. TURZ.',78:'KESMAN ÇİLİNGİR ELEKTRONİK İTHAALAT İHRACAAT TİC. LTD. ŞTİ.',80:'KONYALILAR OTO LASTİK - SÜLEYMAN YILDIRIM',101:'OLGUN GLOBAL TURİZM OTOMOTİV GIDA LİMİTED ŞİRKETİ',77:'KENAN ASARKAYA -ASARKAYA OTOMOTİV',107:'OTO KARINCA',1:'19 OTO LASTİK -NESRİN TOLUMOĞLU',71:'KARAKAYA OTOMOTİV TİC. LTD .ŞTİ.',46:'FG AKÜ CİHAN ELTE',3:'AHMET KARA-PINARBAŞI OTO ELEKTRİK',50:'GM GARAGE OTOMOTİV',103:'ORHAN BALTAÇ - HUZUR OTO',151:'YUNUS ÇÖL/ MİNA OTO SERVİS',131:'SERHAT HÜSEYİNOĞLU - HÜSEYİNOĞLU OTOMOTİV',120:'RAMAZAN ERYILMAZ - MERA CAR',111:'ÖNERLER OTOMOTİV -ZAFER ÖNER',86:'MEHMET TANER DEĞER-TANER OTOMOTİV',58:'HASAL OTOMOTİV SERVİS HİZMETLERİ',37:'EMİR AKÜ OTOMOTİV SAN VE DIŞ TİC. LTD. ŞTİ.',66:'JAPON OTO SERVİS- İLKER USTA',105:'OSMAN BÜTÜNER-BÜTÜNER OTO SERVİS',81:'KURBAN AKDEMİR-AKDEMİR OTO',45:'FERHAT YILMAZ HİSAR OTO PAZ NAK İNŞ SAN VE LTD ŞTİ',144:'UYGUN TİCARET OTO BAKIM VE YEDEK PARÇA SERVİSİ-MUSTAFA UYGUN',8:'ALPAR OTOMOTİV SANAYİ VE TİCARET LİMİTED ŞİRKETİ',27:'ÇAĞDAŞ OTOMOTİV TEKSTİL GIDA İNŞ. SAN. TİC.',43:'EVO OTOMOTİV YEDEK PARÇA',114:'ÖZGÜÇLÜLER OTOMOTİV - MUZAFFER BY-NURETTİN BY-SALİH',140:'TUTKU OTO YEDEK PARÇA SAN. VE TİC.LTD. ŞTİ.',75:'KAZANCIOĞLU KARDEŞLER -HÜSEYİN ÜSTÜNGÜN',109:'OTO SAĞLAM YEDEKPARÇA',9:'ARDA DEMİRTAŞ AKÜ -OLGUN YEŞİLYURT',73:'KAVAKLI AKÜ MARKET -POLAT KILIÇEL',79:'KIRAÇ OTO- TUĞRUL ALNIAK',16:'B OTOMOTİV SERVİS SANAYİ VE TİC. LTD.ŞTİ',44:'FATİH TOLGA ÖZTÜRK',14:'AYDEMİR İZCİ - HEDEF OTO',133:'STAR OTOMOTİV - BOSCH CAR SERVİCE BEYKENT SANAYİ',125:'ROTEKS AR OTOMOTİV-3   ATAKAN AKÇUBUK',7:'ALİ TOPRAK VE ORTAĞI',138:'TOLGA KIZILCIKLI - JET OTO',130:'SERCAN GÜRELİ',110:'ÖNDER OTO SANAYİ VE TİC.LTD.ŞTİ.',65:'İZMİRLİ ROT BALANS - ÇÖZÜM OTO ELEKTRİK - MURAT BOZDEMİR',128:'SEL OTO-SEFER SEL',106:'OTO GARANTİ OTOMOTİV',51:'GÖKSUN ÖZTÜRK-HYK HAFRİYAT VE NAKLİYAT OTO LASTİK TAMİRAT VE TİCARET-BAYBARS ELEKTRİK',47:'FİLO 15 NAKLİYE TUR.OTOMOTİV SAN.VE TİC.LTD.ŞTİ',145:'UYGUNLAR LASTİK NAK.GID.PAZ.İTH.İHR.SAN.TİC.LTD.ŞTİ',96:'NAR UZMAN DİZEL REVİZYON OTO SERVİS VE YEDEK PARÇA SANAYİ VE TİCARET LİMİTED ŞİRKETİ',17:'BAHATTİN ÖZMEN - B&Y AUTO',57:'HACI MUSTAFA KELEK-SİSTEM OTO ELEKTRİK',102:'ONUR ALANLAR',112:'ÖZ MEMİŞLER OTOMOTİV GIDA TEKSTİL',123:'RIZGAR ALUSH',28:'ÇELİK OTOMOTİV -İBRAHİM ÇELİK',76:'KEMAL YILDIZ -OTOBAKIMHANE',147:'VATAN OTO LASTİK-PERİHAN BODUR',87:'MEHMET VEYSİ KAYA - ARAS OTO',135:'TEKİN KARDEŞLER LASTİK PETROL SAN VE TİC',40:'EROL ALTINTAŞ -ALTINTAŞ AKÜ MARKET',22:'BOZACI OTO ELEKTRİK MEKANİK SERVİSİ -EMRE BOZACI',104:'ORHAN YILDIRIM-ORHAN PETROL',42:'EUROMOTORS AHMET USTA (P)',116:'ÖZTÜRK OTOMOTİV KAPORTA BOYA PETROL',24:'BÜLENT ÖZTÜRK - ÖZTÜRK OTO ELEKTRİK  (P)',74:'KAYA OTO -YAPRAK KAYA BAĞDATLI',108:'OTO N55 YEDEK PARÇA -YASİN NACAK',12:'ATEŞ OTOMOTİV HASAN KIZILKAN ( P )',49:'GEZ YEDEK PARÇA VE OTOMOTİV SAN TİC. LTD. ŞTİ.',152:'YURT OTO VEDAT YURT(P)',139:'TUNCAYLAR OTO YEDEK PARÇA',115:'ÖZGÜR OTO PERSONEL VE SERVİS TAŞIMACILIĞI -YUNUS YAZICI',20:'BEŞLER OTO TAMİR BAKIM SERVİSİ - TUĞRUL TÜRKER',88:'MERKEZ OTO-SELİM BİNGÖLLÜ',23:'BÜLENT AKSOY - HÜNER OTO',33:'DOĞUKAN GROUP OTOMOTİV TİCARET ANONİM ŞİRKETİ',26:'CEYHUN OTO SERVİS - CEYHAN AVCI',19:'BAŞKENT OTOMOTİV -HARUN KARAAĞAÇ',137:'TOLGA BAYKALA - KANCA AKÜ MARKET',13:'ATM MEKANİK OTO SAN. TİC. LTD. ŞTİ',94:'MÜRSEL USTA OTOMOTİV SANAYİ VE  TİCARET LTD ŞTİ',89:'MİNİKLER TUNİNG - CEM BAŞARAN-HAKAN KETENCİ',34:'DOĞUKAN OTOMOTİV 2 - BARIŞ AKDEMİR',48:'GELTUR TURİZM OTOMOTİV GIDA TİC.LTD.ŞTİ.',99:'NURCİHAN CEYLAN-CEYKAR OTOMOTİV',124:'ROTEKS AR OTOMOTİV-1   SEYİT AKÇUBUK',121:'RECEP MEŞE',30:'ÇETİNBAŞ OTOMOTİV SAN. TİC. LTD . ŞTİ.',52:'GÖRKEM OTO-YASİN KARATAŞ',97:'NCK OTOMOTİV TURİZM İNŞAAT TARIM GIDA SANAYİ VE TİCARET LİMİTED ŞİRKETİ',95:'NACAKOĞLU OTOMOTİV VE TAŞIMACILIK TİC. LTD.ŞTİ.',83:'LİDER NEVA OTOMOTİV İÇ VE DIŞ İC. LTD ŞTİ.',90:'MURAT BİROL - BİRLİK OTO',117:'ÖZYILDIZ OTOMOTİV - MAŞUK YILDIZ',55:'GUTBETTİN KARÇIK  - AKTİF OTOMOTİV OTO KAPORTA VE',100:'OKAN OTO ELEKTİRİK TAMER ÖZTÜRK',93:'MUTLU OTO BÜLENT HARMANKAYA',59:'HÜSAMETTİN SÜER - ÖZEN OTO',41:'ESOTOM OTOMOTİV SERVİS VE SANAYİ TİC.LTD.ŞTİ.',18:'BAKİ USTA İNŞAAT OTOMOTİV EMLAK TİC.LTD.ŞTİ"',72:'KARİYER OTO SERVİS SAN. VE TİC. LTD. ŞTİ.',148:'VYS AUTO SERVİCE-ZEYNEP KAYA ARSLAN',25:'CAN AKÜ - YUSUF CAN KIZMAZ',5:'ALİ DOĞAN  -ATLAS OTO LASTİK',92:'MUSTAFA ÇELİK - MUTCAR OTO'};
  const KEY='ilkeSahaRoute2SelectionV1';

  const esc2=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=v=>String(v||'').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g,' ');

  function dealerBySource(n){
    if(typeof state==='undefined'||!Array.isArray(state.dealers))return null;
    const id='imported-'+String(n).padStart(3,'0');
    return state.dealers.find(d=>d.id===id)||state.dealers.find(d=>norm(d.name)===norm(NAMES[n]))||null;
  }

  function selected(){
    try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){return {};}
  }
  function remember(){
    localStorage.setItem(KEY,JSON.stringify({week:Number(route2Week.value||1),day:route2Day.value||'Pazartesi'}));
  }

  function route2Directions(n){
    const d=dealerBySource(n);
    if(!d){ alert('Bayi ana listede bulunamadı: '+(NAMES[n]||n)); return; }
    if(typeof openGoogleMapsDirections==='function'){openGoogleMapsDirections(d.id);return;}
    const dest=isValidDealerCoordinate(d.lat,d.lng)?d.lat+','+d.lng:(d.address||'');
    if(!dest){alert('Bu bayi için adres veya koordinat yok.');return;}
    window.open('https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(dest),'_blank','noopener');
  }
  function route2Dealer(n){
    const d=dealerBySource(n);
    if(!d){ alert('Bayi ana listede bulunamadı: '+(NAMES[n]||n)); return; }
    showDealer(d.id);
  }
  function route2Visit(n){
    const d=dealerBySource(n);
    if(!d){ alert('Bayi ana listede bulunamadı: '+(NAMES[n]||n)); return; }
    openVisitModal(d.id);
  }

  function renderRoute2(){
    const week=Number(document.getElementById('route2Week')?.value||1);
    const day=document.getElementById('route2Day')?.value||'Pazartesi';
    const p=PLAN[week+'|'+day];
    remember();
    const list=document.getElementById('route2List');
    const sum=document.getElementById('route2Summary');
    if(!p||!list||!sum)return;
    const dateLabel=new Date(p.date+'T12:00:00').toLocaleDateString('tr-TR');
    const dealers=p.ids.map(n=>({n,d:dealerBySource(n)}));
    const missing=dealers.filter(x=>!x.d).length;
    const coordMissing=dealers.filter(x=>x.d&&!isValidDealerCoordinate(x.d.lat,x.d.lng)).length;
    const districts=[...new Set(dealers.map(x=>x.d?.district).filter(Boolean))];
    sum.innerHTML='<strong>'+week+'. Hafta • '+esc2(day)+' • '+dateLabel+'</strong><div class="muted" style="margin-top:5px">'+p.ids.length+' bayi'+(coordMissing?' • <span class="badge b-warn">'+coordMissing+' koordinatsız</span>':'')+(missing?' • <span class="badge b-bad">'+missing+' eşleşmeyen kayıt</span>':'')+'</div><div class="muted" style="margin-top:5px">'+esc2(districts.join(' • '))+'</div>';
    list.innerHTML=dealers.map((x,i)=>{
      const d=x.d;
      const name=d?.name||NAMES[x.n]||('Kaynak sıra '+x.n);
      const visited=d&&Array.isArray(state.visits)&&state.visits.some(v=>v.dealerId===d.id&&String(v.date||'').slice(0,10)===p.date);
      return '<div class="item route-stop"><div class="num">'+(i+1)+'</div><div class="route-info"><strong>'+esc2(name)+'</strong>'+
        (d?'<span class="muted">'+esc2(d.district||'-')+(d.phone?' • '+esc2(d.phone):'')+'</span>':'<span class="muted">Ana bayi listesinde eşleşme bulunamadı.</span>')+
        (d?.address?'<span class="muted" style="margin-top:3px">'+esc2(d.address)+'</span>':'')+
        '<div style="margin-top:6px">'+(d&&isValidDealerCoordinate(d.lat,d.lng)?'<span class="badge b-ok">Konum var</span>':'<span class="badge b-warn">Koordinat eksik</span>')+(d?.isZCode?' <span class="badge b-zcode">Z KODLU</span>':'')+(visited?' <span class="badge b-ok">Ziyaret edildi</span>':'')+'</div></div>'+
        '<div class="toolbar route-actions"><button class="btn btn-ghost" onclick="route2Dealer('+x.n+')">Bayi Aç</button><button class="btn btn-primary" onclick="route2Visit('+x.n+')">Görüşme Notu</button><button class="btn btn-accent" onclick="route2Directions('+x.n+')">Yol Tarifi</button></div></div>';
    }).join('');
  }

  function install(){
    if(document.getElementById('route2'))return;
    const old=document.getElementById('routeNavBtn');
    if(old){
      const b=document.createElement('button'); b.id='route2NavBtn'; b.dataset.section='route2'; b.textContent='Rut Planı2';
      b.onclick=()=>{activateSection('route2');setTimeout(renderRoute2,0);}; old.insertAdjacentElement('afterend',b);
    }
    const section=document.createElement('section'); section.id='route2'; section.className='section';
    section.innerHTML='<div class="grid"><div class="card span-4"><h3>Rut Planı2</h3><div class="note"><strong>Test alanı</strong><br><span class="muted">Yeni Excel planını burada deniyoruz. Mevcut Rut Planı, bugünkü rut ve yayınlanmış rut kayıtları değişmez.</span></div><label>Hafta</label><select id="route2Week"><option value="1">1. Hafta</option><option value="2">2. Hafta</option></select><label>Gün</label><select id="route2Day">'+DAYS.map(d=>'<option value="'+d+'">'+d+'</option>').join('')+'</select><button class="btn btn-primary" style="width:100%;margin-top:12px" onclick="renderRoute2()">Planı Göster</button></div><div class="card span-8"><h3>Yeni 2 Haftalık Rut</h3><div id="route2Summary" class="note">Plan hazırlanıyor…</div><div id="route2List" class="list"></div></div></div>';
    const main=document.querySelector('.app > main'); const oldSection=document.getElementById('route');
    if(oldSection)oldSection.insertAdjacentElement('afterend',section); else main?.appendChild(section);
    const s=selected(); if(s.week)route2Week.value=String(s.week); if(DAYS.includes(s.day))route2Day.value=s.day;
    route2Week.addEventListener('change',renderRoute2); route2Day.addEventListener('change',renderRoute2); renderRoute2();
  }

  window.renderRoute2=renderRoute2; window.route2Directions=route2Directions; window.route2Dealer=route2Dealer; window.route2Visit=route2Visit;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
})();