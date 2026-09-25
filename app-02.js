function clearDealerCoordinates(){
  dealerLat.value='';
  dealerLng.value='';
  dealerLocationStatus.value='unset';
  const hint=document.getElementById('dealerMapPasteHint');
  if(hint) hint.textContent='Koordinatlar temizlendi. Yeni koordinat girebilir veya haritadan seçebilirsin.';
  if(typeof miniMarker!=='undefined'&&miniMarker&&typeof miniMap!=='undefined'&&miniMap){
    try{ miniMap.removeLayer(miniMarker); }catch(_){}
    miniMarker=null;
  }
}

function parseCoordinateNumber(value){
  const raw=String(value??'').trim();
  if(raw==='') return null;
  // Türkiye klavyelerinde ondalık ayıracı virgül olabiliyor.
  // Tek koordinat alanında 41,012345 gibi bir değeri de doğru kabul et.
  const normalized=(raw.includes(',')&&!raw.includes('.'))?raw.replace(',','.'):raw;
  const num=Number(normalized);
  return Number.isFinite(num)?num:NaN;
}

function saveDealer(){
  if(!dealerName.value.trim()){alert('Bayi adı gerekli.');return}
  const latRaw=dealerLat.value.trim();
  const lngRaw=dealerLng.value.trim();
  const latValue=parseCoordinateNumber(latRaw);
  const lngValue=parseCoordinateNumber(lngRaw);
  if((latRaw!==''||lngRaw!=='') && !isValidDealerCoordinate(latValue,lngValue)){
    alert('Koordinat geçersiz. Enlem -90 ile 90, boylam -180 ile 180 arasında olmalı. İstersen “Koordinatları Temizle” ile sıfırlayıp yeniden girebilirsin.');
    return;
  }
  const obj={
    id:dealerId.value||crypto.randomUUID(),
    name:dealerName.value.trim(),contact:dealerContact.value.trim(),phone:dealerPhone.value.trim(),
    district:dealerDistrict.value.trim(),address:dealerAddress.value.trim(),
    lat:latRaw===''?null:latValue,lng:lngRaw===''?null:lngValue,
    locationStatus:(dealerLat.value===''||dealerLng.value==='')?'unset':dealerLocationStatus.value,frequency:Number(dealerFrequency.value||14),
    priority:Number(dealerPriority.value||1),generalNote:dealerGeneralNote.value.trim(),isActive:true,
    assignedUserId:document.getElementById('dealerAssignedUser')?.value||
      ((typeof teamContext!=='undefined'&&teamContext?.role==='FIELD_STAFF')?cloudUser?.id:null)
  };
  const i=state.dealers.findIndex(x=>x.id===obj.id);
  if(i>=0){
    const old=state.dealers[i];
    obj.plannedWeek=old.plannedWeek; obj.plannedDay=old.plannedDay; obj.plannedOrder=old.plannedOrder;
    obj.plannedStage=old.plannedStage; obj.originalRouteLogic=old.originalRouteLogic; obj.departure=old.departure; obj.isActive=old.isActive!==false;
    if(!obj.assignedUserId)obj.assignedUserId=old.assignedUserId||null;
    state.dealers[i]=obj;
  }else state.dealers.push(obj);
  dealerDialog.close(); persist(); if(typeof logActivity==='function') logActivity('DEALER_UPDATED','DEALER',obj.id,{name:obj.name});
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
    '<div class="item"><strong>Sorumlu satışçı</strong>'+esc(typeof salespersonLabel==='function'?salespersonLabel(d.assignedUserId):(d.assignedUserId||'Atanmamış'))+'</div>'+
    '<div class="item"><strong>Genel not</strong>'+esc(d.generalNote||'-')+'</div>'+
    '<div class="toolbar"><button class="btn btn-primary" onclick="detailDialog.close();openVisitModal(\''+id+'\')">+ Ziyaret Kaydı</button>'+
    '<button class="btn btn-accent" onclick="detailDialog.close();openPaymentModal(\''+id+'\')">+ Ödeme Sözü</button></div>'+
    '<h3>Ziyaret geçmişi</h3>'+
    (visits.length?visits.map(v=>'<div class="note"><strong>'+new Date(v.date).toLocaleString('tr-TR')+'</strong>'+
      ((typeof teamContext!=='undefined'&&teamContext?.role==='MANAGER')?'<br><span class="muted">Ziyaret eden: '+esc(actorDisplayName(v))+'</span>':'')+
      '<br>'+esc(v.note||'-')+(v.followUp?'<br><span class="muted">Takip: '+v.followUp+'</span>':'')+'</div>').join(''):'<div class="muted">Henüz ziyaret kaydı yok.</div>')+
    '<h3 style="margin-top:18px">Ödeme sözleri</h3>'+
    (pays.length?pays.map(p=>{const s=paymentStatus(p);return '<div class="payment"><strong>'+fmtMoney(p.amount)+'</strong> • '+p.date+' <span class="badge '+s.cls+'">'+s.text+'</span><br>'+esc(p.note||'')+'</div>'}).join(''):'<div class="muted">Henüz ödeme sözü yok.</div>');
  detailDialog.showModal();
}

