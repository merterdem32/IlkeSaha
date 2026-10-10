// İlke Saha - güvenli bayi silme
// Yanlış eklenen bayilerin tamamen kaldırılması için kullanılır.
(() => {
  function canDeleteDealer(d){
    if(!d)return false;
    if(typeof teamContext==='undefined'||!teamContext?.role)return false;
    if(teamContext.role==='MANAGER')return true;
    if(teamContext.role==='FIELD_STAFF')return d.assignedUserId===cloudUser?.id;
    return false;
  }

  function dealerHasHistory(id){
    const visits=(state.visits||[]).filter(v=>v.dealerId===id);
    const payments=(state.payments||[]).filter(p=>p.dealerId===id);
    return {visits:visits.length,payments:payments.length};
  }

  async function deleteDealerPermanently(id){
    const d=state.dealers.find(x=>x.id===id);
    if(!d)return;
    if(!canDeleteDealer(d)){
      alert('Bu bayiyi silme yetkin yok.');
      return;
    }

    const history=dealerHasHistory(id);
    if(history.visits||history.payments){
      alert('Bu bayiye ait geçmiş kayıt bulunduğu için tamamen silinemez.\n\nZiyaret: '+history.visits+'\nÖdeme sözü: '+history.payments+'\n\nGeçmişi korumak için “Rut Dışı Bırak” seçeneğini kullan.');
      return;
    }

    const inTodayRoute=(state.todayRoute||[]).includes(id);
    const extra=inTodayRoute?'\n\nBu bayi bugünkü rutundan da çıkarılacak.':'';
    const ok=confirm('“'+d.name+'” bayisini TAMAMEN silmek istediğine emin misin?\n\nBu işlem yanlış eklenen bayi kayıtları içindir ve geri alınamaz.'+extra);
    if(!ok)return;

    if(typeof supabaseClient!=='undefined'&&supabaseClient&&typeof teamContext!=='undefined'&&teamContext?.organizationId){
      const {error}=await supabaseClient
        .from('organization_dealers')
        .delete()
        .eq('organization_id',teamContext.organizationId)
        .eq('id',id);

      if(error){
        console.error('Dealer delete failed',error);
        const permissionHint=String(error.message||'').toLowerCase().includes('policy') || String(error.message||'').toLowerCase().includes('permission');
        alert(permissionHint
          ? 'Bayi silinemedi. Saha personelinin kendi bayisini silebilmesi için yeni silme yetkisi SQL güncellemesinin uygulanması gerekiyor.'
          : 'Bayi silinemedi: '+error.message);
        return;
      }
    }

    state.dealers=state.dealers.filter(x=>x.id!==id);
    state.todayRoute=(state.todayRoute||[]).filter(x=>x!==id);
    if(typeof detailDialog!=='undefined'&&detailDialog?.open)detailDialog.close();

    localStorage.setItem(storeKey,JSON.stringify(state));
    if(typeof renderAll==='function')renderAll();
    if(typeof renderInactiveDealers==='function')renderInactiveDealers();
    if(typeof logActivity==='function'){
      try{await logActivity('DEALER_DELETED','DEALER',id,{name:d.name});}catch(_){ }
    }

    alert('Bayi silindi: '+d.name);
  }

  window.deleteDealerPermanently=deleteDealerPermanently;

  function installDetailDeleteButton(){
    if(typeof window.showDealer!=='function'||window.showDealer.__deleteWrapped)return;
    const original=window.showDealer;
    const wrapped=function(id){
      const result=original.apply(this,arguments);
      setTimeout(()=>{
        const d=state.dealers.find(x=>x.id===id);
        if(!d||!canDeleteDealer(d))return;
        const detail=document.getElementById('dealerDetail');
        if(!detail||detail.querySelector('[data-delete-dealer]'))return;
        const toolbar=detail.querySelector('.toolbar');
        if(!toolbar)return;
        const actions=toolbar.lastElementChild;
        if(!actions)return;
        const btn=document.createElement('button');
        btn.className='btn btn-danger';
        btn.type='button';
        btn.dataset.deleteDealer='1';
        btn.textContent='Sil';
        btn.onclick=()=>deleteDealerPermanently(id);
        actions.appendChild(btn);
      },0);
      return result;
    };
    wrapped.__deleteWrapped=true;
    window.showDealer=wrapped;
  }

  function installListDeleteButtons(){
    const root=document.getElementById('dealerRows');
    if(!root)return;

    root.querySelectorAll('button[onclick^="showDealer("]').forEach(openBtn=>{
      const toolbar=openBtn.closest('.toolbar');
      if(!toolbar || toolbar.querySelector('[data-delete-dealer-row]'))return;

      const match=(openBtn.getAttribute('onclick')||'').match(/showDealer\('([^']+)'\)/);
      if(!match)return;
      const id=match[1];
      const d=state.dealers.find(x=>x.id===id);
      if(!d||!canDeleteDealer(d))return;

      const btn=document.createElement('button');
      btn.className='btn btn-danger';
      btn.type='button';
      btn.dataset.deleteDealerRow='1';
      btn.textContent='Sil';
      btn.onclick=()=>deleteDealerPermanently(id);

      const directions=[...toolbar.querySelectorAll('button')].find(b=>b.textContent.trim()==='Yol Tarifi');
      toolbar.insertBefore(btn,directions||null);
    });
  }

  function startListObserver(){
    const root=document.getElementById('dealerRows');
    if(!root)return;
    installListDeleteButtons();
    new MutationObserver(()=>installListDeleteButtons()).observe(root,{childList:true,subtree:true});
  }

  function init(){
    setTimeout(installDetailDeleteButton,0);
    setTimeout(startListObserver,0);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init,{once:true});
  }else{
    init();
  }
})();
