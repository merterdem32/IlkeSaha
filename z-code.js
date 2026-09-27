let zCodeRegistryCache=[];

async function loadZCodeRegistry(){
  if(!supabaseClient||!cloudUser||!teamContext?.organizationId)return [];
  const {data,error}=await supabaseClient
    .from('z_code_registry')
    .select('organization_id,cari_code,display_name,dealer_id,source,is_active,updated_at')
    .eq('organization_id',teamContext.organizationId)
    .eq('is_active',true)
    .order('display_name');
  if(error) throw error;
  zCodeRegistryCache=data||[];
  return zCodeRegistryCache;
}

function zLinkedDealer(row){
  if(!row?.dealer_id)return null;
  return state.dealers.find(d=>d.id===row.dealer_id)||null;
}

function populateZDealerSelect(){
  const el=document.getElementById('zDealerSelect');
  if(!el)return;
  const candidates=state.dealers
    .filter(d=>d.isActive!==false && !d.isZCode)
    .filter(d=>typeof dealerVisibleToCurrentUser!=='function'||dealerVisibleToCurrentUser(d))
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'tr'));
  el.innerHTML='<option value="">Bayi seç</option>'+candidates.map(d=>
    '<option value="'+esc(d.id)+'">'+esc(d.name)+(d.district?' • '+esc(d.district):'')+'</option>'
  ).join('');
}

function renderZCodePage(){
  const q=(document.getElementById('zCodeSearch')?.value||'').trim().toLocaleLowerCase('tr-TR');
  const list=document.getElementById('zCodeList');
  const summary=document.getElementById('zCodeSummary');
  if(!list||!summary)return;

  const rows=zCodeRegistryCache.filter(r=>{
    const d=zLinkedDealer(r);
    const hay=[r.cari_code,r.display_name,d?.name,d?.district].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');
    return !q||hay.includes(q);
  });

  const linked=zCodeRegistryCache.filter(r=>r.dealer_id).length;
  const unlinked=zCodeRegistryCache.length-linked;
  summary.innerHTML='<strong>'+zCodeRegistryCache.length+' aktif Z kodlu kayıt</strong> • '+
    linked+' bayi kaydına bağlı'+(unlinked?' • <span class="badge b-warn">'+unlinked+' bağımsız kayıt</span>':'');

  list.innerHTML=rows.length?rows.map(r=>{
    const d=zLinkedDealer(r);
    return '<div class="item z-code-item">'+
      '<div class="z-code-main">'+
        '<div><span class="badge b-zcode">Z KODLU</span> <strong>'+esc(r.display_name)+'</strong></div>'+
        '<div class="muted">Cari kod: '+esc(r.cari_code||'-')+
          (r.source?' • Kaynak: '+esc(r.source):'')+
          (d?' • '+esc(d.district||''):'')+
        '</div>'+
        (d
          ? '<div class="muted">Bayi kaydıyla eşleşti: <strong>'+esc(d.name)+'</strong></div>'
          : '<div class="muted">Bu kayıt henüz Bayiler listesindeki bir kayıtla eşleşmiyor.</div>')+
      '</div>'+
      '<div class="toolbar z-code-actions" style="margin:0">'+
        (d?'<button class="btn btn-ghost" onclick="showDealer(\''+d.id+'\')">Bayiyi Aç</button>':'')+
        '<button class="btn btn-danger" onclick="removeZCodeEntry(\''+String(r.cari_code).replaceAll("'","\\'")+'\')">Z Kodundan Çıkar</button>'+
      '</div>'+
    '</div>';
  }).join(''):'<div class="muted">Aramaya uygun Z kodlu kayıt yok.</div>';

  populateZDealerSelect();
}

async function prepareZCodePage(){
  const summary=document.getElementById('zCodeSummary');
  if(summary)summary.textContent='Z kodlu liste yükleniyor…';
  try{
    await loadZCodeRegistry();
    renderZCodePage();
  }catch(err){
    console.error('Z-code load failed',err);
    if(summary)summary.textContent='Z kodlu liste yüklenemedi: '+(err.message||err);
  }
}

async function addExistingDealerAsZ(){
  if(!supabaseClient||!cloudUser)return;
  const dealerId=document.getElementById('zDealerSelect')?.value||'';
  const cari=(document.getElementById('zDealerCari')?.value||'').trim();
  if(!dealerId){alert('Önce bayi seç.');return}
  const dealer=state.dealers.find(d=>d.id===dealerId);
  if(!dealer){alert('Bayi bulunamadı.');return}

  const {error}=await supabaseClient.rpc('set_dealer_z_code',{
    target_org:teamContext.organizationId,
    target_dealer_id:dealerId,
    target_is_z:true,
    target_cari_code:cari||null
  });
  if(error){alert('Z kodu eklenemedi: '+error.message);return}

  dealer.isZCode=true;
  if(cari)dealer.cariCode=cari;
  document.getElementById('zDealerCari').value='';
  await prepareZCodePage();
  if(typeof renderDealers==='function')renderDealers();
  if(typeof renderRoute==='function')renderRoute();
}

async function addManualZEntry(){
  if(!supabaseClient||!cloudUser)return;
  const cari=(document.getElementById('zManualCari')?.value||'').trim();
  const name=(document.getElementById('zManualName')?.value||'').trim();
  if(!cari||!name){alert('Cari kod ve ünvan gerekli.');return}

  const {error}=await supabaseClient.rpc('upsert_z_code_registry',{
    target_org:teamContext.organizationId,
    target_cari_code:cari,
    target_display_name:name
  });
  if(error){alert('Z kodlu kayıt eklenemedi: '+error.message);return}

  document.getElementById('zManualCari').value='';
  document.getElementById('zManualName').value='';
  await prepareZCodePage();
}

async function removeZCodeEntry(cariCode){
  if(!confirm('Bu kaydı Z kodlu listesinden çıkarmak istiyor musun? Bayi kaydı silinmeyecek.'))return;
  const row=zCodeRegistryCache.find(x=>x.cari_code===cariCode);
  const {error}=await supabaseClient.rpc('remove_z_code_registry',{
    target_org:teamContext.organizationId,
    target_cari_code:cariCode
  });
  if(error){alert('Z kodu kaldırılamadı: '+error.message);return}

  if(row?.dealer_id){
    const d=state.dealers.find(x=>x.id===row.dealer_id);
    if(d)d.isZCode=false;
  }
  await prepareZCodePage();
  if(typeof renderDealers==='function')renderDealers();
  if(typeof renderRoute==='function')renderRoute();
}