function openVisitModal(id){
  visitDealerId.value=id; visitDate.value=dtLocalNow(); visitNote.value=''; visitFollowUp.value=''; visitDialog.showModal();
}

function saveVisit(){
  state.visits.push({id:crypto.randomUUID(),dealerId:visitDealerId.value,date:visitDate.value||dtLocalNow(),note:visitNote.value.trim(),followUp:visitFollowUp.value,
    _ownerUserId:(typeof cloudUser!=='undefined'&&cloudUser)?cloudUser.id:null,
    _actorUserId:(typeof cloudUser!=='undefined'&&cloudUser)?cloudUser.id:null,
    createdAt:new Date().toISOString()});
  visitDialog.close(); clearTransientDialogState('visitDialog'); persist(); if(typeof logActivity==='function') logActivity('VISIT_ADDED','DEALER',visitDealerId.value,{note:visitNote.value.trim()});
}

function openPaymentModal(id){
  paymentDealer.innerHTML=state.dealers
    .filter(d=>typeof dealerVisibleToCurrentUser!=='function'||dealerVisibleToCurrentUser(d))
    .map(d=>'<option value="'+d.id+'">'+esc(d.name)+'</option>').join('');
  if(id)paymentDealer.value=id;
  paymentAmount.value=''; paymentDate.value=todayStr(); paymentNote.value=''; paymentDialog.showModal();
}

function savePayment(){
  if(!paymentDealer.value||!paymentAmount.value){alert('Bayi ve tutar gerekli.');return}
  state.payments.push({id:crypto.randomUUID(),dealerId:paymentDealer.value,amount:Number(paymentAmount.value),date:paymentDate.value,note:paymentNote.value.trim(),status:'pending',
    _ownerUserId:(typeof cloudUser!=='undefined'&&cloudUser)?cloudUser.id:null,
    _actorUserId:(typeof cloudUser!=='undefined'&&cloudUser)?cloudUser.id:null});
  paymentDialog.close(); clearTransientDialogState('paymentDialog'); persist(); if(typeof logActivity==='function') logActivity('PAYMENT_ADDED','DEALER',paymentDealer.value,{amount:Number(paymentAmount.value||0)});
}

function renderPayments(){
  const isManager=typeof teamContext!=='undefined'&&teamContext?.role==='MANAGER';
  const staffFilter=isManager?(document.getElementById('managerPaymentStaffFilter')?.value||'all'):'all';
  const statusFilter=isManager?(document.getElementById('managerPaymentStatusFilter')?.value||'all'):'all';

  const rows=state.payments.filter(p=>{
    const actor=p._actorUserId||p._ownerUserId;
    if(staffFilter!=='all'&&actor!==staffFilter)return false;
    const s=paymentStatus(p);
    if(statusFilter==='pending' && ['Ödendi','İptal','Gecikti'].includes(s.text)) return false;
    if(statusFilter==='overdue' && s.text!=='Gecikti') return false;
    if(statusFilter==='paid' && s.text!=='Ödendi') return false;
    return true;
  }).sort((a,b)=>a.date.localeCompare(b.date));

  paymentRows.innerHTML=rows.map(p=>{
    const d=state.dealers.find(x=>x.id===p.dealerId), s=paymentStatus(p);
    return '<tr><td><strong>'+esc(d?.name||'Bilinmeyen')+'</strong></td><td>'+fmtMoney(p.amount)+'</td><td>'+p.date+'</td>'+
      '<td><span class="badge '+s.cls+'">'+s.text+'</span></td><td>'+esc(p.note||'-')+'</td>'+
      '<td class="manager-only-col">'+esc(actorDisplayName(p))+'</td>'+
      '<td>'+(p.status==='paid'?'':'<button class="btn btn-ghost" onclick="markPaid(\''+p.id+'\')">Ödendi</button>')+'</td></tr>'
  }).join('');
}

