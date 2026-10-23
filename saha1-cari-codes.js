// İlke Saha - Saha1 cari kodu eşleştirme
// v3: bayi adını değiştirmez; cari_code alanına yazar. Daha önce öneklenmiş isimleri temizler.
(()=>{
  const PREFIX_RE=/^(?:TCR\d{2}\.\d{3}|\d{3}\.\d{2}\.\d{4}(?:-Z)?)[\s-]+/i;
  let lastSignature='',running=false,installTimer=null;

  function rows(){return (window.SAHA1_CARI_ROWS||[]).map(r=>({code:r[0],title:r[1],district:r[2]||'',lat:r[3],lng:r[4]}));}
  function norm(v){return String(v||'').toLocaleUpperCase('tr-TR').replace(PREFIX_RE,'').replace(/[^A-ZÇĞİÖŞÜ0-9]+/g,' ').replace(/\b(LIMITED|LİMİTED|ŞİRKETİ|ŞIRKETI|SANAYİ|SANAYI|TİCARET|TICARET|LTD|ŞTİ|STI|ANONİM|ANONIM)\b/g,' ').replace(/\s+/g,' ').trim();}
  function tokens(v){return new Set(norm(v).split(' ').filter(x=>x.length>=3));}
  function tokenScore(a,b){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let inter=0;A.forEach(x=>{if(B.has(x))inter++;});return inter/(A.size+B.size-inter);}
  function coordKey(lat,lng){const a=Number(lat),b=Number(lng);if(!Number.isFinite(a)||!Number.isFinite(b)||!a||!b)return '';return a.toFixed(6)+'|'+b.toFixed(6);}
  function sourceCoordCounts(source){const m=new Map();source.forEach(r=>{const k=coordKey(r.lat,r.lng);if(k)m.set(k,(m.get(k)||0)+1);});return m;}
  function coordDist(d,r){const a=Number(d.lat),b=Number(d.lng),c=Number(r.lat),e=Number(r.lng);if(!Number.isFinite(a)||!Number.isFinite(b)||!Number.isFinite(c)||!Number.isFinite(e)||!a||!b||!c||!e)return Infinity;return Math.hypot(a-c,b-e);}

  function bestMatch(dealer,source,coordCounts){
    const raw=String(dealer.name||'').replace(PREFIX_RE,'').trim(),n=norm(raw),dd=norm(dealer.district);let best=null,bestScore=-1;
    for(const r of source){
      const rn=norm(r.title),rd=norm(r.district),ck=coordKey(r.lat,r.lng),cd=coordDist(dealer,r),ts=tokenScore(raw,r.title);let score=0;
      if(n&&rn&&n===rn)score=120;
      else if(n&&rn&&(n.includes(rn)||rn.includes(n)))score=105;
      else if(cd<0.00003&&ck&&coordCounts.get(ck)===1)score=100;
      else if(ts>=0.72)score=88+ts*10;
      else if(ts>=0.48&&dd&&rd&&dd===rd)score=76+ts*12;
      else if(cd<0.00005&&ts>=0.30)score=78+ts*10;
      if(score>bestScore){bestScore=score;best=r;}
    }
    return bestScore>=78?best:null;
  }

  async function saha1Id(){
    try{
      if(typeof teamProfilesById!=='undefined'&&teamProfilesById){for(const [id,p] of teamProfilesById.entries()){const u=String(p?.username||'').toLocaleLowerCase('tr-TR'),e=String(p?.email||'').toLocaleLowerCase('tr-TR');if(u==='saha1'||e.startsWith('saha1@'))return id;}}
      if(typeof supabaseClient!=='undefined'&&supabaseClient&&teamContext?.organizationId){
        const [mRes,pRes]=await Promise.all([supabaseClient.from('organization_members').select('user_id,role,is_active').eq('organization_id',teamContext.organizationId).eq('is_active',true),supabaseClient.from('profiles').select('user_id,username,email')]);
        if(!mRes.error&&!pRes.error){const ids=new Set((mRes.data||[]).filter(x=>x.role==='FIELD_STAFF').map(x=>x.user_id));const p=(pRes.data||[]).find(x=>ids.has(x.user_id)&&String(x.username||'').toLocaleLowerCase('tr-TR')==='saha1')||(pRes.data||[]).find(x=>ids.has(x.user_id)&&String(x.email||'').toLocaleLowerCase('tr-TR').startsWith('saha1@'));if(p?.user_id)return p.user_id;}
      }
    }catch(_){ }
    return null;
  }

  function hydrated(){return typeof cloudHydrating==='undefined'||cloudHydrating===false;}
  function signature(mine){return mine.map(d=>d.id+'|'+(d.cariCode||'')+'|'+(d.name||'')).sort().join('~');}

  async function persist(changes){
    if(!changes.length||typeof supabaseClient==='undefined'||!supabaseClient||!teamContext?.organizationId)return;
    for(let i=0;i<changes.length;i+=12){
      const batch=changes.slice(i,i+12);
      const results=await Promise.all(batch.map(x=>supabaseClient.from('organization_dealers').update({cari_code:x.code,name:x.name,updated_by:cloudUser.id,updated_at:new Date().toISOString()}).eq('organization_id',teamContext.organizationId).eq('id',x.id)));
      const bad=results.find(r=>r.error);if(bad?.error)throw bad.error;
    }
  }

  async function apply(force=false){
    if(running||typeof state==='undefined'||!Array.isArray(state.dealers)||!cloudUser||!teamContext?.organizationId||!hydrated())return;
    const source=rows();if(!source.length)return;const sid=await saha1Id();if(!sid)return;
    const mine=state.dealers.filter(d=>d.assignedUserId===sid);if(!mine.length)return;
    const before=signature(mine);if(!force&&before===lastSignature)return;
    running=true;
    try{
      const coordCounts=sourceCoordCounts(source),changes=[];let matched=0;
      for(const d of mine){
        let m=d.cariCode?source.find(r=>r.code===d.cariCode)||null:null;if(!m)m=bestMatch(d,source,coordCounts);if(!m)continue;matched++;
        const base=String(d.name||'').replace(PREFIX_RE,'').trim();
        if(d.cariCode!==m.code||d.name!==base){d.cariCode=m.code;d.name=base;changes.push({id:d.id,code:m.code,name:base});}
      }
      if(changes.length){await persist(changes);try{localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){ }if(typeof renderAll==='function')renderAll();if(typeof renderMap==='function')try{renderMap();}catch(_){}}
      lastSignature=signature(mine);
      window.SAHA1_CARI_MATCH_SUMMARY={total:mine.length,matched,changed:changes.length,source:source.length};
      console.info('Saha1 cari kodu eşleştirme',window.SAHA1_CARI_MATCH_SUMMARY);
      if(typeof window.refreshCariCodeDisplay==='function')setTimeout(window.refreshCariCodeDisplay,0);
    }catch(err){console.error('Saha1 cari kodu kaydı başarısız',err);lastSignature='';}
    finally{running=false;}
  }

  function start(){clearInterval(installTimer);let tries=0;installTimer=setInterval(()=>{tries++;if(cloudUser&&teamContext?.organizationId&&hydrated()&&Array.isArray(state?.dealers)&&state.dealers.length){apply();}if(tries>600){clearInterval(installTimer);installTimer=null;}},500);}
  window.refreshSaha1CariCodes=()=>apply(true);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(()=>apply(true),300);});
  window.addEventListener('focus',()=>setTimeout(()=>apply(),250));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();