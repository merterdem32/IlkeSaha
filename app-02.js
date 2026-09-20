function saveDealer(){
  if(!dealerName.value.trim()){alert('Bayi adı gerekli.');return}
  const obj={
    id:dealerId.value||crypto.randomUUID(),
    name:dealerName.value.trim(),contact:dealerContact.value.trim(),phone:dealerPhone.value.trim(),
    district:dealerDistrict.value.trim(),address:dealerAddress.value.trim(),
    lat:dealerLat.value===''?null:Number(dealerLat.value),lng:dealerLng.value===''?null:Number(dealerLng.value),
    locationStatus:(dealerLat.value===''||dealerLng.value==='')?'unset':dealerLocationStatus.value,frequency:Number(dealerFrequency.value||14),
    priority:Number(dealerPriority.value||1),generalNote:dealerGeneralNote.value.trim()
  };
  const i=state.dealers.findIndex(x=>x.id===obj.id);
  if(i>=0){
    const old=state.dealers[i];
    obj.plannedWeek=old.plannedWeek; obj.plannedDay=old.plannedDay; obj.plannedOrder=old.plannedOrder;
    obj.plannedStage=old.plannedStage; obj.originalRouteLogic=old.originalRouteLogic; obj.departure=old.departure;
    state.dealers[i]=obj;
  }else state.dealers.push(obj);
  dealerDialog.close(); persist();
}

function showDealer(id){
  const d=state.dealers.find(x=>x.id===id); if(!d)return;
  const visits=state.visits.filter(v=>v.dealerId===id).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const pays=state.payments.filter(p=>p.dealerId===id).sort((a,b)=>b.date.localeCompare(a.date));
  dealerDetail.innerHTML=
    '<div class="toolbar" style="justify-content:space-between"><div><h2 style="margin:0">'+esc(d.name)+'</h2><span class="muted">'+esc(d.district||'')+' • '+esc(d.contact||'')+'</span></div>'+
    '<div><button class="btn btn-ghost" onclick="detailDialog.close();openDealerModal(\''+id+'\')">Düzenle</button></div></div>'+
    '<div class="item"><strong>Adres</strong>'+esc(d.address||'-')+'<br><span class="badge '+(d.locationStatus==='verified'?'b-ok':d.locationStatus==='estimated'?'b-warn':'b-info')+'">'+(d.locationStatus==='verified'?'Doğrulandı':d.locationStatus==='estimated'?'Tahmini konum':'Konum henüz işaretlenmedi')+'</span></div>'+
    (d.plannedWeek?'<div class="item"><strong>Mevcut rut planındaki yeri</strong>'+esc(d.plannedWeek)+' • '+esc(d.plannedDay)+' • '+d.plannedOrder+'. sıra '+(d.plannedStage?'• '+esc(d.plannedStage):'')+'</div>':'')+
    '<div class="item"><strong>Genel not</strong>'+esc(d.generalNote||'-')+'</div>'+
    '<div class="toolbar"><button class="btn btn-primary" onclick="detailDialog.close();openVisitModal(\''+id+'\')">+ Ziyaret Kaydı</button>'+
    '<button class="btn btn-accent" onclick="detailDialog.close();openPaymentModal(\''+id+'\')">+ Ödeme Sözü</button></div>'+
    '<h3>Ziyaret geçmişi</h3>'+
    (visits.length?visits.map(v=>'<div class="note"><strong>'+new Date(v.date).toLocaleString('tr-TR')+'</strong><br>'+esc(v.note||'-')+(v.followUp?'<br><span class="muted">Takip: '+v.followUp+'</span>':'')+'</div>').join(''):'<div class="muted">Henüz ziyaret kaydı yok.</div>')+
    '<h3 style="margin-top:18px">Ödeme sözleri</h3>'+
    (pays.length?pays.map(p=>{const s=paymentStatus(p);return '<div class="payment"><strong>'+fmtMoney(p.amount)+'</strong> • '+p.date+' <span class="badge '+s.cls+'">'+s.text+'</span><br>'+esc(p.note||'')+'</div>'}).join(''):'<div class="muted">Henüz ödeme sözü yok.</div>');
  detailDialog.showModal();
}

function openVisitModal(id){
  visitDealerId.value=id; visitDate.value=dtLocalNow(); visitNote.value=''; visitFollowUp.value=''; visitDialog.showModal();
}

function saveVisit(){
  state.visits.push({id:crypto.randomUUID(),dealerId:visitDealerId.value,date:visitDate.value||dtLocalNow(),note:visitNote.value.trim(),followUp:visitFollowUp.value});
  visitDialog.close(); persist();
}

function openPaymentModal(id){
  paymentDealer.innerHTML=state.dealers.map(d=>'<option value="'+d.id+'">'+esc(d.name)+'</option>').join('');
  if(id)paymentDealer.value=id;
  paymentAmount.value=''; paymentDate.value=todayStr(); paymentNote.value=''; paymentDialog.showModal();
}

function savePayment(){
  if(!paymentDealer.value||!paymentAmount.value){alert('Bayi ve tutar gerekli.');return}
  state.payments.push({id:crypto.randomUUID(),dealerId:paymentDealer.value,amount:Number(paymentAmount.value),date:paymentDate.value,note:paymentNote.value.trim(),status:'pending'});
  paymentDialog.close(); persist();
}