function markPaid(id){const p=state.payments.find(x=>x.id===id);if(p){p.status='paid';p.paidAt=new Date().toISOString();persist();if(typeof logActivity==='function') logActivity('PAYMENT_PAID','DEALER',p.dealerId,{paymentId:p.id})}}

function markRouteDraftChanged(){
  const el=document.getElementById('routePublishStatus');
  if(!el || !state.todayRoute?.length)return;
  const uid=(typeof cloudUser!=='undefined'&&cloudUser)?cloudUser.id:'local';
  const key='ilkeSahaPublishedRoute:'+uid+':'+todayStr();
  const published=localStorage.getItem(key);
  const current=(state.todayRoute||[]).filter(Boolean).join('|');
  if(!published || published!==current){
    el.textContent='Bugünkü rut taslak durumda. Son değişiklikleri yöneticiye göndermek için tekrar onayla.';
  }
}

function loadOriginalPlan(){
  const week=planWeek.value, day=planDay.value;
  const planned=state.dealers
    .filter(d=>d.plannedWeek===week && d.plannedDay===day && d.isActive!==false &&
      (typeof dealerVisibleToCurrentUser!=='function'||dealerVisibleToCurrentUser(d)))
    .sort((a,b)=>(a.plannedOrder||999)-(b.plannedOrder||999));
  if(!planned.length){alert('Bu hafta/gün için aktif bayi kaydı bulunamadı.');return}
  state.todayRoute=planned.map(d=>d.id);
  persist();
  markRouteDraftChanged();
  const missing=planned.filter(d=>!isValidDealerCoordinate(d.lat,d.lng)).length;
  routeSummary.innerHTML='Gönderdiğin plan yüklendi: <strong>'+planned.length+' bayi</strong>. '+
    (missing?'<span class="badge b-warn">'+missing+' bayinin konumu henüz işaretlenmedi</span>':'');
}

function routeDistance(order){
  let km=0;
  let cur=state.home;
  for(const d of order){
    if(!isValidDealerCoordinate(d.lat,d.lng)) continue;
    km+=distanceKm(cur,d);
    cur=d;
  }
  if(order.some(d=>isValidDealerCoordinate(d.lat,d.lng))){
    km+=distanceKm(cur,state.home);
  }
  return km;
}

function optimizeDayRoute(dealers){
  if(dealers.length<=1) return dealers.slice();
  if(dealers.length===2){
    const a=dealers[0],b=dealers[1];
    return distanceKm(a,state.home)>distanceKm(b,state.home)?[a,b]:[b,a];
  }

  // Saha kullanım kuralı:
  // 1) Güne evden daha uzak bölgede başla.
  // 2) Gün ilerledikçe eve doğru yaklaş.
  // 3) Son bayi, mümkün olduğunca eve yakın olsun.
  const byHome=[...dealers].sort((a,b)=>distanceKm(b,state.home)-distanceKm(a,state.home));
  const first=byHome[0];
  const last=byHome[byHome.length-1];
  const middle=byHome.slice(1,-1);

  // Uzak başlangıçtan, yakın sona doğru en kısa bağlantıları kur.
  const order=[first];
  let current=first;
  let remaining=[...middle];

  while(remaining.length){
    let bestIndex=0;
    let bestScore=Infinity;

    remaining.forEach((d,i)=>{
      const hop=distanceKm(current,d);
      const homeDist=distanceKm(d,state.home);

      // Eve yaklaşma eğilimini koru; ancak sırf eve yakın diye büyük sapma yapma.
      const currentHomeDist=distanceKm(current,state.home);
      const movingAwayPenalty=Math.max(0,homeDist-currentHomeDist)*2.0;
      const score=hop+movingAwayPenalty;

      if(score<bestScore){
        bestScore=score;
        bestIndex=i;
      }
    });

    const [best]=remaining.splice(bestIndex,1);
    order.push(best);
    current=best;
  }

  order.push(last);

  // İlk ve son bayiyi sabit tutup orta kısmı 2-opt ile iyileştir.
  // Böylece rota kısalırken "uzakta başla, eve yakın bitir" kuralı bozulmaz.
  let improved=true;
  let passes=0;
  while(improved && passes<80){
    improved=false;
    passes++;

    for(let i=1;i<order.length-2;i++){
      for(let k=i+1;k<order.length-1;k++){
        const candidate=order.slice(0,i)
          .concat(order.slice(i,k+1).reverse(),order.slice(k+1));

        if(routeDistance(candidate)+0.001<routeDistance(order)){
          order.splice(0,order.length,...candidate);
          improved=true;
        }
      }
    }
  }

  return order;
}

