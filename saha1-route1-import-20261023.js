// İlke Saha - 2026-10-23 Saha1 Rut Planı yüklemesi
// Kaynak: Ilke_2_Haftalik_Rut_Bolge_Butunluklu(1).xlsx / Bayi-Gün Eşlemesi
(()=>{
  const VERSION='saha1-route1-20261023-v1';
  const LOCAL_KEY='ilkeSaha:'+VERSION;
  const PLAN=[[1,'PAZARTESİ',1,'120.01.0291','ALİ TOPRAK VE ORTAĞI'],[1,'PAZARTESİ',2,'120.01.0239','TOLGA KIZILCIKLI - JET OTO'],[1,'PAZARTESİ',3,'','BAHATTİN ÖZMEN - B&Y AUTO'],[1,'PAZARTESİ',4,'120.01.0367','NAR UZMAN DİZEL REVİZYON OTO SERVİS VE YEDEK PARÇA SANAYİ VE TİCARET LİMİTED ŞİRKETİ'],[1,'PAZARTESİ',5,'120.01.0074','UYGUNLAR LASTİK NAK.GID.PAZ.İTH.İHR.SAN.TİC.LTD.ŞTİ'],[1,'PAZARTESİ',6,'120.01.0315-Z','FİLO 15 NAKLİYE TUR.OTOMOTİV SAN.VE TİC.LTD.ŞTİ'],[1,'SALI',1,'','ROTEKS AR OTOMOTİV-3   ATAKAN AKÇUBUK'],[1,'SALI',2,'','STAR OTOMOTİV - BOSCH CAR SERVİCE BEYKENT SANAYİ'],[1,'SALI',3,'120.01.0427','AYDEMİR İZCİ - HEDEF OTO'],[1,'SALI',4,'120.01.0400','FATİH TOLGA ÖZTÜRK'],[1,'SALI',5,'120.01.0293-Z','B OTOMOTİV SERVİS SANAYİ VE TİC. LTD.ŞTİ'],[1,'SALI',6,'','KIRAÇ OTO- TUĞRUL ALNIAK'],[1,'SALI',7,'120.01.0420','KAVAKLI AKÜ MARKET -POLAT KILIÇEL'],[1,'SALI',8,'120.01.0237','NURCİHAN CEYLAN-CEYKAR OTOMOTİV'],[1,'ÇARŞAMBA',1,'','ROTEKS AR OTOMOTİV-1   SEYİT AKÇUBUK'],[1,'ÇARŞAMBA',2,'','MÜRSEL USTA OTOMOTİV SANAYİ VE  TİCARET LTD ŞTİ'],[1,'ÇARŞAMBA',3,'','ATM MEKANİK OTO SAN. TİC. LTD. ŞTİ'],[1,'ÇARŞAMBA',4,'120.01.0332','GELTUR TURİZM OTOMOTİV GIDA TİC.LTD.ŞTİ.'],[1,'ÇARŞAMBA',5,'','DOĞUKAN OTOMOTİV 2 - BARIŞ AKDEMİR'],[1,'ÇARŞAMBA',6,'120.01.0025','MİNİKLER TUNİNG - CEM BAŞARAN-HAKAN KETENCİ'],[1,'ÇARŞAMBA',7,'120.01.0130','TOLGA BAYKALA - KANCA AKÜ MARKET'],[1,'ÇARŞAMBA',8,'120.01.0459','MUSTAFA ÇELİK - MUTCAR OTO'],[1,'ÇARŞAMBA',9,'120.01.0376','DOĞUKAN GROUP OTOMOTİV TİCARET ANONİM ŞİRKETİ'],[1,'ÇARŞAMBA',10,'','BAŞKENT OTOMOTİV -HARUN KARAAĞAÇ'],[1,'ÇARŞAMBA',11,'','CEYHUN OTO SERVİS - CEYHAN AVCI'],[1,'ÇARŞAMBA',12,'120.01.0095','BÜLENT AKSOY - HÜNER OTO'],[1,'PERŞEMBE',1,'120.01.0283','ORHAN YILDIRIM-ORHAN PETROL'],[1,'PERŞEMBE',2,'120.01.0004','BOZACI OTO ELEKTRİK MEKANİK SERVİSİ -EMRE BOZACI'],[1,'PERŞEMBE',3,'120.01.0160','EROL ALTINTAŞ -ALTINTAŞ AKÜ MARKET'],[1,'PERŞEMBE',4,'120.01.0003','TEKİN KARDEŞLER LASTİK PETROL SAN VE TİC'],[1,'PERŞEMBE',5,'120.01.0189','MEHMET VEYSİ KAYA - ARAS OTO'],[1,'PERŞEMBE',6,'120.01.0035','VATAN OTO LASTİK-PERİHAN BODUR'],[1,'PERŞEMBE',7,'','KEMAL YILDIZ -OTOBAKIMHANE'],[1,'PERŞEMBE',8,'120.01.0006','ÇELİK OTOMOTİV -İBRAHİM ÇELİK'],[1,'PERŞEMBE',9,'120.01.0179','HÜSAMETTİN SÜER - ÖZEN OTO'],[1,'PERŞEMBE',10,'','ARDA DEMİRTAŞ AKÜ -OLGUN YEŞİLYURT'],[1,'PERŞEMBE',11,'120.01.0118-Z','LİDER NEVA OTOMOTİV İÇ VE DIŞ İC. LTD ŞTİ.'],[1,'PERŞEMBE',12,'120.01.0232','BEŞLER OTO TAMİR BAKIM SERVİSİ - TUĞRUL TÜRKER'],[1,'PERŞEMBE',13,'120.01.0029','RIZGAR ALUSH'],[1,'PERŞEMBE',14,'120.01.0135','KURBAN AKDEMİR-AKDEMİR OTO'],[1,'PERŞEMBE',15,'120.01.0451','ÖZ MEMİŞLER OTOMOTİV GIDA TEKSTİL'],[1,'PERŞEMBE',16,'120.01.0248','HACI MUSTAFA KELEK-SİSTEM OTO ELEKTRİK'],[1,'CUMA',1,'120.01.0155','ALİ DOĞAN  -ATLAS OTO LASTİK'],[1,'CUMA',2,'120.01.0357','VYS AUTO SERVİCE-ZEYNEP KAYA ARSLAN'],[1,'CUMA',3,'','CAN AKÜ - YUSUF CAN KIZMAZ'],[1,'CUMA',4,'120.01.0334','BAKİ USTA İNŞAAT OTOMOTİV EMLAK TİC.LTD.ŞTİ"'],[1,'CUMA',5,'120.01.0109','KARİYER OTO SERVİS SAN. VE TİC. LTD. ŞTİ.'],[1,'CUMA',6,'120.01.0253','KARAKAYA OTOMOTİV TİC. LTD .ŞTİ.'],[1,'CUMA',7,'120.01.0305','ESOTOM OTOMOTİV SERVİS VE SANAYİ TİC.LTD.ŞTİ.'],[2,'PAZARTESİ',1,'120.01.0082','İSTANBUL REKLAMCILIK JANT LASTİK İNŞ. GIDA. TURZ.'],[2,'PAZARTESİ',2,'120.01.0178','KESMAN ÇİLİNGİR ELEKTRONİK İTHAALAT İHRACAAT TİC. LTD. ŞTİ.'],[2,'PAZARTESİ',3,'120.01.0282','SERCAN GÜRELİ'],[2,'PAZARTESİ',4,'120.01.0199','ÖNDER OTO SANAYİ VE TİC.LTD.ŞTİ.'],[2,'PAZARTESİ',5,'','OTO GARANTİ OTOMOTİV'],[2,'PAZARTESİ',6,'120.01.0054','SEL OTO-SEFER SEL'],[2,'PAZARTESİ',7,'','İZMİRLİ ROT BALANS - ÇÖZÜM OTO ELEKTRİK - MURAT BOZDEMİR'],[2,'SALI',1,'120.01.0268','SELİM ÖZER - SOYKAN OTOMOTİV'],[2,'SALI',2,'120.01.0092','19 OTO LASTİK -NESRİN TOLUMOĞLU'],[2,'SALI',3,'','OTO KARINCA'],[2,'SALI',4,'','ÖZGRUP AKÜ MARKET -EMRE ÖZ'],[2,'SALI',5,'120.01.0036-Z','ALİ KESKİN-KESKİNLER OTOMOTİV'],[2,'SALI',6,'120.01.0176','KENAN ASARKAYA -ASARKAYA OTOMOTİV'],[2,'SALI',7,'120.01.0032','KONYALILAR OTO LASTİK - SÜLEYMAN YILDIRIM'],[2,'SALI',8,'120.01.0353','OLGUN GLOBAL TURİZM OTOMOTİV GIDA LİMİTED ŞİRKETİ'],[2,'SALI',9,'120.01.0277','AHMET ÖZEL OTO'],[2,'ÇARŞAMBA',1,'120.01.0380','AYDIN DEMİRTAŞ - HONDA MERKEZ OTO'],[2,'ÇARŞAMBA',2,'','JAPON OTO SERVİS- İLKER USTA'],[2,'ÇARŞAMBA',3,'','GÖRLER OTO 2- AHMET GÖRLER'],[2,'ÇARŞAMBA',4,'120.01.0064','ŞEHMUS SEVEN OTO ÜMİT KARDEŞLER'],[2,'ÇARŞAMBA',5,'','ELİT OTOMOTİV YEDEK PARÇA- ŞABAN DİKÇAL'],[2,'ÇARŞAMBA',6,'','SEVENKAR OTOMOTIV ITHALAT IHRACAT SANAYİ VE TİCARE'],[2,'ÇARŞAMBA',7,'','RAGIP FIRAT AKTAŞ - NEF OTOMOTİV'],[2,'ÇARŞAMBA',8,'120.01.0061','İBRAHİM DOĞAN DOĞAN AKÜ'],[2,'ÇARŞAMBA',9,'','KASAPOĞLU KARDEŞLER FORD SERVİSİ'],[2,'ÇARŞAMBA',10,'120.01.0321','UZMANLAR İSTİF MAKİNA BAKIM ONARIM TİC.LTD.ŞTİ.'],[2,'ÇARŞAMBA',11,'120.01.0327','ATİLA BAĞCI-IĞDIRLI OTOMOTİV'],[2,'ÇARŞAMBA',12,'120.01.0521','BİLAL OSMAN TANRIYATAPAN - MİR OTOMOTİV'],[2,'ÇARŞAMBA',13,'120.01.0322','ARS OTOMOBİL YEDEK PARÇA SAN.VE TİC.LTD.ŞTİ'],[2,'ÇARŞAMBA',14,'120.01.0371','ULAŞ OTOMOTİV YEDEK PARÇA TİCARET LİMİTED ŞİRKETİ'],[2,'ÇARŞAMBA',15,'120.01.0065','DENİZ YEDEK PARÇA SERVİS VE OTOMOTİV  TİC. LTD ŞTİ'],[2,'ÇARŞAMBA',16,'120.01.0286','NERMİN DİLEK-EMİR OTO ELEKTRİK'],[2,'PERŞEMBE',1,'120.01.0457','OSMAN BÜTÜNER-BÜTÜNER OTO SERVİS'],[2,'PERŞEMBE',2,'120.01.0184','SERHAT HÜSEYİNOĞLU - HÜSEYİNOĞLU OTOMOTİV'],[2,'PERŞEMBE',3,'120.01.0249','MEHMET TANER DEĞER-TANER OTOMOTİV'],[2,'PERŞEMBE',4,'','RAMAZAN ERYILMAZ - MERA CAR'],[2,'PERŞEMBE',5,'','ÖNERLER OTOMOTİV -ZAFER ÖNER'],[2,'PERŞEMBE',6,'','YUNUS ÇÖL/ MİNA OTO SERVİS'],[2,'PERŞEMBE',7,'','HASAL OTOMOTİV SERVİS HİZMETLERİ'],[2,'PERŞEMBE',8,'120.01.0046','FG AKÜ CİHAN ELTE'],[2,'PERŞEMBE',9,'','GM GARAGE OTOMOTİV'],[2,'PERŞEMBE',10,'120.01.0208','ORHAN BALTAÇ - HUZUR OTO'],[2,'PERŞEMBE',11,'120.01.0200-Z','AHMET KARA-PINARBAŞI OTO ELEKTRİK'],[2,'PERŞEMBE',12,'120.01.0031','ARKADAŞ OTO ELEKTRİK-ÇETİN AKDENİZ'],[2,'CUMA',1,'','EMİR AKÜ OTOMOTİV SAN VE DIŞ TİC. LTD. ŞTİ.'],[2,'CUMA',2,'','TEMUR OTO- OSMAN NURİ TEMUR'],[2,'CUMA',3,'120.01.0214','EMEK OTOMOTİV MUSTAFA BALIK'],[2,'CUMA',4,'','TÜM OTOMOTİV TAŞIMACILIK TİCARET SAN. LTD. ŞTİ.'],[2,'CUMA',5,'120.01.0326-Z','GURUR GÜRBÜZ'],[2,'CUMA',6,'120.01.0500','KÜBRA OTO - OSMAN USTA'],[2,'CUMA',7,'120.01.0498','MURAT OTO BAKIM SERVİSİ'],[2,'CUMA',8,'120.01.0313','İMDAT DEMİR-ÖMER OTO'],[2,'CUMA',9,'120.01.0102-Z','UMT GARAGE UMUT OTO YEDEK PARÇA ELEKTRONİK VE AKSEUARLARI SAN. TİC. LTD. ŞTİ.'],[2,'CUMA',10,'120.01.0101','KADİR ERENSES KARAGÖZ AKÜ MARKET'],[1,'CUMARTESİ',1,'120.01.0369','MUTLU OTO BÜLENT HARMANKAYA'],[1,'CUMARTESİ',2,'','OKAN OTO ELEKTİRİK TAMER ÖZTÜRK'],[1,'CUMARTESİ',3,'','GUTBETTİN KARÇIK  - AKTİF OTOMOTİV OTO KAPORTA VE'],[1,'CUMARTESİ',4,'','MURAT BİROL - BİRLİK OTO'],[1,'CUMARTESİ',5,'','MERKEZ OTO-SELİM BİNGÖLLÜ'],[1,'CUMARTESİ',6,'','ÖZYILDIZ OTOMOTİV - MAŞUK YILDIZ'],[1,'CUMARTESİ',7,'120.01.0368','NACAKOĞLU OTOMOTİV VE TAŞIMACILIK TİC. LTD.ŞTİ.'],[1,'CUMARTESİ',8,'120.01.0139','NCK OTOMOTİV TURİZM İNŞAAT TARIM GIDA SANAYİ VE TİCARET LİMİTED ŞİRKETİ'],[1,'CUMARTESİ',9,'120.01.0391','ÖZGÜR OTO PERSONEL VE SERVİS TAŞIMACILIĞI -YUNUS YAZICI'],[1,'CUMARTESİ',10,'','TUNCAYLAR OTO YEDEK PARÇA'],[1,'CUMARTESİ',11,'120.01.0399-Z','GÖRKEM OTO-YASİN KARATAŞ'],[1,'CUMARTESİ',12,'','OTO SAĞLAM YEDEKPARÇA'],[1,'CUMARTESİ',13,'120.01.0099','KAZANCIOĞLU KARDEŞLER -HÜSEYİN ÜSTÜNGÜN'],[1,'CUMARTESİ',14,'','GEZ YEDEK PARÇA VE OTOMOTİV SAN TİC. LTD. ŞTİ.'],[1,'CUMARTESİ',15,'','YURT OTO VEDAT YURT(P)'],[2,'CUMARTESİ',1,'TCR26.001','ATEŞ OTOMOTİV HASAN KIZILKAN ( P )'],[2,'CUMARTESİ',2,'','ÖZGÜÇLÜLER OTOMOTİV - MUZAFFER BY-NURETTİN BY-SALİH'],[2,'CUMARTESİ',3,'120.01.0383','TUTKU OTO YEDEK PARÇA SAN. VE TİC.LTD. ŞTİ.'],[2,'CUMARTESİ',4,'','EVO OTOMOTİV YEDEK PARÇA'],[2,'CUMARTESİ',5,'','OTO N55 YEDEK PARÇA -YASİN NACAK'],[2,'CUMARTESİ',6,'','ÇAĞDAŞ OTOMOTİV TEKSTİL GIDA İNŞ. SAN. TİC.'],[2,'CUMARTESİ',7,'','ÇETİNBAŞ OTOMOTİV SAN. TİC. LTD . ŞTİ.'],[2,'CUMARTESİ',8,'120.01.0143','ALPAR OTOMOTİV SANAYİ VE TİCARET LİMİTED ŞİRKETİ'],[2,'CUMARTESİ',9,'','FERHAT YILMAZ HİSAR OTO PAZ NAK İNŞ SAN VE LTD ŞTİ'],[2,'CUMARTESİ',10,'TCR26.010','BÜLENT ÖZTÜRK - ÖZTÜRK OTO ELEKTRİK  (P)'],[2,'CUMARTESİ',11,'120.01.0378','ÖZTÜRK OTOMOTİV KAPORTA BOYA PETROL'],[2,'CUMARTESİ',12,'','UYGUN TİCARET OTO BAKIM VE YEDEK PARÇA SERVİSİ-MUSTAFA UYGUN'],[2,'CUMARTESİ',13,'','KAYA OTO -YAPRAK KAYA BAĞDATLI'],[2,'CUMARTESİ',14,'','EUROMOTORS AHMET USTA (P)']];

  const norm=v=>String(v||'').trim().toLocaleUpperCase('tr-TR').replace(/[“”"'`´]/g,'').replace(/\s+/g,' ').replace(/\s*[-–—]\s*/g,'-');
  const loose=v=>norm(v).replace(/[^A-ZÇĞİÖŞÜ0-9]/g,'');
  const weekText=w=>w===2?'2. HAFTA':'1. HAFTA';
  let running=false,done=false;

  async function saha1UserId(){
    const org=teamContext?.organizationId;if(!org)return null;
    const [m,p]=await Promise.all([
      supabaseClient.from('organization_members').select('user_id,role,is_active').eq('organization_id',org).eq('is_active',true),
      supabaseClient.from('profiles').select('user_id,username,email')
    ]);
    if(m.error||p.error)return null;
    const ids=new Set((m.data||[]).map(x=>x.user_id));
    const row=(p.data||[]).find(x=>ids.has(x.user_id)&&String(x.username||'').toLocaleLowerCase('tr-TR')==='saha1')||(p.data||[]).find(x=>ids.has(x.user_id)&&String(x.email||'').toLocaleLowerCase('tr-TR').startsWith('saha1@'));
    return row?.user_id||null;
  }

  function mapDealer(dbRows,cari,name){
    const c=String(cari||'').trim().toLocaleUpperCase('tr-TR');
    if(c){const byCari=dbRows.find(d=>String(d.cari_code||'').trim().toLocaleUpperCase('tr-TR')===c);if(byCari)return byCari;}
    const n=norm(name),l=loose(name);
    return dbRows.find(d=>norm(d.name)===n)||dbRows.find(d=>loose(d.name)===l)||null;
  }

  function templateGroups(resolved,s1){
    const out=[];
    for(const week of [1,2])for(const day of ['PAZARTESİ','SALI','ÇARŞAMBA','PERŞEMBE','CUMA','CUMARTESİ']){
      const ids=resolved.filter(x=>x.week===week&&x.day===day).sort((a,b)=>a.order-b.order).map(x=>x.id);
      out.push({organization_id:teamContext.organizationId,plan_type:'ROUTE1',staff_user_id:s1,week_no:week,day_name:day,dealer_ids:ids,updated_by:cloudUser.id,updated_at:new Date().toISOString()});
    }
    return out;
  }

  async function alreadyApplied(desired,s1){
    const {data,error}=await supabaseClient.from('route_plan_templates').select('week_no,day_name,dealer_ids').eq('organization_id',teamContext.organizationId).eq('plan_type','ROUTE1').eq('staff_user_id',s1);
    if(error)return false;
    const byKey=new Map((data||[]).map(r=>[r.week_no+'|'+r.day_name,r.dealer_ids||[]]));
    let exact=0;
    for(const row of desired){const cur=byKey.get(row.week_no+'|'+row.day_name)||[];if(cur.length===row.dealer_ids.length&&cur.every((id,i)=>id===row.dealer_ids[i]))exact++;}
    return exact>=10;
  }

  async function apply(){
    if(running||done||typeof supabaseClient==='undefined'||!supabaseClient||typeof cloudUser==='undefined'||!cloudUser||!teamContext?.organizationId)return;
    running=true;
    try{
      const s1=await saha1UserId();if(!s1)return;
      if(teamContext.role!=='MANAGER'&&cloudUser.id!==s1)return;
      const {data:dbRows,error}=await supabaseClient.from('organization_dealers').select('*').eq('organization_id',teamContext.organizationId);
      if(error)throw error;
      const resolved=[],created=[];
      for(const [week,day,order,cari,name] of PLAN){
        let d=mapDealer(dbRows,cari,name);
        if(!d){
          d={id:crypto.randomUUID(),organization_id:teamContext.organizationId,name,created_by:cloudUser.id,cari_code:cari||null};
          dbRows.push(d);created.push(d);
        }
        resolved.push({week,day,order,id:d.id,source:d,cari,name});
      }
      const desired=templateGroups(resolved,s1);
      if(await alreadyApplied(desired,s1)){
        done=true;try{localStorage.setItem(LOCAL_KEY,'done');}catch(_){ }
        return;
      }

      const now=new Date().toISOString();
      const {error:clearErr}=await supabaseClient.from('organization_dealers').update({planned_week:null,planned_day:null,planned_order:null,updated_by:cloudUser.id,updated_at:now}).eq('organization_id',teamContext.organizationId).eq('assigned_user_id',s1);
      if(clearErr)throw clearErr;

      const dealerRows=resolved.map(x=>({
        id:x.id,organization_id:teamContext.organizationId,name:x.source.name||x.name,created_by:x.source.created_by||cloudUser.id,updated_by:cloudUser.id,
        assigned_user_id:s1,planned_week:weekText(x.week),planned_day:x.day,planned_order:x.order,is_active:true,
        cari_code:x.source.cari_code||x.cari||null,updated_at:now
      }));
      const {error:dealerErr}=await supabaseClient.from('organization_dealers').upsert(dealerRows,{onConflict:'organization_id,id'});
      if(dealerErr)throw dealerErr;
      const {error:tplErr}=await supabaseClient.from('route_plan_templates').upsert(desired,{onConflict:'organization_id,plan_type,staff_user_id,week_no,day_name'});
      if(tplErr)throw tplErr;

      done=true;try{localStorage.setItem(LOCAL_KEY,'done');}catch(_){ }
      window.__saha1RouteImportStatus={version:VERSION,total:PLAN.length,created:created.length};
      if(typeof loadStateFromCloud==='function')await loadStateFromCloud();
      if(typeof renderAll==='function')renderAll();
      console.info('Saha1 Rut Planı yüklendi:',window.__saha1RouteImportStatus);
    }catch(err){console.error('Saha1 Rut Planı yüklenemedi',err);}
    finally{running=false;}
  }

  let tries=0;
  const timer=setInterval(()=>{tries++;apply();if(done||tries>180)clearInterval(timer);},700);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!done)apply();});
})();