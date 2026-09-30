let personalNotesCache=[];
let personalNotesLoaded=false;

function personalNoteCategoryLabel(value){
  return ({
    GENEL:'Genel',
    IS:'İş',
    SISTEM:'Sistem',
    BAYI:'Bayi',
    FIKIR:'Fikir',
    YAPILACAK:'Yapılacak'
  })[value]||'Genel';
}

async function preparePersonalNotes(force=false){
  if(!cloudUser||!supabaseClient||!teamContext?.organizationId)return;
  if(personalNotesLoaded&&!force){
    renderPersonalNotes();
    return;
  }

  const list=document.getElementById('personalNotesList');
  const status=document.getElementById('personalNotesStatus');
  if(status)status.textContent='Notların yükleniyor…';

  const {data,error}=await supabaseClient
    .from('personal_notes')
    .select('id,title,note,category,due_date,status,created_at,updated_at')
    .eq('organization_id',teamContext.organizationId)
    .eq('user_id',cloudUser.id)
    .order('updated_at',{ascending:false});

  if(error){
    personalNotesLoaded=false;
    if(status)status.innerHTML='<span class="badge b-warn">Kendime Not tablosu henüz kurulmamış olabilir.</span> Supabase SQL Editor’da <strong>supabase-team-phase8-personal-notes.sql</strong> dosyasını bir kez çalıştır.';
    if(list)list.innerHTML='<div class="muted">Veritabanı kurulumu tamamlandıktan sonra notların burada görünecek.</div>';
    return;
  }

  personalNotesCache=data||[];
  personalNotesLoaded=true;
  if(status)status.textContent=personalNotesCache.length+' not';
  renderPersonalNotes();
}

async function savePersonalNote(){
  if(!cloudUser||!supabaseClient){alert('Önce giriş yapmalısın.');return}

  const title=(document.getElementById('personalNoteTitle')?.value||'').trim();
  const note=(document.getElementById('personalNoteBody')?.value||'').trim();
  const category=document.getElementById('personalNoteCategory')?.value||'GENEL';
  const dueDate=document.getElementById('personalNoteDueDate')?.value||null;

  if(!title&&!note){
    alert('Başlık veya not yaz.');
    return;
  }

  const {error}=await supabaseClient.from('personal_notes').insert({
    organization_id:teamContext.organizationId,
    user_id:cloudUser.id,
    title:title||'Not',
    note,
    category,
    due_date:dueDate,
    status:'OPEN'
  });

  if(error){
    alert('Not kaydedilemedi: '+error.message);
    return;
  }

  personalNoteTitle.value='';
  personalNoteBody.value='';
  personalNoteCategory.value='GENEL';
  personalNoteDueDate.value='';
  personalNotesLoaded=false;
  await preparePersonalNotes(true);
}

async function togglePersonalNote(id){
  const item=personalNotesCache.find(x=>x.id===id);
  if(!item)return;
  const next=item.status==='DONE'?'OPEN':'DONE';

  const {error}=await supabaseClient.from('personal_notes')
    .update({status:next,updated_at:new Date().toISOString()})
    .eq('id',id)
    .eq('user_id',cloudUser.id);

  if(error){alert('Not güncellenemedi: '+error.message);return}
  item.status=next;
  item.updated_at=new Date().toISOString();
  renderPersonalNotes();
}

async function deletePersonalNote(id){
  const item=personalNotesCache.find(x=>x.id===id);
  if(!item)return;
  if(!confirm('Bu not silinsin mi?'))return;

  const {error}=await supabaseClient.from('personal_notes')
    .delete()
    .eq('id',id)
    .eq('user_id',cloudUser.id);

  if(error){alert('Not silinemedi: '+error.message);return}
  personalNotesCache=personalNotesCache.filter(x=>x.id!==id);
  renderPersonalNotes();
  const status=document.getElementById('personalNotesStatus');
  if(status)status.textContent=personalNotesCache.length+' not';
}

function renderPersonalNotes(){
  const list=document.getElementById('personalNotesList');
  if(!list)return;

  const search=(document.getElementById('personalNoteSearch')?.value||'').trim().toLocaleLowerCase('tr-TR');
  const filter=document.getElementById('personalNoteFilter')?.value||'OPEN';
  const category=document.getElementById('personalNoteCategoryFilter')?.value||'ALL';

  let rows=[...personalNotesCache];
  if(filter!=='ALL')rows=rows.filter(x=>x.status===filter);
  if(category!=='ALL')rows=rows.filter(x=>x.category===category);
  if(search){
    rows=rows.filter(x=>[x.title,x.note,personalNoteCategoryLabel(x.category)]
      .join(' ').toLocaleLowerCase('tr-TR').includes(search));
  }

  rows.sort((a,b)=>{
    const ad=a.status==='DONE'?1:0, bd=b.status==='DONE'?1:0;
    if(ad!==bd)return ad-bd;
    if(a.due_date&&b.due_date&&a.due_date!==b.due_date)return a.due_date.localeCompare(b.due_date);
    if(a.due_date&&!b.due_date)return -1;
    if(!a.due_date&&b.due_date)return 1;
    return new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at);
  });

  const today=typeof todayStr==='function'?todayStr():new Date().toISOString().slice(0,10);

  list.innerHTML=rows.length?rows.map(x=>{
    const done=x.status==='DONE';
    const overdue=!done&&x.due_date&&x.due_date<today;
    const dueToday=!done&&x.due_date===today;
    const dueBadge=x.due_date
      ? '<span class="badge '+(overdue?'b-bad':dueToday?'b-warn':'b-info')+'">'+
          (overdue?'Gecikti • ':dueToday?'Bugün • ':'')+esc(x.due_date)+'</span>'
      : '';

    return '<div class="item" style="'+(done?'opacity:.65;background:#f8fafc;':'')+'">'+
      '<div class="toolbar" style="justify-content:space-between;align-items:flex-start;margin:0">'+
        '<div style="min-width:0;flex:1">'+
          '<div class="toolbar" style="margin:0 0 6px;gap:6px">'+
            '<span class="badge b-info">'+esc(personalNoteCategoryLabel(x.category))+'</span>'+
            dueBadge+
          '</div>'+
          '<strong>'+esc(x.title||'Not')+'</strong>'+
          (x.note?'<div style="white-space:pre-wrap;margin-top:7px">'+esc(x.note)+'</div>':'')+
          '<div class="muted" style="margin-top:8px">Güncellendi: '+new Date(x.updated_at||x.created_at).toLocaleString('tr-TR')+'</div>'+
        '</div>'+
        '<div class="toolbar" style="margin:0">'+
          '<button class="btn '+(done?'btn-ghost':'btn-primary')+'" onclick="togglePersonalNote(\''+x.id+'\')">'+(done?'↩ Geri Aç':'✓ Tamamlandı')+'</button>'+
          '<button class="btn btn-danger" onclick="deletePersonalNote(\''+x.id+'\')">Sil</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join(''):'<div class="muted">Bu filtrede not bulunmuyor.</div>';
}

document.addEventListener('DOMContentLoaded',()=>{
  const btn=document.querySelector('nav button[data-section="personalnotes"]');
  if(btn)btn.addEventListener('click',()=>setTimeout(()=>preparePersonalNotes(),50));
});