function buildRoute(){
  // "En Mantıklı Rut" artık sadece seçili günün / ekrandaki planın bayilerini
  // sıralar. Bayi sayısını azaltmaz, maksimum bayi limiti uygulamaz.
  const baseIds=(state.todayRoute||[]).filter(Boolean);
  let dayDealers=baseIds
    .map(id=>state.dealers.find(d=>d.id===id))
    .filter(d=>d && d.isActive!==false);

  if(!dayDealers.length){
    // Henüz gün yüklenmediyse seçili hafta/günü kullan.
    dayDealers=state.dealers
      .filter(d=>d.plannedWeek===planWeek.value && d.plannedDay===planDay.value && d.isActive!==false &&
        (typeof dealerVisibleToCurrentUser!=='function'||dealerVisibleToCurrentUser(d)))
      .sort((a,b)=>(a.plannedOrder||999)-(b.plannedOrder||999));
  }

  if(!dayDealers.length){
    alert('Önce ziyaret edeceğin günü "Mevcut Planı Göster" ile yükle.');
    return;
  }

  const located=dayDealers.filter(d=>isValidDealerCoordinate(d.lat,d.lng));
  const missing=dayDealers.filter(d=>!isValidDealerCoordinate(d.lat,d.lng));

  const optimized=optimizeDayRoute(located);

  // Konumu eksik bayi varsa kesinlikle silmiyoruz; mevcut plan sırasına göre sona ekliyoruz.
  missing.sort((a,b)=>(a.plannedOrder||999)-(b.plannedOrder||999));
  const finalRoute=optimized.concat(missing);

  state.todayRoute=finalRoute.map(d=>d.id);
  persist();
  markRouteDraftChanged();

  if(missing.length){
    alert('Rut '+finalRoute.length+' bayinin tamamını içeriyor. '+missing.length+
      ' bayinin konumu eksik olduğu için bunlar plan sırasına göre sona eklendi.');
  }
}

function deactivateDealerFromRoute(id){
  const d=state.dealers.find(x=>x.id===id);
  if(!d)return;
  const ok=confirm(d.name+' artık aktif rutlarda görünmesin mi?\n\nBu işlem bayiyi ve geçmiş kayıtlarını silmez; sadece aktif rutlardan çıkarır.');
  if(!ok)return;
  d.isActive=false;
  state.todayRoute=(state.todayRoute||[]).filter(x=>x!==id);
  persist();
  markRouteDraftChanged();
  if(typeof logActivity==='function') logActivity('VISIT_MARKED','DEALER',id,{});
}



function isQuickVisitMarker(v){
  return !(v.note||'').trim() && !(v.followUp||'').trim();
}

function dealerVisitedToday(id){
  return state.visits.some(v=>
    v.dealerId===id &&
    String(v.date||'').slice(0,10)===todayStr() &&
    isQuickVisitMarker(v)
  );
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
    setDealerCoordinates(lat,lng,'verified');
  },err=>alert('Konum alınamadı: '+err.message),{
    enableHighAccuracy:true,
    timeout:15000,
    maximumAge:0
  });
}


