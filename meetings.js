if(!Array.isArray(state.meetingNotes)) state.meetingNotes=[];

function saveMeetingNote(){
  const titleEl=document.getElementById('meetingTitle');
  const noteEl=document.getElementById('meetingNote');
  const dateEl=document.getElementById('meetingDate');

  if(!titleEl || !noteEl || !dateEl){
    alert('Toplantı notu formu yüklenemedi. Sayfayı yenileyip tekrar dene.');
    return;
  }

  const title=titleEl.value.trim();
  const note=noteEl.value.trim();
  const meetingDate=dateEl.value||'';

  if(!title && !note){
    alert('Başlık veya not gir.');
    return;
  }

  state.meetingNotes.push({
    id:crypto.randomUUID(),
    title:title||'Toplantı Notu',
    note,
    meetingDate,
    status:'open',
    createdAt:new Date().toISOString(),
    _ownerUserId:typeof cloudUser!=='undefined'&&cloudUser?cloudUser.id:null,
    _actorUserId:typeof cloudUser!=='undefined'&&cloudUser?cloudUser.id:null,
    _actorName:typeof cloudUser!=='undefined'&&cloudUser?((typeof teamProfilesById!=='undefined'&&teamProfilesById.get(cloudUser.id)?.full_name)||'Ben'):'Ben'
  });

  titleEl.value='';
  noteEl.value='';
  dateEl.value='';

  persist();
  if(typeof logActivity==='function') logActivity('MEETING_NOTE_ADDED','MEETING_NOTE',state.meetingNotes[state.meetingNotes.length-1].id,{
    title:title||'Toplantı Notu',
    note,
    meetingDate
  });
  renderMeetingNotes();
}

async function toggleMeetingNote(id){
  const item=state.meetingNotes.find(x=>x.id===id); if(!item)return;
  const newStatus=item.status==='done'?'open':'done';
  if(typeof cloudUser!=='undefined'&&cloudUser&&item._ownerUserId&&item._ownerUserId!==cloudUser.id){
    if(teamContext?.role!=='MANAGER'){alert('Bu not başka bir kullanıcıya ait.');return}
    const {error}=await supabaseClient.from('meeting_notes').update({status:newStatus,updated_at:new Date().toISOString()}).eq('user_id',item._ownerUserId).eq('id',id);
    if(error){alert('Toplantı notu güncellenemedi: '+error.message);return}
  }
  item.status=newStatus; persist();
  if(typeof logActivity==='function'&&item.status==='done') logActivity('MEETING_NOTE_DONE','MEETING_NOTE',id,{title:item.title,owner:item._actorName||''});
  renderMeetingNotes();
}

async function deleteMeetingNote(id){
  const item=state.meetingNotes.find(x=>x.id===id); if(!item)return;
  if(!confirm('Bu toplantı notu silinsin mi?'))return;
  if(typeof cloudUser!=='undefined'&&cloudUser&&item._ownerUserId&&item._ownerUserId!==cloudUser.id){
    if(teamContext?.role!=='MANAGER'){alert('Bu not başka bir kullanıcıya ait.');return}
    const {error}=await supabaseClient.from('meeting_notes').delete().eq('user_id',item._ownerUserId).eq('id',id);
    if(error){alert('Toplantı notu silinemedi: '+error.message);return}
  }
  state.meetingNotes=state.meetingNotes.filter(x=>x.id!==id); persist(); renderMeetingNotes();
}

