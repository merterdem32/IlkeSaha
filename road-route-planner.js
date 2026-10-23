// İlke Saha - Rut Planlayıcı ana bayi modu: gerçek yol ağına göre 2 haftalık plan
(()=>{
  const DAYS=[['1','PAZARTESİ','1. Hafta Pazartesi'],['1','SALI','1. Hafta Salı'],['1','ÇARŞAMBA','1. Hafta Çarşamba'],['1','PERŞEMBE','1. Hafta Perşembe'],['1','CUMA','1. Hafta Cuma'],['1','CUMARTESİ','1. Hafta Cumartesi'],['2','PAZARTESİ','2. Hafta Pazartesi'],['2','SALI','2. Hafta Salı'],['2','ÇARŞAMBA','2. Hafta Çarşamba'],['2','PERŞEMBE','2. Hafta Perşembe'],['2','CUMA','2. Hafta Cuma'],['2','CUMARTESİ','2. Hafta Cumartesi']];
  let selected=new Set(),roadPlan=null,originalToggle=null,originalSelectAll=null,busy=false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  const home=()=>({lat:Number(state?.home?.lat||41.0074),lng:Number(state?.home?.lng||28.5379)});
  const staffId=()=>document.getElementById('routePlannerStaff')?.value||cloudUser?.id||'';
  const staffDealers=()=> (state.dealers||[]).filter(d=>d.isActive!==false&&d.assignedUserId===staffId());
  const valid=d=>typeof isValidDealerCoordinate==='function'&&isValidDealerCoordinate(d?.lat,d?.lng);

  function syncInitial(){if(!selected.size)staffDealers().forEach(d=>selected.add(d.id));}
  function patchSelection(){
    if(!originalToggle&&typeof window.routePlannerToggleDealer==='function'){
      originalToggle=window.routePlannerToggleDealer;window.routePlannerToggleDealer=function(id,on){if(on)selected.add(id);else selected.delete(id);roadPlan=null;return originalToggle.apply(this,arguments);};
    }
    if(!originalSelectAll&&typeof window.routePlannerSelectAll==='function'){
      originalSelectAll=window.routePlannerSelectAll;window.routePlannerSelectAll=function(on){selected=new Set(on?staffDealers().map(d=>d.id):[]);roadPlan=null;return originalSelectAll.apply(this,arguments);};
    }
    const s=document.getElementById('routePlannerStaff');if(s&&!s.dataset.roadPlannerBound){s.dataset.roadPlannerBound='1';s.addEventListener('change',()=>{selected=new Set();roadPlan=null;setTimeout(syncInitial,30);});}
  }

  function render(){
    if(!roadPlan)return;const sum=document.getElementById('routePlannerSummary'),box=document.getElementById('routePlannerResult');if(!sum||!box)return;
    const all=roadPlan.days.flatMap(x=>x.dealers),fallback=!String(roadPlan.mode||'').startsWith('road');
    sum.innerHTML='<div class="rp-summary-grid"><div class="item"><strong>'+all.length+'</strong><div class="muted">Toplam bayi</div></div><div class="item"><strong>12</strong><div class="muted">İş günü</div></div><div class="item"><strong>'+Math.round(roadPlan.roadKm||0)+' km</strong><div class="muted">Karayolu toplam</div></div><div class="item"><strong>'+Math.round((roadPlan.roadMinutes||0)/60)+' sa</strong><div class="muted">Tahmini sürüş</div></div></div>'+(fallback?'<div class="note"><span class="badge b-warn">Yedek mod</span> Yol servisi kullanılamadığı için bu hesapta kuş uçuşu yedeği kullanıldı.</div>':'<div class="note"><span class="badge b-ok">Yol ağı</span> Gün dağılımı ve günlük sıra gerçek sürüş yollarına göre hesaplandı; her gün evden çıkış ve eve dönüş dahil.</div>');
    box.innerHTML=roadPlan.days.map(x=>'<div class="rp-day"><h4>'+esc(x.label)+' <span class="badge b-info">'+x.dealers.length+' bayi</span></h4>'+(x.dealers.length?x.dealers.map((d,i)=>'<div class="rp-stop"><div class="rp-mini-num">'+(i+1)+'</div><div><strong>'+esc(d.name)+'</strong><div class="muted">'+esc(d.district||'')+(!valid(d)?' <span class="rp-est">konum yok</span>':'')+'</div></div></div>').join(''):'<div class="muted">Bu gün boş.</div>')+'</div>').join('');
    const info=document.getElementById('routePlannerMapInfo');if(info)info.textContent=fallback?'Yol servisi erişilemedi; geçici kuş uçuşu yedeği kullanıldı.':'Plan gerçek karayolu sürüş süre/mesafelerine göre oluşturuldu. Evden çıkış ve eve dönüş hesaba dahil.';
  }

  async function build(){
    if(busy)return;busy=true;
    const status=document.getElementById('routePlannerStatus');
    try{
      if(!window.ilkeRoadRouting?.planTwoWeeks)throw new Error('Karayolu motoru hazır değil. Sayfayı yenileyip tekrar deneyin.');
      syncInitial();const ds=staffDealers().filter(d=>selected.has(d.id));if(!ds.length){alert('Önce en az bir bayi seç.');return;}
      if(status)status.textContent='Karayolu matrisi hazırlanıyor…';
      const located=ds.filter(valid),missing=ds.filter(d=>!valid(d));
      const r=await window.ilkeRoadRouting.planTwoWeeks(located,home(),(a,b)=>{if(status)status.textContent='Yol ağı hesaplanıyor: '+a+' / '+b;});
      for(const d of missing){let idx=-1;if(d.district)idx=r.days.findIndex(day=>day.some(x=>String(x.district||'').toLocaleUpperCase('tr-TR')===String(d.district||'').toLocaleUpperCase('tr-TR')));if(idx<0)idx=r.days.map((x,i)=>({i,n:x.length})).sort((a,b)=>a.n-b.n)[0].i;r.days[idx].push(d);}
      roadPlan={...r,staffId:staffId(),days:DAYS.map((m,i)=>({week:Number(m[0]),day:m[1],label:m[2],dealers:r.days[i]||[]}))};
      if(status)status.textContent=String(r.mode).startsWith('road')?'2 haftalık karayolu planı hazır. Aşağıdan kontrol edip Onayla ve Aktar diyebilirsin.':'Yol servisi kullanılamadı; yedek plan hazır.';
      render();
    }catch(err){console.error('Road route planner build failed',err);roadPlan=null;if(status)status.textContent='Plan oluşturulamadı: '+(err?.message||err);alert('Plan oluşturulamadı: '+(err?.message||err));}
    finally{busy=false;}
  }

  async function clearLegacyRoute1ForStaff(now){
    const mine=staffDealers();
    for(const d of mine){
      const {error}=await supabaseClient.from('organization_dealers').update({planned_week:null,planned_day:null,planned_order:null,updated_by:cloudUser.id,updated_at:now}).eq('organization_id',teamContext.organizationId).eq('id',d.id);
      if(error)throw error;
      d.plannedWeek='';d.plannedDay='';d.plannedOrder=0;
    }
  }

  async function approve(){
    if(busy)return;
    if(!roadPlan){alert('Önce En Mantıklı 2 Haftalık Rutu Oluştur butonuyla planı hazırla.');return;}
    if(roadPlan.staffId!==staffId()){alert('Personel değişti. Planı yeniden oluştur.');return;}
    const type=document.getElementById('routePlannerTarget')?.value||'ROUTE1',label=type==='ROUTE1'?'Rut Planı':'Rut Planı2',now=new Date().toISOString();
    if(!confirm(label+' bu karayolu planıyla değiştirilsin mi?'))return;
    const status=document.getElementById('routePlannerStatus');busy=true;
    try{
      if(status)status.textContent=label+' buluta kaydediliyor…';
      const payload=roadPlan.days.map(x=>({organization_id:teamContext.organizationId,plan_type:type,staff_user_id:staffId(),week_no:x.week,day_name:x.day,dealer_ids:x.dealers.map(d=>d.id),updated_by:cloudUser.id,updated_at:now}));
      const {error}=await supabaseClient.from('route_plan_templates').upsert(payload,{onConflict:'organization_id,plan_type,staff_user_id,week_no,day_name'});if(error)throw error;

      if(type==='ROUTE1'){
        // Önce eski kaynak alanları temizle; aksi halde yeni planda olmayan eski bayiler günlerde kalabiliyor.
        await clearLegacyRoute1ForStaff(now);
        for(const x of roadPlan.days){
          for(let i=0;i<x.dealers.length;i++){
            const d=x.dealers[i];
            const {error}=await supabaseClient.from('organization_dealers').update({planned_week:x.week+'. HAFTA',planned_day:x.day,planned_order:i+1,updated_by:cloudUser.id,updated_at:now}).eq('organization_id',teamContext.organizationId).eq('id',d.id);
            if(error)throw error;
            d.plannedWeek=x.week+'. HAFTA';d.plannedDay=x.day;d.plannedOrder=i+1;
          }
        }
      }

      if(typeof logActivity==='function'){try{await logActivity('ROUTE_TEMPLATE_UPDATED','ROUTE',staffId(),{action:'AUTO_2_WEEK_PLAN_ROAD',planType:type,dealerCount:roadPlan.days.flatMap(x=>x.dealers).length});}catch(_){}}
      try{localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){ }
      if(type==='ROUTE2'&&staffId()===cloudUser.id&&typeof refreshRoutePlan2Templates==='function'){try{await refreshRoutePlan2Templates();}catch(_){}}
      if(typeof renderAll==='function')renderAll();
      if(typeof window.ensureRoutePlannerUi==='function')setTimeout(()=>window.ensureRoutePlannerUi(),20);
      if(status)status.textContent=label+' başarıyla kaydedildi.';
      alert(label+' başarıyla oluşturuldu ve kaydedildi.');
    }catch(err){
      console.error('Road route planner approval failed',err);
      const msg=String(err?.message||err);if(status)status.textContent='Aktarım başarısız: '+msg;
      alert(msg.includes('route_plan_templates')?'Plan tablosu hazır değil. Supabase tarafında route_plan_templates tablosunu kontrol et.':'Plan kaydedilemedi: '+msg);
    }finally{busy=false;}
  }

  function install(){if(!window.ilkeRoadRouting||typeof window.buildTwoWeekRoutePlan!=='function')return false;patchSelection();syncInitial();if(!window.__originalApproveTwoWeekRoutePlan)window.__originalApproveTwoWeekRoutePlan=window.approveTwoWeekRoutePlan;window.buildTwoWeekRoutePlan=build;window.approveTwoWeekRoutePlan=approve;return true;}
  let t=setInterval(()=>{if(install())clearInterval(t)},120);
})();