function undoRouteVisited(id){
  const today=todayStr();
  const quickMarkers=state.visits
    .filter(v=>
      v.dealerId===id &&
      String(v.date||'').slice(0,10)===today &&
      isQuickVisitMarker(v)
    )
    .sort((a,b)=>new Date(b.date)-new Date(a.date));

  if(!quickMarkers.length){
    alert('Bu bayi için bugün geri alınabilecek bir ziyaret işareti yok.');
    return;
  }

  // Sadece "Ziyaret Edildi" butonunun oluşturduğu boş işareti kaldır.
  // Görüşme notu / takip tarihi içeren hiçbir kayıt silinmez.
  const target=quickMarkers[0];
  state.visits=state.visits.filter(v=>v.id!==target.id);
  persist();
  if(typeof logActivity==='function') logActivity('VISIT_UNDONE','DEALER',id,{});
}


function setDealerCoordinates(lat,lng,status='verified'){
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180){
    alert('Geçerli bir enlem/boylam bulunamadı.');
    return false;
  }
  dealerLat.value=lat.toFixed(6);
  dealerLng.value=lng.toFixed(6);
  dealerLocationStatus.value=status;

  if(miniMap){
    const ll=[lat,lng];
    if(miniMarker) miniMarker.setLatLng(ll);
    else miniMarker=L.marker(ll).addTo(miniMap);
    miniMap.setView(ll,18);
  }
  return true;
}

function extractCoordinatesFromText(text){
  const raw=String(text||'').trim();
  if(!raw)return null;

  let decoded=raw;
  try{ decoded=decodeURIComponent(raw.replace(/%2C/gi,',')); }catch(_){}

  const valid=(lat,lng)=>{
    lat=Number(lat); lng=Number(lng);
    return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180
      ? {lat,lng}:null;
  };

  // Google Maps URL biçimleri önce kontrol edilir.
  let m=decoded.match(/@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  if(m)return valid(m[1],m[2]);

  m=decoded.match(/!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/);
  if(m)return valid(m[1],m[2]);

  m=decoded.match(/(?:query|destination|q)=(-?\d{1,2}(?:\.\d+)?)[,%\s]+(-?\d{1,3}(?:\.\d+)?)/i);
  if(m){
    const found=valid(m[1],m[2]);
    if(found)return found;
  }

  // Standart kopyalama: 41.012345, 28.987654
  m=decoded.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if(m){
    const found=valid(m[1],m[2]);
    if(found)return found;
  }

  // Boşlukla ayrılmış biçim: 41.012345 28.987654
  m=decoded.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s+(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if(m){
    const found=valid(m[1],m[2]);
    if(found)return found;
  }

  // Türkçe ondalık virgül + noktalı virgül ayırıcı:
  // 41,012345; 28,987654
  m=decoded.match(/^\s*(-?\d{1,2}),([0-9]+)\s*;\s*(-?\d{1,3}),([0-9]+)\s*$/);
  if(m){
    const found=valid(m[1]+'.'+m[2],m[3]+'.'+m[4]);
    if(found)return found;
  }

  // Bazı kopyalamalarda iki ondalık virgül de virgülle ayrılıyor:
  // 41,012345, 28,987654
  // Dört parçayı iki koordinat olarak güvenli şekilde birleştir.
  m=decoded.match(/^\s*(-?\d{1,2}),([0-9]{3,})\s*,\s*(-?\d{1,3}),([0-9]{3,})\s*$/);
  if(m){
    const found=valid(m[1]+'.'+m[2],m[3]+'.'+m[4]);
    if(found)return found;
  }

  return null;
}

function applyDealerMapPaste(){
  const input=document.getElementById('dealerMapPaste');
  const hint=document.getElementById('dealerMapPasteHint');
  const coords=extractCoordinatesFromText(input?.value||'');
  if(!coords){
    if(hint) hint.textContent='Koordinat bulunamadı. Google Maps’teki koordinatı kopyalayıp “41.xxxxxx, 28.xxxxxx” biçiminde yapıştırmayı dene.';
    alert('Yapıştırdığın metinde koordinat bulamadım.');
    return;
  }
  if(setDealerCoordinates(coords.lat,coords.lng,'verified')){
    if(hint) hint.textContent='Koordinat alındı: '+coords.lat.toFixed(6)+', '+coords.lng.toFixed(6);
  }
}
