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
  if(typeof logActivity==='function') logActivity('MEETING_NOTE_ADDED','MEETING_NOTE',state.meetingNotes[state.meetingNotes.length-1].id,{title:title||'Toplantı Notu'});
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

// renderAll davranışını bozmak yerine, mevcut renderAll'i güvenli şekilde sar.
const baseRenderAll=window.renderAll;
window.renderAll=function(){
  if(typeof baseRenderAll==='function') baseRenderAll();
  renderMeetingNotes();
};

document.addEventListener('DOMContentLoaded',()=>renderMeetingNotes());
