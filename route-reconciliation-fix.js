// Rut Plani2: Izmirli Rot Balans'i 2. hafta Sali'ya tasiyan gorunur liste duzeltmesi.
(()=>{
  const norm=v=>String(v||'').trim().toLocaleUpperCase('tr-TR').replace(/[“”"'`´]/g,'').replace(/\s+/g,' ').replace(/\s*[-–—]\s*/g,'-');
  const loose=v=>norm(v).replace(/[^A-ZÇĞİÖŞÜ0-9]/g,'');
  const isIzmirli=name=>{
    const n=loose(name);
    return n===loose('İZMİRLİ ROT BALANS - MURAT BOZDEMİR')||n===loose('İZMİRLİ ROT BALANS - ÇÖZÜM OTO ELEKTRİK - MURAT BOZDEMİR');
  };
  function dealer(){return (window.state?.dealers||[]).find(d=>isIzmirli(d.name))||null;}
  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function patch(){
    const list=document.getElementById('route2List');if(!list)return;
    const w=Number(document.getElementById('route2Week')?.value||1),day=document.getElementById('route2Day')?.value||'Pazartesi';
    const rows=[...list.querySelectorAll('.route-stop')];
    if(w===2&&day==='Cuma'){
      rows.forEach(r=>{if(isIzmirli(r.querySelector('.route-info strong')?.textContent||''))r.remove();});
      return;
    }
    if(!(w===2&&day==='Salı'))return;
    if(rows.some(r=>isIzmirli(r.querySelector('.route-info strong')?.textContent||'')))return;
    const d=dealer();if(!d||d.isActive===false)return;
    const row=document.createElement('div');row.className='item route-stop route2-reconciled-izmirli';row.dataset.route2Source='121';
    row.innerHTML='<div class="num">21</div><div class="route-info"><strong>'+esc(d.name)+'</strong><span class="muted">'+esc(d.district||'-')+(d.phone?' • '+esc(d.phone):'')+'</span>'+(d.address?'<span class="muted" style="margin-top:3px">'+esc(d.address)+'</span>':'')+'</div><div class="toolbar route-actions"><button class="btn btn-ghost" onclick="showDealer(\''+d.id+'\')">Bayi Aç</button><button class="btn btn-primary" onclick="openVisitModal(\''+d.id+'\')">Görüşme Notu</button><button class="btn btn-accent" onclick="openGoogleMapsDirections(\''+d.id+'\')">Yol Tarifi</button></div>';
    list.appendChild(row);
  }
  setInterval(patch,700);
})();