function renderPayments(){
  paymentRows.innerHTML=state.payments.sort((a,b)=>a.date.localeCompare(b.date)).map(p=>{
    const d=state.dealers.find(x=>x.id===p.dealerId), s=paymentStatus(p);
    return '<tr><td><strong>'+esc(d?.name||'Bilinmeyen')+'</strong></td><td>'+fmtMoney(p.amount)+'</td><td>'+p.date+'</td>'+
      '<td><span class="badge '+s.cls+'">'+s.text+'</span></td><td>'+esc(p.note||'-')+'</td>'+
      '<td>'+(p.status==='paid'?'':'<button class="btn btn-ghost" onclick="markPaid(\''+p.id+'\')">Ödendi</button>')+'</td></tr>'
  }).join('');
}

function markPaid(id){const p=state.payments.find(x=>x.id===id);if(p){p.status='paid';p.paidAt=new Date().toISOString();persist()}}

function loadOriginalPlan(){
  const week=planWeek.value, day=planDay.value;
  const planned=state.dealers
    .filter(d=>d.plannedWeek===week && d.plannedDay===day)
    .sort((a,b)=>(a.plannedOrder||999)-(b.plannedOrder||999));
  if(!planned.length){alert('Bu hafta/gün için kayıt bulunamadı.');return}
  state.todayRoute=planned.map(d=>d.id);
  localStorage.setItem(storeKey,JSON.stringify(state));
  renderAll();
  const missing=planned.filter(d=>d.lat===null||d.lng===null).length;
  routeSummary.innerHTML='Gönderdiğin plan yüklendi: <strong>'+planned.length+' bayi</strong>. '+(missing?'<span class="badge b-warn">'+missing+' bayinin konumu henüz işaretlenmedi</span>':'');
}

function buildRoute(){
  const candidates=state.dealers.filter(d=>d.lat!==null&&d.lng!==null&&isFinite(d.lat)&&isFinite(d.lng));
  if(!candidates.length){alert('Önce konumu kayıtlı en az bir bayi ekle.');return}
  const max=Number(maxStops.value||12), paymentBoost=prioritizePayments.checked, homeFinish=preferHomeFinish.checked;
  let current={...state.home}, remaining=[...candidates], selected=[];
  for(let step=0;step<Math.min(max,remaining.length);step++){
    let best=null,bestScore=Infinity;
    const progress=step/Math.max(1,max-1);
    for(const d of remaining){
      const last=lastVisitForDealer(d.id);
      const overdueRatio=Math.min(3, daysSince(last?.date)/(d.frequency||14));
      const pri=Number(d.priority||1);
      const pay=pendingPaymentForDealer(d.id)?1:0;
      const dist=distanceKm(current,d);
      const homeDist=distanceKm(d,state.home);
      let score=dist - overdueRatio*2.2 - (pri-1)*2.5 - (paymentBoost?pay*3.0:0);
      if(homeFinish)score += homeDist*(progress*0.55);
      if(score<bestScore){bestScore=score;best=d}
    }
    if(!best)break;
    selected.push(best); current={lat:best.lat,lng:best.lng}; remaining=remaining.filter(x=>x.id!==best.id);
  }
  if(homeFinish && selected.length>2){
    const cut=Math.max(0,selected.length-3);
    const tail=selected.slice(cut).sort((a,b)=>distanceKm(b,state.home)-distanceKm(a,state.home));
    selected=selected.slice(0,cut).concat(tail);
  }
  state.todayRoute=selected.map(d=>d.id);
  persist();
}


function dealerVisitedToday(id){
  return state.visits.some(v=>v.dealerId===id && String(v.date||'').slice(0,10)===todayStr());
}

function markRouteVisited(id){
  if(dealerVisitedToday(id)){ alert('Bu bayi bugün zaten ziyaret edildi olarak işaretlenmiş.'); return; }
  state.visits.push({
    id:crypto.randomUUID(),
    dealerId:id,
    date:dtLocalNow(),
    note:'',
    followUp:''
  });
  persist();
}

function openRouteNote(id){
  visitDealerId.value=id;
  visitDate.value=dtLocalNow();
  visitNote.value='';
  visitFollowUp.value='';
  visitDialog.showModal();
}

function useCurrentLocationForDealer(){
  if(!navigator.geolocation){ alert('Tarayıcı konum desteği yok.'); return; }
  navigator.geolocation.getCurrentPosition(pos=>{
    const lat=pos.coords.latitude, lng=pos.coords.longitude;
    dealerLat.value=lat.toFixed(6);
    dealerLng.value=lng.toFixed(6);
    dealerLocationStatus.value='verified';
    if(miniMap){
      const ll=[lat,lng];
      if(miniMarker) miniMarker.setLatLng(ll);
      else miniMarker=L.marker(ll).addTo(miniMap);
      miniMap.setView(ll,17);
    }
  },err=>alert('Konum alınamadı: '+err.message),{
    enableHighAccuracy:true,
    timeout:15000,
    maximumAge:0
  });
}
