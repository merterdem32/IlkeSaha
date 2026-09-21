let currentDailyReport={html:'',whatsappText:'',fileName:'',data:null};

async function prepareDailyReportControls(){
  if(!cloudUser||!supabaseClient)return;
  const dateEl=document.getElementById('dailyReportDate');
  const staffEl=document.getElementById('dailyReportStaff');
  if(!dateEl||!staffEl)return;

  if(!dateEl.value)dateEl.value=todayStr();

  if(teamContext?.role==='MANAGER'){
    staffEl.style.display='';
    if(typeof loadManagerDirectory==='function')await loadManagerDirectory();
    const staff=activeFieldStaffDirectory();
    const current=staffEl.value;
    staffEl.innerHTML='<option value="all">Tüm saha personeli</option>'+staff.map(s=>{
      const label=s.fullName||s.username||s.email||s.userId;
      return '<option value="'+esc(s.userId)+'">'+esc(label)+(s.username?' ('+esc(s.username)+')':'')+'</option>';
    }).join('');
    if(current&&[...staffEl.options].some(o=>o.value===current))staffEl.value=current;
  }else{
    staffEl.innerHTML='<option value="'+esc(cloudUser.id)+'">Benim raporum</option>';
    staffEl.value=cloudUser.id;
    staffEl.style.display='none';
  }

  await loadDailyReport();
}

