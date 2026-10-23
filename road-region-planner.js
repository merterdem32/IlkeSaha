// İlke Saha - Rut Planlayıcı Bölge Seçerek modu: karayolu bazlı sıralama ve kayıt
(()=>{
  const DAYS=[{week:1,day:'PAZARTESİ',label:'1. Hafta Pazartesi'},{week:1,day:'SALI',label:'1. Hafta Salı'},{week:1,day:'ÇARŞAMBA',label:'1. Hafta Çarşamba'},{week:1,day:'PERŞEMBE',label:'1. Hafta Perşembe'},{week:1,day:'CUMA',label:'1. Hafta Cuma'},{week:1,day:'CUMARTESİ',label:'1. Hafta Cumartesi'},{week:2,day:'PAZARTESİ',label:'2. Hafta Pazartesi'},{week:2,day:'SALI',label:'2. Hafta Salı'},{week:2,day:'ÇARŞAMBA',label:'2. Hafta Çarşamba'},{week:2,day:'PERŞEMBE',label:'2. Hafta Perşembe'},{week:2,day:'CUMA',label:'2. Hafta Cuma'},{week:2,day:'CUMARTESİ',label:'2. Hafta Cumartesi'}];
  let plan=null,originalBuild=null,originalApprove=null,t=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  const norm=v=>String(v||'').trim().toLocaleUpperCase('tr-TR');
  const home=()=>({lat:Number(state?.home?.lat||41.0074),lng:Number(state?.home?.lng||28.5379)});
  const staffId=()=>document.getElementById('routePlannerStaff')?.value||cloudUser?.id||'';
  const dealers=()=> (state.dealers||[]).filter(d=>d.isActive!==false&&d.assignedUserId===staffId());
  const valid=d=>typeof isValidDealerCoordinate==='function'&&isValidDealerCoordinate(d?.lat,d?.lng);
  function activeRegionMode(){return document.getElementById('routePlannerRegionMode')?.style.display!=='none';}
  function cityOf(d){return typeof inferDealerCity==='function'?inferDealerCity(d):'';}
  function selections(){
    return [...document.querySelectorAll('#routePlannerRegionDays .rp-region-day')].map((el,i)=>({meta:DAYS[i],regions:[...el.querySelectorAll('.rp-region-chip')].map(ch=>String(ch.textContent||'').replace(/×/g,'').trim()).map(txt=>txt.startsWith('İlçe:')?{type:'DISTRICT',value:txt.slice(5).trim()}:{type:'CITY',value:txt.replace(/^İl:\s*/,'').trim()}).filter(x=>x.value)}));
  }
  function match(d,r){return r.type==='DISTRICT'?norm(d.district)===norm(r.value):norm(cityOf(d))===norm(r.value);}

  async function build(){
    if(!activeRegionMode()||!window.ilkeRoadRouting){return originalBuild?originalBuild():undefined;}
    const sel=selections();if(!sel.some(x=>x.regions.length)){alert('Önce en az bir güne il veya ilçe ekle.');return;}
    const status=document.getElementById('routePlannerStatus');if(status)status.textContent='Bölge planı karayolu ağına göre hazırlanıyor…';
    const used=new Set(),days=[];let totalKm=0,totalMin=0,fallback=false;
    for(let i=0;i<sel.length;i++){
      const x=sel[i];let ds=dealers().filter(d=>!used.has(d.id)&&x.regions.some(r=>match(d,r)));ds.forEach(d=>used.add(d.id));
      const located=ds.filter(valid),missing=ds.filter(d=>!valid(d));
      if(located.length){
        const r=await window.ilkeRoadRouting.optimizeDealers(located,home(),(a,b)=>{if(status)status.textContent=x.meta.label+' yol ağı hesaplanıyor: '+a+' / '+b;});
        fallback=fallback||!String(r.mode||'').startsWith('road');totalKm+=r.roadKm||0;totalMin+=r.roadMinutes||0;days.push({...x.meta,regions:x.regions,dealers:[...r.dealers,...missing]});
      }else days.push({...x.meta,regions:x.regions,dealers:missing});
    }
    plan={staffId:staffId(),days,totalKm,totalMin,fallback,createdAt:new Date().toISOString()};
    const sum=document.getElementById('routePlannerSummary'),box=document.getElementById('routePlannerResult');
    const all=days.flatMap(x=>x.dealers);
    if(sum)sum.innerHTML='<div class="rp-summary-grid"><div class="item"><strong>'+all.length+'</strong><div class="muted">Toplam bayi</div></div><div class="item"><strong>12</strong><div class="muted">İş günü</div></div><div class="item"><strong>'+Math.round(totalKm)+' km</strong><div class="muted">Karayolu toplam</div></div><div class="item"><strong>'+Math.round(totalMin/60)+' sa</strong><div class="muted">Tahmini sürüş</div></div></div>'+(fallback?'<div class="note"><span class="badge b-warn">Yedek mod</span> Bazı yol verileri alınamadı.</div>':'<div class="note"><span class="badge b-ok">Yol ağı</span> Bölge günlerinin iç sırası karayolu sürüşüne göre hesaplandı.</div>');
    if(box)box.innerHTML=days.map(x=>'<div class="rp-day"><h4>'+esc(x.label)+' <span class="badge b-info">'+x.dealers.length+' bayi</span></h4>'+(x.dealers.length?x.dealers.map((d,j)=>'<div class="rp-stop"><div class="rp-mini-num">'+(j+1)+'</div><div><strong>'+esc(d.name)+'</strong><div class="muted">'+esc(d.district||'')+(!valid(d)?' <span class="rp-est">konum yok</span>':'')+'</div></div></div>').join(''):'<div class="muted">Bu gün için bayi yok.</div>')+'</div>').join('');
    const info=document.getElementById('routePlannerMapInfo');if(info)info.textContent=fallback?'Bölge planında bazı hesaplar yedek mesafe ile yapıldı.':'Bölge planının günlük sıraları gerçek karayolu sürüşüne göre oluşturuldu.';
    if(status)status.textContent='Bölge bazlı karayolu planı hazır.';
  }

  async function approve(){
    if(!activeRegionMode()||!plan)return originalApprove?originalApprove():undefined;
    if(plan.staffId!==staffId()){alert('Personel değişti. Planı yeniden oluştur.');return;}
    const type=document.getElementById('routePlannerTarget')?.value||'ROUTE1',now=new Date().toISOString();
    if(!confirm((type==='ROUTE1'?'Rut Planı':'Rut Planı2')+' bu bölge bazlı karayolu planıyla değiştirilsin mi?'))return;
    const payload=plan.days.map(x=>({organization_id:teamContext.organizationId,plan_type:type,staff_user_id:staffId(),week_no:x.week,day_name:x.day,dealer_ids:x.dealers.map(d=>d.id),updated_by:cloudUser.id,updated_at:now}));
    const {error}=await supabaseClient.from('route_plan_templates').upsert(payload,{onConflict:'organization_id,plan_type,staff_user_id,week_no,day_name'});if(error){alert('Plan kaydedilemedi: '+error.message);return;}
    if(type==='ROUTE1'){
      const placed=new Map();plan.days.forEach(x=>x.dealers.forEach((d,i)=>placed.set(d.id,{x,i})));
      for(const d of dealers()){
        const p=placed.get(d.id),vals=p?{planned_week:p.x.week+'. HAFTA',planned_day:p.x.day,planned_order:p.i+1}:{planned_week:null,planned_day:null,planned_order:null};
        const {error:e}=await supabaseClient.from('organization_dealers').update({...vals,updated_by:cloudUser.id,updated_at:now}).eq('organization_id',teamContext.organizationId).eq('id',d.id);if(e){alert('Bayi planı güncellenemedi: '+e.message);return;}
        d.plannedWeek=vals.planned_week;d.plannedDay=vals.planned_day;d.plannedOrder=vals.planned_order;
      }
      try{localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){ }
    }
    const status=document.getElementById('routePlannerStatus');if(status)status.textContent='Bölge bazlı karayolu planı kaydedildi.';
  }

  function patch(){
    if(!window.ilkeRoadRouting||typeof window.buildRoutePlanFromRegions!=='function'||typeof window.approveTwoWeekRoutePlan!=='function')return false;
    if(!originalBuild){originalBuild=window.buildRoutePlanFromRegions;window.buildRoutePlanFromRegions=build;}
    if(!originalApprove){originalApprove=window.approveTwoWeekRoutePlan;window.approveTwoWeekRoutePlan=approve;}
    return true;
  }
  function start(){clearInterval(t);let n=0;t=setInterval(()=>{n++;if(patch()||n>120)clearInterval(t);},120);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();