// İlke Saha - Admin harita personel filtresi
(()=>{
  let selectedStaff='all';
  let installTimer=null;
  let originalRenderMap=null;
  let shouldFit=true;

  function isManager(){return typeof teamContext!=='undefined'&&teamContext?.role==='MANAGER';}
  function ready(){return isManager()&&typeof state!=='undefined'&&Array.isArray(state.dealers);}
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  async function loadStaff(){
    try{if(typeof loadManagerDirectory==='function')await loadManagerDirectory();}catch(_){ }
    const ms=(typeof managerDirectoryCache!=='undefined'&&managerDirectoryCache?.members)||[];
    const ps=(typeof managerDirectoryCache!=='undefined'&&managerDirectoryCache?.profiles)||new Map();
    return ms.filter(x=>x.role==='FIELD_STAFF'&&x.is_active!==false).map(x=>{
      const p=ps.get(x.user_id)||{};
      return {id:x.user_id,label:p.full_name||p.username||p.email||x.user_id,username:p.username||''};
    });
  }

  function ensureStyles(){
    if(document.getElementById('adminMapFilterStyles'))return;
    const s=document.createElement('style');
    s.id='adminMapFilterStyles';
    s.textContent=`
      #adminMapFilterBar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 12px}
      #adminMapFilterBar .amf-btn{border:1px solid #d8dde6;background:#fff;border-radius:10px;padding:9px 12px;font-weight:800;cursor:pointer}
      #adminMapFilterBar .amf-btn.active{background:#e30613;color:#fff;border-color:#e30613}
      #adminMapFilterSummary{font-size:13px;color:#64748b;margin-left:auto}
      @media(max-width:700px){#adminMapFilterSummary{width:100%;margin-left:0}}
    `;
    document.head.appendChild(s);
  }

  async function ensureBar(){
    if(!ready())return false;
    const mapEl=document.getElementById('map');if(!mapEl)return false;
    ensureStyles();
    let bar=document.getElementById('adminMapFilterBar');
    if(!bar){
      bar=document.createElement('div');bar.id='adminMapFilterBar';
      const card=mapEl.parentElement;
      card?.insertBefore(bar,mapEl);
    }
    const staff=await loadStaff();
    if(!staff.length){bar.innerHTML='<span class="muted">Saha personeli bulunamadı.</span>';return true;}
    if(selectedStaff!=='all'&&!staff.some(x=>x.id===selectedStaff))selectedStaff='all';
    bar.innerHTML='<button class="amf-btn '+(selectedStaff==='all'?'active':'')+'" type="button" data-staff="all">Tüm Bayiler</button>'+
      staff.map(x=>'<button class="amf-btn '+(selectedStaff===x.id?'active':'')+'" type="button" data-staff="'+esc(x.id)+'">'+esc(x.label)+'</button>').join('')+
      '<span id="adminMapFilterSummary"></span>';
    bar.querySelectorAll('[data-staff]').forEach(btn=>btn.addEventListener('click',()=>{
      selectedStaff=btn.dataset.staff||'all';
      shouldFit=true;
      window.adminMapSelectedStaff=selectedStaff;
      ensureBar();
      if(typeof window.renderMap==='function')window.renderMap();
      if(typeof window.refreshMapRouteLivePanel==='function')setTimeout(()=>window.refreshMapRouteLivePanel(),60);
    }));
    window.adminMapSelectedStaff=selectedStaff;
    return true;
  }

  function dealerForMarker(marker){
    try{
      if(!marker?.getLatLng)return null;
      const p=marker.getLatLng();
      return (state.dealers||[]).find(d=>typeof isValidDealerCoordinate==='function'&&isValidDealerCoordinate(d.lat,d.lng)&&Math.abs(Number(d.lat)-Number(p.lat))<0.000001&&Math.abs(Number(d.lng)-Number(p.lng))<0.000001)||null;
    }catch(_){return null;}
  }

  function applyMarkerFilter(){
    if(!ready()||typeof map==='undefined'||!map||typeof mainMarkers==='undefined')return;
    const dealers=(state.dealers||[]).filter(d=>d.isActive!==false&&(selectedStaff==='all'||d.assignedUserId===selectedStaff)&&typeof isValidDealerCoordinate==='function'&&isValidDealerCoordinate(d.lat,d.lng));
    let shown=0;
    (mainMarkers||[]).forEach(marker=>{
      const d=dealerForMarker(marker);
      if(!d)return;
      const should=selectedStaff==='all'||d.assignedUserId===selectedStaff;
      const on=map.hasLayer(marker);
      try{
        if(should&&!on)marker.addTo(map);
        else if(!should&&on)map.removeLayer(marker);
        if(should)shown++;
      }catch(_){ }
    });
    const summary=document.getElementById('adminMapFilterSummary');
    if(summary)summary.textContent=shown+' bayi haritada';

    if(shouldFit&&dealers.length){
      try{
        const pts=dealers.map(d=>[Number(d.lat),Number(d.lng)]);
        map.fitBounds(pts,{padding:[30,30],maxZoom:14});
      }catch(_){ }
      shouldFit=false;
    }
  }

  function patchRenderMap(){
    if(originalRenderMap||typeof window.renderMap!=='function')return false;
    originalRenderMap=window.renderMap;
    window.renderMap=function(){
      const r=originalRenderMap.apply(this,arguments);
      setTimeout(applyMarkerFilter,0);
      return r;
    };
    return true;
  }

  async function install(){
    if(!ready())return false;
    await ensureBar();patchRenderMap();
    if(document.getElementById('mapsec')?.classList.contains('active'))setTimeout(applyMarkerFilter,0);
    return true;
  }

  function start(){
    clearInterval(installTimer);let tries=0;
    installTimer=setInterval(async()=>{tries++;if(await install()||tries>120){clearInterval(installTimer);installTimer=null;}},120);
  }

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('nav button[data-section="mapsec"]'))setTimeout(()=>{install();applyMarkerFilter();},180);
  },true);

  window.getAdminMapSelectedStaff=()=>selectedStaff;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