function renderMeetingNotes(){
  const list=document.getElementById('meetingNotesList');
  if(!list)return;

  const filterEl=document.getElementById('meetingFilter');
  const filter=filterEl?.value||'open';

  const ownerFilterEl=document.getElementById('meetingOwnerFilter');
  const isManager=typeof teamContext!=='undefined'&&teamContext?.role==='MANAGER';
  if(ownerFilterEl){
    if(isManager){
      ownerFilterEl.style.display='';
      const current=ownerFilterEl.value||'all';
      const people=[...new Map(state.meetingNotes.map(x=>[x._actorUserId||x._ownerUserId,{id:x._actorUserId||x._ownerUserId,name:x._actorName||x._actorUsername||'Kullanıcı'}])).values()].filter(x=>x.id);
      ownerFilterEl.innerHTML='<option value="all">Tüm Personel</option>'+people.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');
      if([...ownerFilterEl.options].some(o=>o.value===current)) ownerFilterEl.value=current;
    }else ownerFilterEl.style.display='none';
  }
  let items=[...state.meetingNotes].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  if(isManager&&ownerFilterEl?.value&&ownerFilterEl.value!=='all') items=items.filter(x=>(x._actorUserId||x._ownerUserId)===ownerFilterEl.value);
  if(filter==='open')items=items.filter(x=>x.status!=='done');
  if(filter==='done')items=items.filter(x=>x.status==='done');

  const total=state.meetingNotes.length;
  const openCount=state.meetingNotes.filter(x=>x.status!=='done').length;
  const doneCount=total-openCount;
  const summary=document.getElementById('meetingNoteCountSummary');
  if(summary)summary.textContent='Toplam '+total+' not • '+openCount+' açık • '+doneCount+' tamamlanan';

  list.innerHTML=items.length?items.map(x=>{
    const done=x.status==='done';
    return '<div class="item" style="'+(done?'opacity:.65;background:#f8fafc;':'')+'">'+
      '<div class="toolbar" style="justify-content:space-between;margin-bottom:6px">'+
      '<div><strong>'+esc(x.title||'Toplantı Notu')+'</strong>'+
      (x.meetingDate?'<span class="muted">Toplantı: '+esc(x.meetingDate)+'</span>':'')+'</div>'+
      '<div class="toolbar" style="margin:0">'+
      '<button class="btn '+(done?'btn-ghost':'btn-primary')+'" onclick="toggleMeetingNote(\''+x.id+'\')">'+(done?'↩ Açık Konuya Al':'✓ Konuşuldu')+'</button>'+
      '<button class="btn btn-danger" onclick="deleteMeetingNote(\''+x.id+'\')">Sil</button>'+
      '</div></div>'+
      (x.note?'<div>'+esc(x.note)+'</div>':'')+
      (isManager?'<div class="muted" style="margin-top:8px"><strong>Ekleyen:</strong> '+esc(x._actorName||x._actorUsername||'Kullanıcı')+'</div>':'')+
      '<div class="muted" style="margin-top:4px">Eklendi: '+new Date(x.createdAt).toLocaleString('tr-TR')+'</div>'+
      '</div>';
  }).join(''):'<div class="muted">Bu filtrede toplantı notu yok.</div>';
}

function cloudMeetingRowToLocal(m){
  const actorId=m.actor_user_id||m.user_id;
  const profile=(typeof teamProfilesById!=='undefined'&&teamProfilesById)?teamProfilesById.get(actorId)||{}:{};
  return {
    id:m.id,
    title:m.title||'Toplantı Notu',
    note:m.note||'',
    meetingDate:m.meeting_date||'',
    status:m.status||'open',
    createdAt:m.created_at||m.updated_at||new Date().toISOString(),
    _ownerUserId:m.user_id,
    _actorUserId:actorId,
    _actorName:profile.full_name||profile.username||profile.email||'Kullanıcı',
    _actorUsername:profile.username||''
  };
}

let meetingSyncSafetyInstalled=false;
function installMeetingSyncSafety(){
  if(meetingSyncSafetyInstalled)return;
  if(typeof syncStateToCloud!=='function'||typeof supabaseClient==='undefined')return;

  const originalSync=syncStateToCloud;
  window.syncStateToCloud=async function(initial=false){
    if(cloudUser&&supabaseClient&&!cloudHydrating){
      try{
        // Eski telefon/sekme state'i buluttaki daha yeni toplantı notlarını silmesin.
        // Ana sync halen replace mantığı kullandığı için önce buluttaki mevcut kayıtları
        // local state'e eksiksiz birleştiriyoruz.
        const {data,error}=await supabaseClient.from('meeting_notes')
          .select('*')
          .eq('user_id',cloudUser.id);
        if(!error&&Array.isArray(data)){
          const ids=new Set((state.meetingNotes||[]).map(x=>x.id));
          for(const row of data){
            if(!ids.has(row.id)){
              state.meetingNotes.push(cloudMeetingRowToLocal(row));
              ids.add(row.id);
            }
          }
        }
      }catch(err){
        console.warn('Meeting sync safety merge failed',err);
      }
    }
    return originalSync(initial);
  };
  meetingSyncSafetyInstalled=true;
}

