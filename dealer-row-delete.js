// Bayiler listesinde doğrudan kalıcı silme kontrolü.
// Yanlış eklenen ve geçmiş kaydı olmayan bayiler için kullanılır.
(() => {
  async function deleteDealerFromList(id){
    const d=(window.state?.dealers||[]).find(x=>x.id===id);
    if(!d){ alert('Bayi kaydı bulunamadı.'); return; }

    const isManager=window.teamContext?.role==='MANAGER';
    const isMine=d.assignedUserId===window.cloudUser?.id;
    if(!isManager && !isMine){
      alert('Bu bayiyi silme yetkin yok.');
      return;
    }

    const visitCount=(window.state?.visits||[]).filter(v=>v.dealerId===id).length;
    const paymentCount=(window.state?.payments||[]).filter(p=>p.dealerId===id).length;
    if(visitCount || paymentCount){
      alert('Bu bayinin geçmiş kaydı var ('+visitCount+' ziyaret, '+paymentCount+' ödeme). Geçmişi kaybetmemek için kalıcı silme yerine Rut Dışı Bırak kullanılmalı.');
      return;
    }

    if(!confirm('“'+d.name+'” bayisi tamamen silinsin mi?\n\nBu işlem geri alınamaz.')) return;

    try{
      if(window.supabaseClient && window.teamContext?.organizationId){
        const {error}=await window.supabaseClient
          .from('organization_dealers')
          .delete()
          .eq('organization_id',window.teamContext.organizationId)
          .eq('id',id);
        if(error) throw error;
      }

      window.state.dealers=window.state.dealers.filter(x=>x.id!==id);
      if(Array.isArray(window.state.todayRoute)){
        window.state.todayRoute=window.state.todayRoute.filter(x=>x!==id);
      }
      localStorage.setItem('ilkeSahaPrototypeV02',JSON.stringify(window.state));

      if(typeof window.logActivity==='function'){
        try{ await window.logActivity('DEALER_DELETED','DEALER',id,{name:d.name}); }catch(_){}
      }
      if(typeof window.renderAll==='function') window.renderAll();
      if(typeof window.renderDealers==='function') window.renderDealers();
      alert('Bayi silindi.');
    }catch(err){
      console.error('Dealer delete failed',err);
      alert('Bayi silinemedi: '+(err?.message||err)+'\n\nSupabase silme yetkisi henüz açılmadıysa supabase-team-phase10-dealer-delete.sql dosyasını bir kez çalıştır.');
    }
  }

  window.deleteDealerFromList=deleteDealerFromList;

  function decorateRows(){
    const root=document.getElementById('dealerRows');
    if(!root)return;
    root.querySelectorAll('button[onclick^="showDealer("]').forEach(openBtn=>{
      const toolbar=openBtn.closest('.toolbar');
      if(!toolbar || toolbar.querySelector('.dealer-row-delete-btn')) return;
      const m=(openBtn.getAttribute('onclick')||'').match(/showDealer\('([^']+)'\)/);
      if(!m)return;
      const id=m[1];
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='btn btn-danger dealer-row-delete-btn';
      btn.textContent='Sil';
      btn.onclick=()=>deleteDealerFromList(id);
      const directions=[...toolbar.querySelectorAll('button')].find(b=>b.textContent.trim()==='Yol Tarifi');
      toolbar.insertBefore(btn,directions||null);
    });
  }

  function init(){
    decorateRows();
    const root=document.getElementById('dealerRows');
    if(root){
      new MutationObserver(()=>decorateRows()).observe(root,{childList:true,subtree:true});
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
