// İlke Saha - mevcut gömülü Rut Planı2 kaynağını ilk kez bulut şablonuna taşır.
// Var olan kullanıcı düzenlemelerinin üzerine yazmaz; yalnızca eksik günleri seed eder.
(()=>{
  const DAY_MAP={Pazartesi:'PAZARTESİ',Salı:'SALI',Çarşamba:'ÇARŞAMBA',Perşembe:'PERŞEMBE',Cuma:'CUMA',Cumartesi:'CUMARTESİ'};
  let seeded=false;

  async function saha1UserId(){
    if(!supabaseClient||!teamContext?.organizationId)return null;
    try{
      const [mRes,pRes]=await Promise.all([
        supabaseClient.from('organization_members').select('user_id,role,is_active').eq('organization_id',teamContext.organizationId).eq('is_active',true),
        supabaseClient.from('profiles').select('user_id,username,email')
      ]);
      if(mRes.error||pRes.error)return null;
      const ids=new Set((mRes.data||[]).map(x=>x.user_id));
      const p=(pRes.data||[]).find(x=>ids.has(x.user_id)&&String(x.username||'').toLocaleLowerCase('tr-TR')==='saha1') ||
        (pRes.data||[]).find(x=>ids.has(x.user_id)&&String(x.email||'').toLocaleLowerCase('tr-TR').startsWith('saha1@'));
      return p?.user_id||null;
    }catch(_){return null;}
  }

  async function seed(){
    if(seeded)return;
    if(typeof supabaseClient==='undefined'||!supabaseClient||typeof cloudUser==='undefined'||!cloudUser||!teamContext?.organizationId)return;
    if(!window.route2Plan||!window.route2DealerBySource)return;

    const s1=await saha1UserId();
    if(!s1)return;
    // Saha personeli yalnızca kendi planını yazabilir; admin ise saha1'i seed edebilir.
    if(teamContext.role!=='MANAGER'&&cloudUser.id!==s1)return;

    try{
      const {data:existing,error}=await supabaseClient.from('route_plan_templates')
        .select('week_no,day_name')
        .eq('organization_id',teamContext.organizationId)
        .eq('plan_type','ROUTE2')
        .eq('staff_user_id',s1);
      if(error)return; // Faz 11 SQL henüz çalıştırılmadıysa sessizce bekle.

      const have=new Set((existing||[]).map(x=>String(x.week_no)+'|'+String(x.day_name)));
      const rows=[];
      for(const [key,p] of Object.entries(window.route2Plan)){
        const [week,dayLabel]=key.split('|');
        const day=DAY_MAP[dayLabel];
        if(!day||have.has(String(Number(week))+'|'+day))continue;
        const dealerIds=(p?.ids||[]).map(n=>window.route2DealerBySource(n)?.id).filter(Boolean);
        if(!dealerIds.length)continue;
        rows.push({
          organization_id:teamContext.organizationId,
          plan_type:'ROUTE2',
          staff_user_id:s1,
          week_no:Number(week),
          day_name:day,
          dealer_ids:dealerIds,
          updated_by:cloudUser.id,
          updated_at:new Date().toISOString()
        });
      }
      if(rows.length){
        const {error:upErr}=await supabaseClient.from('route_plan_templates').upsert(rows,{onConflict:'organization_id,plan_type,staff_user_id,week_no,day_name'});
        if(upErr)return;
      }
      seeded=true;
      if(cloudUser.id===s1&&typeof window.refreshRoutePlan2Templates==='function')setTimeout(()=>window.refreshRoutePlan2Templates(),80);
    }catch(_){ }
  }

  const t=setInterval(()=>{seed();if(seeded)clearInterval(t);},700);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')seed();});
})();
