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
    createdAt:new Date().toISOString()
  });

  titleEl.value='';
  noteEl.value='';
  dateEl.value='';

  persist();
  renderMeetingNotes();
}

function toggleMeetingNote(id){
  const item=state.meetingNotes.find(x=>x.id===id);
  if(!item)return;
  item.status=item.status==='done'?'open':'done';
  persist();
  renderMeetingNotes();
}

function deleteMeetingNote(id){
  if(!confirm('Bu toplantı notu silinsin mi?'))return;
  state.meetingNotes=state.meetingNotes.filter(x=>x.id!==id);
  persist();
  renderMeetingNotes();
}

function renderMeetingNotes(){
  const list=document.getElementById('meetingNotesList');
  if(!list)return;

  const filterEl=document.getElementById('meetingFilter');
  const filter=filterEl?.value||'open';

  let items=[...state.meetingNotes].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
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
      '<div class="muted" style="margin-top:8px">Eklendi: '+new Date(x.createdAt).toLocaleString('tr-TR')+'</div>'+
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
