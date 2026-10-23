// İlke Saha - Rut Planı2 gerçek optimizasyon modunu ekranda göster
(()=>{
  const K='ilkeSahaRoute2DraftsV4';
  let original=null,t=null;
  function key(){return String(document.getElementById('route2Week')?.value||1)+'|'+String(document.getElementById('route2Day')?.value||'Pazartesi');}
  function draft(){try{return (JSON.parse(localStorage.getItem(K)||'{}')||{})[key()]||null;}catch(_){return null;}}
  function fixLabels(){
    const d=draft();if(!d?.items?.length)return;
    const road=String(d.optimizationMode||'').startsWith('road');
    const sum=document.getElementById('route2Summary');
    if(sum&&d.optimized){
      const first=sum.querySelector('strong');if(first)first.textContent=road?'Karayolu sürüşüne göre optimize edilmiş günlük sıra':'Yedek mesafe ile optimize edilmiş günlük sıra';
      if(road&&(d.roadKm||d.roadMinutes)){
        let meta=sum.querySelector('.route2-road-metrics');
        if(!meta){meta=document.createElement('div');meta.className='muted route2-road-metrics';meta.style.marginTop='5px';sum.appendChild(meta);}
        meta.textContent=(d.roadKm?d.roadKm.toFixed(1)+' km':'')+(d.roadMinutes?' • '+Math.round(d.roadMinutes)+' dk tahmini sürüş':'');
      }
    }
    const info=document.getElementById('route2MapInfo');
    if(info){
      const old=info.querySelector('.muted');
      if(old)old.textContent=road?'Sıralama gerçek karayolu sürüş süre/mesafesine göre yapılır; evden çıkış ve eve dönüş hesaba dahildir.':'Yol servisi kullanılamadıysa geçici yedek mesafe hesabı kullanılır.';
    }
  }
  function patch(){
    if(original||typeof window.renderRoute2Workspace!=='function')return false;
    original=window.renderRoute2Workspace;
    window.renderRoute2Workspace=function(){const r=original.apply(this,arguments);setTimeout(fixLabels,0);return r;};
    setTimeout(fixLabels,0);return true;
  }
  function start(){clearInterval(t);let n=0;t=setInterval(()=>{n++;if(patch()||n>100)clearInterval(t);},100);}
  document.addEventListener('change',e=>{if(e.target?.id==='route2Week'||e.target?.id==='route2Day')setTimeout(fixLabels,350);},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();