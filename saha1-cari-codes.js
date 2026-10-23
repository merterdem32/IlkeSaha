// İlke Saha - Saha1 cari kodu eşleştirme ve bayi adının başında gösterme
(()=>{
  const PREFIX_RE=/^(?:TCR\d{2}\.\d{3}|\d{3}\.\d{2}\.\d{4}(?:-Z)?)[\s-]+/i;
  let ran=false;

  function rows(){return (window.SAHA1_CARI_ROWS||[]).map(r=>({code:r[0],title:r[1],district:r[2]||'',lat:r[3],lng:r[4]}));}
  function norm(v){
    return String(v||'').toLocaleUpperCase('tr-TR')
      .replace(PREFIX_RE,'')
      .replace(/[^A-ZÇĞİÖŞÜ0-9]+/g,' ')
      .replace(/\b(LIMITED|LİMİTED|ŞİRKETİ|ŞIRKETI|SANAYİ|SANAYI|TİCARET|TICARET|LTD|ŞTİ|STI|ANONİM|ANONIM|OTOMOTİV|OTOMOTIV)\b/g,' ')
      .replace(/\s+/g,' ').trim();
  }
  function tokens(v){return new Set(norm(v).split(' ').filter(x=>x.length>=3));}
  function tokenScore(a,b){
    const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;
    let inter=0;A.forEach(x=>{if(B.has(x))inter++;});
    return inter/(A.size+B.size-inter);
  }
  function coordKey(lat,lng){
    const a=Number(lat),b=Number(lng);if(!Number.isFinite(a)||!Number.isFinite(b)||!a||!b)return '';
    return a.toFixed(6)+'|'+b.toFixed(6);
  }
  function sourceCoordCounts(source){
    const m=new Map();source.forEach(r=>{const k=coordKey(r.lat,r.lng);if(k)m.set(k,(m.get(k)||0)+1);});return m;
  }
  function coordDist(d,r){
    const a=Number(d.lat),b=Number(d.lng),c=Number(r.lat),e=Number(r.lng);
    if(!Number.isFinite(a)||!Number.isFinite(b)||!Number.isFinite(c)||!Number.isFinite(e)||!a||!b||!c||!e)return Infinity;
    return Math.hypot(a-c,b-e);
  }

  function bestMatch(dealer,source,coordCounts){
    const raw=String(dealer.name||'').replace(PREFIX_RE,'').trim(),n=norm(raw),dd=norm(dealer.district);
    let best=null,bestScore=-1;
    for(const r of source){
      const rn=norm(r.title),rd=norm(r.district);let score=0;
      const ck=coordKey(r.lat,r.lng),cd=coordDist(dealer,r),ts=tokenScore(raw,r.title);
      if(n&&rn&&n===rn)score=115;
      else if(n&&rn&&(n.includes(rn)||rn.includes(n)))score=100;
      else if(cd<0.00003&&ck&&coordCounts.get(ck)===1)score=96;
      else if(ts>=0.75)score=82+ts*10;
      else if(ts>=0.55&&dd&&rd&&dd===rd)score=70+ts*10;
      else if(cd<0.00003&&ts>=0.35)score=72+ts*10;
      if(score>bestScore){bestScore=score;best=r;}
    }
    return bestScore>=75?best:null;
  }

  async function saha1Id(){
    try{
      if(typeof teamProfilesById!=='undefined'&&teamProfilesById){
        for(const [id,p] of teamProfilesById.entries()){
          const u=String(p?.username||'').toLocaleLowerCase('tr-TR'),e=String(p?.email||'').toLocaleLowerCase('tr-TR');
          if(u==='saha1'||e.startsWith('saha1@'))return id;
        }
      }
      if(typeof supabaseClient!=='undefined'&&supabaseClient&&teamContext?.organizationId){
        const [mRes,pRes]=await Promise.all([
          supabaseClient.from('organization_members').select('user_id,role,is_active').eq('organization_id',teamContext.organizationId).eq('is_active',true),
          supabaseClient.from('profiles').select('user_id,username,email')
        ]);
        if(!mRes.error&&!pRes.error){
          const ids=new Set((mRes.data||[]).filter(x=>x.role==='FIELD_STAFF').map(x=>x.user_id));
          const p=(pRes.data||[]).find(x=>ids.has(x.user_id)&&String(x.username||'').toLocaleLowerCase('tr-TR')==='saha1')
            ||(pRes.data||[]).find(x=>ids.has(x.user_id)&&String(x.email||'').toLocaleLowerCase('tr-TR').startsWith('saha1@'));
          if(p?.user_id)return p.user_id;
        }
      }
    }catch(_){ }
    return null;
  }

  async function apply(){
    if(ran||typeof state==='undefined'||!Array.isArray(state.dealers)||!cloudUser||!teamContext?.organizationId)return;
    const source=rows();if(!source.length)return;
    const sid=await saha1Id();if(!sid)return;
    const coordCounts=sourceCoordCounts(source),mine=state.dealers.filter(d=>d.assignedUserId===sid);
    let changed=0,matched=0;
    for(const d of mine){
      let m=null;
      if(d.cariCode){m=source.find(r=>r.code===d.cariCode)||null;}
      if(!m)m=bestMatch(d,source,coordCounts);
      if(!m)continue;
      matched++;
      const base=String(d.name||'').replace(PREFIX_RE,'').trim();
      const next=m.code+' - '+base;
      if(d.cariCode!==m.code||d.name!==next){d.cariCode=m.code;d.name=next;changed++;}
    }
    ran=true;
    window.SAHA1_CARI_MATCH_SUMMARY={total:mine.length,matched,changed,source:source.length};
    console.info('Saha1 cari kodu eşleştirme',window.SAHA1_CARI_MATCH_SUMMARY);
    if(changed){
      try{localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){ }
      if(typeof renderAll==='function')renderAll();
      if(typeof scheduleCloudSync==='function')scheduleCloudSync();
    }
  }

  function start(){
    let tries=0;const t=setInterval(()=>{
      tries++;
      if(typeof state!=='undefined'&&typeof cloudUser!=='undefined'&&cloudUser&&typeof teamContext!=='undefined'&&teamContext?.organizationId){clearInterval(t);apply();}
      else if(tries>160)clearInterval(t);
    },150);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!ran)apply();});
})();