async function recoverMeetingNotesFromBackups(){
  if(!cloudUser||!supabaseClient){alert('Önce giriş yapmalısın.');return}

  try{
    const [{data:current,error:currentErr},{data:backups,error:backupErr},{data:activity,error:activityErr}]=await Promise.all([
      supabaseClient.from('meeting_notes').select('*').eq('user_id',cloudUser.id),
      supabaseClient.from('data_backups').select('id,label,snapshot,created_at').eq('user_id',cloudUser.id).order('created_at',{ascending:false}),
      supabaseClient.from('activity_log').select('id,entity_id,details,created_at')
        .eq('organization_id',teamContext.organizationId)
        .eq('actor_user_id',cloudUser.id)
        .eq('action','MEETING_NOTE_ADDED')
        .order('created_at',{ascending:true})
    ]);
    if(currentErr)throw currentErr;
    if(backupErr)throw backupErr;

    const existingIds=new Set((current||[]).map(x=>x.id));
    const recoveredMap=new Map();

    for(const b of (backups||[])){
      let snapshot=b.snapshot;
      if(typeof snapshot==='string'){
        try{snapshot=JSON.parse(snapshot)}catch(_){snapshot=null}
      }
      const notes=Array.isArray(snapshot?.meetingNotes)?snapshot.meetingNotes:[];
      for(const n of notes){
        if(!n?.id||existingIds.has(n.id)||recoveredMap.has(n.id))continue;
        recoveredMap.set(n.id,{
          id:n.id,
          user_id:cloudUser.id,
          organization_id:teamContext.organizationId,
          actor_user_id:n._actorUserId||n._ownerUserId||cloudUser.id,
          title:n.title||'Toplantı Notu',
          note:n.note||'',
          meeting_date:n.meetingDate||null,
          status:n.status||'open',
          created_at:n.createdAt||b.created_at||new Date().toISOString(),
          updated_at:new Date().toISOString()
        });
      }
    }

    const recoverable=[...recoveredMap.values()];
    const activityMissing=(activityErr?[]:(activity||[])).filter(a=>a.entity_id&&!existingIds.has(a.entity_id)&&!recoveredMap.has(a.entity_id));

    if(!recoverable.length){
      let msg='Yedeklerde geri getirilebilecek eksik toplantı notu bulunamadı.';
      if(activityMissing.length){
        msg+='\n\nAncak aktivite geçmişinde '+activityMissing.length+' eski toplantı notu ekleme kaydı görünüyor. Bunların tam not metni eski aktivite kayıtlarına yazılmadığı için otomatik geri yüklenemiyor.';
        const names=activityMissing.slice(0,10).map(a=>'• '+(a.details?.title||'Toplantı Notu')).join('\n');
        if(names)msg+='\n\n'+names;
      }
      alert(msg);
      return;
    }

    const preview=recoverable.slice(0,12).map(n=>'• '+n.title+(n.note?' — '+n.note.slice(0,70):'')).join('\n');
    if(!confirm(
      recoverable.length+' eksik toplantı notu yedeklerde bulundu.\n\n'+preview+
      (recoverable.length>12?'\n• ...':'')+'\n\nBu notlar geri getirilsin mi?'
    ))return;

    const {error}=await supabaseClient.from('meeting_notes').upsert(recoverable,{onConflict:'user_id,id'});
    if(error)throw error;

    if(typeof loadStateFromCloud==='function')await loadStateFromCloud();
    if(document.getElementById('meetingFilter'))meetingFilter.value='all';
    renderMeetingNotes();
    alert(recoverable.length+' toplantı notu geri getirildi. Filtre “Tümü” olarak açıldı.');
  }catch(err){
    console.error('Meeting note recovery failed',err);
    alert('Toplantı notu kurtarma işlemi başarısız: '+(err.message||err));
  }
}

function installMeetingRecoveryUi(){
  const list=document.getElementById('meetingNotesList');
  if(!list)return;
  const card=list.closest('.card');
  if(!card||document.getElementById('meetingRecoveryActions'))return;

  const bar=document.createElement('div');
  bar.id='meetingRecoveryActions';
  bar.className='toolbar';
  bar.style.cssText='margin:10px 0 12px;justify-content:space-between;align-items:center;flex-wrap:wrap';
  bar.innerHTML='<div id="meetingNoteCountSummary" class="muted"></div>'+ 
    '<button class="btn btn-ghost" onclick="recoverMeetingNotesFromBackups()">Yedekten Eksik Notları Kontrol Et</button>';
  list.parentNode.insertBefore(bar,list);
  renderMeetingNotes();
}

// renderAll davranışını bozmak yerine, mevcut renderAll'i güvenli şekilde sar.
const baseRenderAll=window.renderAll;
window.renderAll=function(){
  if(typeof baseRenderAll==='function') baseRenderAll();
  renderMeetingNotes();
};

document.addEventListener('DOMContentLoaded',()=>{
  renderMeetingNotes();
  installMeetingRecoveryUi();
  setTimeout(installMeetingSyncSafety,0);
});

// cloud.js bu dosyadan sonra yükleniyor; auth veya yeniden render sonrası güvenlik katmanını tekrar teyit et.
window.addEventListener('load',()=>{
  installMeetingSyncSafety();
  installMeetingRecoveryUi();
});