async function loadDailyReport(){
  if(!cloudUser||!supabaseClient)return;
  const date=document.getElementById('dailyReportDate')?.value||todayStr();
  const staffId=document.getElementById('dailyReportStaff')?.value||
    (teamContext?.role==='FIELD_STAFF'?cloudUser.id:'all');
  const preview=document.getElementById('dailyReportPreview');
  const summary=document.getElementById('dailyReportSummary');
  if(!preview||!summary)return;

  summary.textContent='Rapor hazırlanıyor…';
  preview.innerHTML='';

  const start=date+'T00:00:00';
  const end=new Date(new Date(date+'T00:00:00').getTime()+86400000).toISOString();

  let vq=supabaseClient.from('visits')
    .select('id,user_id,actor_user_id,dealer_id,visit_date,note,follow_up')
    .eq('organization_id',teamContext.organizationId)
    .gte('visit_date',start).lt('visit_date',end);

  let pq=supabaseClient.from('payment_promises')
    .select('id,user_id,actor_user_id,dealer_id,amount,promise_date,status,note,created_at')
    .eq('organization_id',teamContext.organizationId)
    .gte('created_at',start).lt('created_at',end);

  if(staffId!=='all'){
    vq=vq.eq('actor_user_id',staffId);
    pq=pq.eq('actor_user_id',staffId);
  }

  const [vRes,pRes]=await Promise.all([vq,pq]);
  if(vRes.error||pRes.error){
    summary.textContent='Rapor yüklenemedi: '+(vRes.error?.message||pRes.error?.message);
    return;
  }

  const visits=vRes.data||[];
  const payments=pRes.data||[];
  const grouped=new Map();

  visits.forEach(v=>{
    if(!grouped.has(v.dealer_id))grouped.set(v.dealer_id,{dealerId:v.dealer_id,visits:[],notes:[],followUps:[],actors:new Set()});
    const g=grouped.get(v.dealer_id);
    g.visits.push(v);
    if(String(v.note||'').trim())g.notes.push(String(v.note).trim());
    if(String(v.follow_up||'').trim())g.followUps.push(String(v.follow_up).trim());
    if(v.actor_user_id||v.user_id)g.actors.add(v.actor_user_id||v.user_id);
  });

  const entries=[...grouped.values()].sort((a,b)=>{
    const ta=new Date(a.visits[0]?.visit_date||0);
    const tb=new Date(b.visits[0]?.visit_date||0);
    return ta-tb;
  });

  const staffName=staffId==='all'
    ? 'Tüm Saha Ekibi'
    : salespersonLabel(staffId);
  const dateLabel=new Date(date+'T12:00:00').toLocaleDateString('tr-TR',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
  const totalAmount=payments.reduce((s,p)=>s+Number(p.amount||0),0);

  const reportRows=entries.map((g,i)=>{
    const d=state.dealers.find(x=>x.id===g.dealerId);
    const actorNames=[...g.actors].map(salespersonLabel);
    const notes=[...new Set(g.notes)];
    const follows=[...new Set(g.followUps)];
    const firstTime=g.visits.map(v=>new Date(v.visit_date)).sort((a,b)=>a-b)[0];

    return '<div style="border:1px solid #dbe3ee;border-radius:10px;padding:12px;margin:0 0 10px;page-break-inside:avoid">'+
      '<div style="font-size:16px;font-weight:700">'+(i+1)+'. '+esc(d?.name||g.dealerId)+'</div>'+
      '<div style="font-size:12px;color:#64748b;margin-top:3px">'+
        esc(d?.district||'')+(firstTime?' • '+firstTime.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}):'')+
        (teamContext?.role==='MANAGER'&&actorNames.length?' • '+esc(actorNames.join(', ')):'')+
      '</div>'+
      '<div style="margin-top:8px"><strong>Görüşme Notu:</strong> '+(notes.length?notes.map(esc).join('<br>'):'Not girilmedi')+'</div>'+
      (follows.length?'<div style="margin-top:6px"><strong>Takip:</strong> '+follows.map(esc).join(', ')+'</div>':'')+
    '</div>';
  }).join('');

  const paymentRows=payments.length?payments.map(p=>{
    const d=state.dealers.find(x=>x.id===p.dealer_id);
    return '<div style="font-size:13px;margin:4px 0">• '+esc(d?.name||p.dealer_id)+' — '+fmtMoney(p.amount)+' — söz: '+esc(p.promise_date||'-')+(p.note?' — '+esc(p.note):'')+'</div>';
  }).join(''):'<div style="color:#64748b">Bugün yeni ödeme sözü kaydı yok.</div>';

  const html='<div style="font-family:Arial,sans-serif;color:#172033;padding:8px">'+
    '<div style="border-bottom:2px solid #172033;padding-bottom:10px;margin-bottom:14px">'+
      '<div style="font-size:22px;font-weight:800">İLKE AKÜ — GÜN SONU SAHA RAPORU</div>'+
      '<div style="margin-top:4px">'+esc(dateLabel)+' • '+esc(staffName)+'</div>'+
    '</div>'+
    '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:16px">'+
      '<div><strong>'+entries.length+'</strong> ziyaret edilen bayi</div>'+
      '<div><strong>'+payments.length+'</strong> ödeme sözü</div>'+
      '<div><strong>'+fmtMoney(totalAmount)+'</strong> ödeme sözü toplamı</div>'+
    '</div>'+
    '<h3 style="margin:0 0 10px">Bayi Görüşmeleri</h3>'+
    (reportRows||'<div>Bu tarihte ziyaret kaydı yok.</div>')+
    '<h3 style="margin:18px 0 8px">Ödeme Sözleri</h3>'+paymentRows+
    '<div style="margin-top:18px;font-size:11px;color:#64748b">İlke Saha tarafından oluşturuldu.</div>'+
  '</div>';

  const textLines=[
    '*İLKE AKÜ - GÜN SONU SAHA RAPORU*',
    dateLabel+' | '+staffName,
    '',
    'Ziyaret edilen bayi: '+entries.length,
    'Ödeme sözü: '+payments.length+(payments.length?' / '+fmtMoney(totalAmount):''),
    '',
    '*BAYİ GÖRÜŞMELERİ*'
  ];

  entries.forEach((g,i)=>{
    const d=state.dealers.find(x=>x.id===g.dealerId);
    const notes=[...new Set(g.notes)];
    const follows=[...new Set(g.followUps)];
    textLines.push('');
    textLines.push((i+1)+'. '+(d?.name||g.dealerId)+(d?.district?' - '+d.district:''));
    textLines.push('Not: '+(notes.length?notes.join(' | '):'Not girilmedi'));
    if(follows.length)textLines.push('Takip: '+follows.join(', '));
  });

  if(payments.length){
    textLines.push('');
    textLines.push('*ÖDEME SÖZLERİ*');
    payments.forEach(p=>{
      const d=state.dealers.find(x=>x.id===p.dealer_id);
      textLines.push('• '+(d?.name||p.dealer_id)+': '+fmtMoney(p.amount)+' / '+(p.promise_date||'-')+(p.note?' / '+p.note:''));
    });
  }

  currentDailyReport={
    html,
    whatsappText:textLines.join('\n'),
    fileName:'IlkeSaha_'+date+'_'+String(staffName).replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ_-]+/g,'_')+'.pdf',
    data:{date,staffId,entries,payments}
  };

  preview.innerHTML=html;
  summary.innerHTML='<strong>'+esc(staffName)+'</strong> • '+esc(dateLabel)+' • '+entries.length+' bayi ziyareti • '+payments.length+' ödeme sözü';
}

async function downloadDailyReportPdf(){
  if(!currentDailyReport.html)await loadDailyReport();
  const el=document.getElementById('dailyReportPreview');
  if(!el)return;

  if(typeof html2pdf==='undefined'){
    alert('PDF modülü yüklenemedi. İnternet bağlantısını kontrol edip sayfayı yenile.');
    return;
  }

  const opt={
    margin:8,
    filename:currentDailyReport.fileName||'IlkeSaha_GunSonuRaporu.pdf',
    image:{type:'jpeg',quality:0.98},
    html2canvas:{scale:2,useCORS:true},
    jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
    pagebreak:{mode:['avoid-all','css','legacy']}
  };
  await html2pdf().set(opt).from(el).save();
}

async function shareDailyReportWhatsApp(){
  if(!currentDailyReport.whatsappText)await loadDailyReport();
  const text=currentDailyReport.whatsappText||'';
  if(!text){alert('Gönderilecek rapor bulunamadı.');return}
  window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener');
}
