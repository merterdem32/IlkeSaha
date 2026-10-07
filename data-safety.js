// İlke Saha - Veri Güvenliği Katmanı
// Amaç: hiçbir normal senkronizasyon işlemi kayıtları topluca silmesin.
// Kritik kayıtlar önce Supabase'e yazılır, başarıdan sonra arayüz/local state güncellenir.
(() => {
  let safetySyncTimer=null;
  let safetySyncRunning=false;

  function nowIso(){ return new Date().toISOString(); }

  async function createAutomaticSafetySnapshot(){
    if(!cloudUser||!supabaseClient||!teamContext?.organizationId)return;
    try{
      const day=(typeof todayStr==='function'?todayStr():new Date().toISOString().slice(0,10));
      const label='auto-safety-'+day;
      const {data,error}=await supabaseClient.from('data_backups')
        .select('id').eq('user_id',cloudUser.id).eq('label',label).limit(1);
      if(error||data?.length)return;

      const snapshot={
        ...state,
        personalNotes:(typeof personalNotesCache!=='undefined'?personalNotesCache:[]),
        potentialDealers:(typeof potentialDealers!=='undefined'?potentialDealers:[]),
        potentialVisits:(typeof potentialVisits!=='undefined'?potentialVisits:[]),
        capturedAt:nowIso(),
        safetyVersion:1
      };
      await supabaseClient.from('data_backups').insert({
        user_id:cloudUser.id,
        organization_id:teamContext.organizationId,
        label,
        snapshot
      });
    }catch(err){
      console.warn('Automatic safety snapshot failed',err);
    }
  }

  async function safeSyncStateToCloud(initial=false){
    if(!cloudUser||!supabaseClient||safetySyncRunning)return;
    safetySyncRunning=true;
    // Eski cloud.js değişkenini de kilitle; aynı anda iki senkron çalışmasın.
    try{ cloudSyncInProgress=true; }catch(_){}

    try{
      if(typeof updateCloudUi==='function') updateCloudUi(initial?'İlk veriler buluta aktarılıyor…':'Buluta güvenli kaydediliyor…');

      const dealersToSync=teamContext.role==='MANAGER'
        ? state.dealers
        : state.dealers.filter(d=>d.assignedUserId===cloudUser.id);

      if(dealersToSync.length){
        const dealerRows=dealersToSync.map(d=>{
          const row=dealerToDb(d);
          row.created_by=d._createdBy||d._ownerUserId||cloudUser.id;
          row.updated_by=cloudUser.id;
          return row;
        });
        const {error}=await supabaseClient.from('organization_dealers')
          .upsert(dealerRows,{onConflict:'organization_id,id'});
        if(error)throw new Error('Bayi kaydı: '+error.message);
      }

      const myVisits=(state.visits||[]).filter(v=>(v._ownerUserId||cloudUser.id)===cloudUser.id);
      if(myVisits.length){
        const rows=myVisits.map(v=>({
          id:v.id,user_id:cloudUser.id,
          organization_id:teamContext.organizationId,
          actor_user_id:v._actorUserId||cloudUser.id,
          dealer_id:v.dealerId,
          visit_date:new Date(v.date).toISOString(),
          note:v.note||null,
          follow_up:v.followUp||null,
          updated_at:nowIso()
        }));
        const {error}=await supabaseClient.from('visits').upsert(rows,{onConflict:'user_id,id'});
        if(error)throw new Error('Ziyaret kaydı: '+error.message);
      }

      const myPayments=(state.payments||[]).filter(p=>(p._ownerUserId||cloudUser.id)===cloudUser.id);
      if(myPayments.length){
        const rows=myPayments.map(p=>({
          id:p.id,user_id:cloudUser.id,
          organization_id:teamContext.organizationId,
          actor_user_id:p._actorUserId||cloudUser.id,
          dealer_id:p.dealerId,
          amount:Number(p.amount||0),
          promise_date:p.date,
          note:p.note||null,
          status:p.status||'pending',
          paid_at:p.paidAt||null,
          created_at:p.createdAt||nowIso(),
          updated_at:nowIso()
        }));
        const {error}=await supabaseClient.from('payment_promises').upsert(rows,{onConflict:'user_id,id'});
        if(error)throw new Error('Ödeme kaydı: '+error.message);
      }

      const myMeetingNotes=(state.meetingNotes||[]).filter(m=>(m._ownerUserId||cloudUser.id)===cloudUser.id);
      if(myMeetingNotes.length){
        const rows=myMeetingNotes.map(m=>({
          id:m.id,user_id:cloudUser.id,
          organization_id:teamContext.organizationId,
          actor_user_id:m._actorUserId||cloudUser.id,
          title:m.title||'Toplantı Notu',
          note:m.note||'',
          meeting_date:m.meetingDate||null,
          status:m.status||'open',
          created_at:m.createdAt||nowIso(),
          updated_at:nowIso()
        }));
        const {error}=await supabaseClient.from('meeting_notes').upsert(rows,{onConflict:'user_id,id'});
        if(error)throw new Error('Toplantı notu: '+error.message);
      }

      const settings={
        user_id:cloudUser.id,
        organization_id:teamContext.organizationId,
        home_lat:state.home?.lat??null,
        home_lng:state.home?.lng??null,
        start_time:document.getElementById('startTime')?.value||'08:30',
        end_time:document.getElementById('endTime')?.value||'18:30',
        visit_minutes:Number(document.getElementById('visitMinutes')?.value||20),
        max_stops:Number(document.getElementById('maxStops')?.value||12),
        prioritize_payments:document.getElementById('prioritizePayments')?.checked??true,
        prefer_home_finish:document.getElementById('preferHomeFinish')?.checked??true,
        today_route:state.todayRoute||[],
        updated_at:nowIso()
      };
      const {error:settingsErr}=await supabaseClient.from('user_settings').upsert(settings,{onConflict:'user_id'});
      if(settingsErr)throw new Error('Ayar kaydı: '+settingsErr.message);

      await createAutomaticSafetySnapshot();
      if(typeof updateCloudUi==='function') updateCloudUi('Buluta güvenli kaydedildi • '+new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}));
    }catch(err){
      console.error('Safe cloud sync error',err);
      if(typeof updateCloudUi==='function') updateCloudUi('Bulut kaydı başarısız: '+(err.message||err));
    }finally{
      safetySyncRunning=false;
      try{ cloudSyncInProgress=false; }catch(_){}
    }
  }

  function safeScheduleCloudSync(){
    if(!cloudUser||cloudHydrating)return;
    clearTimeout(safetySyncTimer);
    safetySyncTimer=setTimeout(()=>safeSyncStateToCloud(false),700);
  }

  // Eski toplu sil-yeniden yaz senkronunu devre dışı bırak.
  window.syncStateToCloud=safeSyncStateToCloud;
  window.scheduleCloudSync=safeScheduleCloudSync;

  // Kritik görüşme kaydı: önce buluta yaz, sonra ekranda başarı say.
  window.saveVisit=async function(){
    if(!cloudUser||!supabaseClient){alert('Bulut bağlantısı olmadan ziyaret kaydı oluşturulamıyor. Tekrar giriş yap.');return}
    const obj={
      id:crypto.randomUUID(),dealerId:visitDealerId.value,
      date:visitDate.value||dtLocalNow(),note:visitNote.value.trim(),followUp:visitFollowUp.value,
      _ownerUserId:cloudUser.id,_actorUserId:cloudUser.id,createdAt:nowIso()
    };
    const {error}=await supabaseClient.from('visits').insert({
      id:obj.id,user_id:cloudUser.id,organization_id:teamContext.organizationId,
      actor_user_id:cloudUser.id,dealer_id:obj.dealerId,
      visit_date:new Date(obj.date).toISOString(),note:obj.note||null,follow_up:obj.followUp||null,updated_at:nowIso()
    });
    if(error){alert('Ziyaret kaydı buluta yazılamadı. Form kapatılmadı: '+error.message);return}
    state.visits.push(obj);
    visitDialog.close(); clearTransientDialogState('visitDialog'); persist();
    if(typeof logActivity==='function') logActivity('VISIT_ADDED','DEALER',obj.dealerId,{note:obj.note,followUp:obj.followUp});
  };

  window.savePayment=async function(){
    if(!paymentDealer.value||!paymentAmount.value){alert('Bayi ve tutar gerekli.');return}
    if(!cloudUser||!supabaseClient){alert('Bulut bağlantısı olmadan ödeme sözü kaydedilemiyor.');return}
    const obj={
      id:crypto.randomUUID(),dealerId:paymentDealer.value,amount:Number(paymentAmount.value),
      date:paymentDate.value,note:paymentNote.value.trim(),status:'pending',paidAt:null,
      createdAt:nowIso(),_ownerUserId:cloudUser.id,_actorUserId:cloudUser.id
    };
    const {error}=await supabaseClient.from('payment_promises').insert({
      id:obj.id,user_id:cloudUser.id,organization_id:teamContext.organizationId,
      actor_user_id:cloudUser.id,dealer_id:obj.dealerId,amount:obj.amount,promise_date:obj.date,
      note:obj.note||null,status:'pending',created_at:obj.createdAt,updated_at:nowIso()
    });
    if(error){alert('Ödeme sözü buluta yazılamadı. Form kapatılmadı: '+error.message);return}
    state.payments.push(obj);
    paymentDialog.close(); clearTransientDialogState('paymentDialog'); persist();
    if(typeof logActivity==='function') logActivity('PAYMENT_ADDED','DEALER',obj.dealerId,{amount:obj.amount,note:obj.note});
  };

  window.markPaid=async function(id){
    const p=state.payments.find(x=>x.id===id); if(!p)return;
    const paidAt=nowIso();
    const owner=p._ownerUserId||cloudUser.id;
    const {error}=await supabaseClient.from('payment_promises')
      .update({status:'paid',paid_at:paidAt,updated_at:paidAt}).eq('user_id',owner).eq('id',id);
    if(error){alert('Ödeme durumu kaydedilemedi: '+error.message);return}
    p.status='paid';p.paidAt=paidAt;persist();
    if(typeof logActivity==='function')logActivity('PAYMENT_PAID','DEALER',p.dealerId,{paymentId:p.id});
  };

  window.saveMeetingNote=async function(){
    const titleEl=document.getElementById('meetingTitle');
    const noteEl=document.getElementById('meetingNote');
    const dateEl=document.getElementById('meetingDate');
    const title=(titleEl?.value||'').trim();
    const note=(noteEl?.value||'').trim();
    const meetingDate=dateEl?.value||'';
    if(!title&&!note){alert('Başlık veya not gir.');return}
    if(!cloudUser||!supabaseClient){alert('Bulut bağlantısı olmadan toplantı notu kaydedilemiyor.');return}

    const obj={
      id:crypto.randomUUID(),title:title||'Toplantı Notu',note,meetingDate,status:'open',createdAt:nowIso(),
      _ownerUserId:cloudUser.id,_actorUserId:cloudUser.id,
      _actorName:(teamProfilesById.get(cloudUser.id)?.full_name||teamProfilesById.get(cloudUser.id)?.username||'Ben')
    };
    const {error}=await supabaseClient.from('meeting_notes').insert({
      id:obj.id,user_id:cloudUser.id,organization_id:teamContext.organizationId,actor_user_id:cloudUser.id,
      title:obj.title,note:obj.note,meeting_date:obj.meetingDate||null,status:'open',created_at:obj.createdAt,updated_at:obj.createdAt
    });
    if(error){alert('Toplantı notu buluta yazılamadı. Yazdığın metin formda bırakıldı: '+error.message);return}

    state.meetingNotes.push(obj);
    titleEl.value='';noteEl.value='';dateEl.value='';persist();
    if(typeof logActivity==='function')logActivity('MEETING_NOTE_ADDED','MEETING_NOTE',obj.id,{title:obj.title,note:obj.note,meetingDate:obj.meetingDate});
    if(typeof renderMeetingNotes==='function')renderMeetingNotes();
  };

  window.toggleMeetingNote=async function(id){
    const item=state.meetingNotes.find(x=>x.id===id);if(!item)return;
    if(item._ownerUserId&&item._ownerUserId!==cloudUser.id&&teamContext?.role!=='MANAGER'){
      alert('Bu not başka bir kullanıcıya ait.');return;
    }
    const next=item.status==='done'?'open':'done';
    const owner=item._ownerUserId||cloudUser.id;
    const {error}=await supabaseClient.from('meeting_notes')
      .update({status:next,updated_at:nowIso()}).eq('user_id',owner).eq('id',id);
    if(error){alert('Toplantı notu güncellenemedi: '+error.message);return}
    item.status=next;persist();
    if(typeof logActivity==='function'&&next==='done')logActivity('MEETING_NOTE_DONE','MEETING_NOTE',id,{title:item.title,owner:item._actorName||''});
    renderMeetingNotes();
  };

  window.deleteMeetingNote=async function(id){
    const item=state.meetingNotes.find(x=>x.id===id);if(!item)return;
    if(!confirm('Bu toplantı notu silinsin mi? Silinen kayıt veritabanı güvenlik geçmişinde korunur.'))return;
    if(item._ownerUserId&&item._ownerUserId!==cloudUser.id&&teamContext?.role!=='MANAGER'){
      alert('Bu not başka bir kullanıcıya ait.');return;
    }
    const owner=item._ownerUserId||cloudUser.id;
    const {error}=await supabaseClient.from('meeting_notes').delete().eq('user_id',owner).eq('id',id);
    if(error){alert('Toplantı notu silinemedi: '+error.message);return}
    state.meetingNotes=state.meetingNotes.filter(x=>x.id!==id);
    localStorage.setItem(storeKey,JSON.stringify(state));
    renderMeetingNotes();
  };

  window.markRouteVisited=async function(id){
    if(dealerVisitedToday(id)){alert('Bu bayi bugün zaten ziyaret edildi olarak işaretlenmiş.');return}
    const obj={id:crypto.randomUUID(),dealerId:id,date:dtLocalNow(),note:'',followUp:'',_ownerUserId:cloudUser.id,_actorUserId:cloudUser.id};
    const {error}=await supabaseClient.from('visits').insert({
      id:obj.id,user_id:cloudUser.id,organization_id:teamContext.organizationId,actor_user_id:cloudUser.id,
      dealer_id:id,visit_date:new Date(obj.date).toISOString(),note:null,follow_up:null,updated_at:nowIso()
    });
    if(error){alert('Ziyaret işareti kaydedilemedi: '+error.message);return}
    state.visits.push(obj);persist();
    if(typeof logActivity==='function')logActivity('VISIT_MARKED','DEALER',id,{});
  };

  window.undoRouteVisited=async function(id){
    const today=todayStr();
    const quickMarkers=state.visits.filter(v=>v.dealerId===id&&String(v.date||'').slice(0,10)===today&&isQuickVisitMarker(v))
      .sort((a,b)=>new Date(b.date)-new Date(a.date));
    if(!quickMarkers.length){alert('Bu bayi için bugün geri alınabilecek bir ziyaret işareti yok.');return}
    const target=quickMarkers[0];
    const owner=target._ownerUserId||cloudUser.id;
    const {error}=await supabaseClient.from('visits').delete().eq('user_id',owner).eq('id',target.id);
    if(error){alert('Ziyaret işareti geri alınamadı: '+error.message);return}
    state.visits=state.visits.filter(v=>v.id!==target.id);
    localStorage.setItem(storeKey,JSON.stringify(state));renderAll();
    if(typeof logActivity==='function')logActivity('VISIT_UNDONE','DEALER',id,{visitId:target.id});
  };

  window.deactivateDealerFromRoute=async function(id){
    const d=state.dealers.find(x=>x.id===id);if(!d)return;
    if(!confirm(d.name+' artık aktif rutlarda görünmesin mi?\n\nBayi ve geçmiş kayıtları silinmez; yalnızca aktif rutlardan çıkarılır.'))return;
    const {error}=await supabaseClient.from('organization_dealers')
      .update({is_active:false,updated_by:cloudUser.id,updated_at:nowIso()})
      .eq('organization_id',teamContext.organizationId).eq('id',id);
    if(error){alert('Bayi rut dışına alınamadı: '+error.message);return}
    d.isActive=false;
    state.todayRoute=(state.todayRoute||[]).filter(x=>x!==id);
    persist();markRouteDraftChanged();
    if(typeof logActivity==='function')logActivity('DEALER_DEACTIVATED','DEALER',id,{});
    if(typeof renderInactiveDealers==='function')renderInactiveDealers();
  };

  window.saveDealer=async function(){
    if(!dealerName.value.trim()){alert('Bayi adı gerekli.');return}
    const latRaw=dealerLat.value.trim(),lngRaw=dealerLng.value.trim();
    const latValue=parseCoordinateNumber(latRaw),lngValue=parseCoordinateNumber(lngRaw);
    if((latRaw!==''||lngRaw!=='')&&!isValidDealerCoordinate(latValue,lngValue)){
      alert('Koordinat geçersiz.');return;
    }
    const id=dealerId.value||crypto.randomUUID();
    const old=state.dealers.find(x=>x.id===id)||null;
    const obj={
      id,name:dealerName.value.trim(),contact:dealerContact.value.trim(),phone:dealerPhone.value.trim(),
      district:dealerDistrict.value.trim(),address:dealerAddress.value.trim(),
      lat:latRaw===''?null:latValue,lng:lngRaw===''?null:lngValue,
      locationStatus:(latRaw===''||lngRaw==='')?'unset':dealerLocationStatus.value,
      frequency:Number(dealerFrequency.value||14),priority:Number(dealerPriority.value||1),generalNote:dealerGeneralNote.value.trim(),
      isActive:old?old.isActive!==false:true,
      assignedUserId:document.getElementById('dealerAssignedUser')?.value||old?.assignedUserId||((teamContext?.role==='FIELD_STAFF')?cloudUser.id:null),
      plannedWeek:old?.plannedWeek||'',plannedDay:old?.plannedDay||'',plannedOrder:old?.plannedOrder||0,
      plannedStage:old?.plannedStage||'',originalRouteLogic:old?.originalRouteLogic||'',departure:old?.departure||'08:30',
      cariCode:old?.cariCode||'',isZCode:old?.isZCode===true,
      _ownerUserId:old?._ownerUserId||cloudUser.id,_createdBy:old?._createdBy||old?._ownerUserId||cloudUser.id
    };
    const row=dealerToDb(obj);
    row.created_by=obj._createdBy;row.updated_by=cloudUser.id;
    const {error}=await supabaseClient.from('organization_dealers').upsert(row,{onConflict:'organization_id,id'});
    if(error){alert('Bayi buluta kaydedilemedi. Form kapatılmadı: '+error.message);return}
    const idx=state.dealers.findIndex(x=>x.id===id);
    if(idx>=0)state.dealers[idx]=obj;else state.dealers.push(obj);
    dealerDialog.close();persist();
    if(typeof logActivity==='function')logActivity('DEALER_UPDATED','DEALER',id,{name:obj.name});
  };

  // Oturum açıldıktan sonra günde bir güvenlik snapshot'ı al.
  window.addEventListener('load',()=>setTimeout(createAutomaticSafetySnapshot,2500));
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden')createAutomaticSafetySnapshot();
  });
})();
