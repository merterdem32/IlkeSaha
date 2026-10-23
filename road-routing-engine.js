// İlke Saha - gerçek yol ağına göre rota motoru
// OSRM sürüş süre/mesafe matrisi kullanır. Servis erişilemezse kuş uçuşu yedeğine düşer.
(()=>{
  const BASE='https://router.project-osrm.org';
  const CACHE_KEY='ilkeSahaRoadMatrixCacheV1';
  const CACHE_TTL=24*60*60*1000;
  const CHUNK=38; // table isteğinde source+destination < 80 koordinat
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const valid=p=>p&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lng);
  const keyPoint=p=>(+p.lat).toFixed(5)+','+(+p.lng).toFixed(5);
  const hav=(a,b)=>{const R=6371,r=x=>x*Math.PI/180,dLat=r(+b.lat-+a.lat),dLng=r(+b.lng-+a.lng),h=Math.sin(dLat/2)**2+Math.cos(r(+a.lat))*Math.cos(r(+b.lat))*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(h));};

  function readCache(){try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')||{};}catch(_){return {};}}
  function writeCache(v){try{localStorage.setItem(CACHE_KEY,JSON.stringify(v));}catch(_){}}
  function signature(points){return points.map(keyPoint).join('|');}
  function matrixFallback(points){
    const n=points.length,durations=Array.from({length:n},()=>Array(n).fill(0)),distances=Array.from({length:n},()=>Array(n).fill(0));
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){if(i===j)continue;const km=hav(points[i],points[j]);distances[i][j]=km*1000;durations[i][j]=(km/35)*3600;}
    return {durations,distances,mode:'air-fallback'};
  }

  async function tableBlock(src,dst){
    const pts=[...src,...dst];
    const coords=pts.map(p=>(+p.lng)+','+(+p.lat)).join(';');
    const sources=src.map((_,i)=>i).join(';');
    const destinations=dst.map((_,i)=>src.length+i).join(';');
    const url=BASE+'/table/v1/driving/'+coords+'?sources='+sources+'&destinations='+destinations+'&annotations=duration,distance';
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
    try{
      const r=await fetch(url,{signal:controller.signal});
      if(!r.ok)throw new Error('Yol servisi HTTP '+r.status);
      const j=await r.json();if(j.code!=='Ok'||!j.durations)throw new Error(j.message||'Yol matrisi alınamadı');
      return j;
    }finally{clearTimeout(timer);}
  }

  async function buildMatrix(points,onProgress){
    const clean=points.map(p=>({lat:+p.lat,lng:+p.lng}));
    if(!clean.length||clean.some(p=>!valid(p)))return matrixFallback(clean);
    const sig=signature(clean),cache=readCache(),hit=cache[sig];
    if(hit&&Date.now()-hit.savedAt<CACHE_TTL&&hit.durations?.length===clean.length)return {...hit,mode:'road-cache'};
    const n=clean.length,durations=Array.from({length:n},()=>Array(n).fill(null)),distances=Array.from({length:n},()=>Array(n).fill(null));
    const blocks=[];
    for(let a=0;a<n;a+=CHUNK)for(let b=0;b<n;b+=CHUNK)blocks.push([a,Math.min(a+CHUNK,n),b,Math.min(b+CHUNK,n)]);
    try{
      for(let bi=0;bi<blocks.length;bi++){
        const [a1,a2,b1,b2]=blocks[bi],src=clean.slice(a1,a2),dst=clean.slice(b1,b2);
        if(onProgress)onProgress(bi+1,blocks.length);
        const j=await tableBlock(src,dst);
        for(let i=0;i<src.length;i++)for(let k=0;k<dst.length;k++){
          durations[a1+i][b1+k]=Number.isFinite(j.durations?.[i]?.[k])?j.durations[i][k]:null;
          distances[a1+i][b1+k]=Number.isFinite(j.distances?.[i]?.[k])?j.distances[i][k]:null;
        }
        if(blocks.length>1&&bi<blocks.length-1)await sleep(90);
      }
      // Yol bulunamayan nadir çiftleri yalnızca o hücre için kuş uçuşu yedeğiyle doldur.
      for(let i=0;i<n;i++)for(let j=0;j<n;j++){
        if(i===j){durations[i][j]=0;distances[i][j]=0;continue;}
        if(!Number.isFinite(durations[i][j])||!Number.isFinite(distances[i][j])){const km=hav(clean[i],clean[j]);distances[i][j]=km*1000;durations[i][j]=(km/30)*3600;}
      }
      const out={durations,distances,savedAt:Date.now(),mode:'road'};
      // Cache büyümesini sınırlı tut.
      const next={};Object.entries(cache).filter(([,v])=>Date.now()-(v.savedAt||0)<CACHE_TTL).slice(-2).forEach(([k,v])=>next[k]=v);next[sig]=out;writeCache(next);
      return out;
    }catch(err){console.warn('Road matrix fallback',err);return {...matrixFallback(clean),error:String(err?.message||err)};}
  }

  function routeCost(order,m){
    if(!order.length)return 0;let s=m.durations[0][order[0]]||0;
    for(let i=0;i<order.length-1;i++)s+=m.durations[order[i]][order[i+1]]||0;
    s+=m.durations[order[order.length-1]][0]||0;return s;
  }

  function optimizeIndices(indices,m){
    if(indices.length<=1)return indices.slice();
    // Kullanıcı saha kuralı: evden yol süresi en yüksek olan bölgede başla, eve dönerek bitir.
    let first=[...indices].sort((a,b)=>(m.durations[0][b]||0)-(m.durations[0][a]||0))[0];
    const remaining=indices.filter(x=>x!==first),out=[first];let cur=first;
    while(remaining.length){let bi=0,bs=Infinity;for(let i=0;i<remaining.length;i++){
      const x=remaining[i],hop=m.durations[cur][x]||1e9;
      const away=Math.max(0,(m.durations[x][0]||0)-(m.durations[cur][0]||0));
      const score=hop+away*.35;
      if(score<bs){bs=score;bi=i;}
    }cur=remaining.splice(bi,1)[0];out.push(cur);}
    // İlk durağı sabit tutup 2-opt ile gerçek sürüş süresini kısalt.
    let best=out.slice(),bestCost=routeCost(best,m),changed=true,pass=0;
    while(changed&&pass++<40){changed=false;for(let i=1;i<best.length-1;i++)for(let k=i+1;k<best.length;k++){
      const c=best.slice(0,i).concat(best.slice(i,k+1).reverse(),best.slice(k+1)),cost=routeCost(c,m);
      if(cost+1<bestCost){best=c;bestCost=cost;changed=true;}
    }}
    return best;
  }

  async function optimizeDealers(dealers,home,onProgress){
    const located=(dealers||[]).filter(d=>valid(d)),missing=(dealers||[]).filter(d=>!valid(d));
    if(!located.length)return {dealers:[...missing],roadKm:0,roadMinutes:0,mode:'none'};
    const pts=[home,...located.map(d=>({lat:+d.lat,lng:+d.lng}))],m=await buildMatrix(pts,onProgress);
    const order=optimizeIndices(located.map((_,i)=>i+1),m),sorted=order.map(i=>located[i-1]);
    let meters=0,seconds=0,cur=0;for(const idx of order){meters+=m.distances[cur][idx]||0;seconds+=m.durations[cur][idx]||0;cur=idx;}meters+=m.distances[cur][0]||0;seconds+=m.durations[cur][0]||0;
    return {dealers:[...sorted,...missing],roadKm:meters/1000,roadMinutes:seconds/60,mode:m.mode,error:m.error||null};
  }

  function sym(m,a,b){return ((m.durations[a][b]||1e9)+(m.durations[b][a]||1e9))/2;}
  function capacities(n,k){const q=Math.floor(n/k),r=n%k;return Array.from({length:k},(_,i)=>q+(i<r?1:0));}
  function medoid(cluster,m){let best=cluster[0],bs=Infinity;for(const a of cluster){let s=0;for(const b of cluster)s+=sym(m,a,b);if(s<bs){bs=s;best=a;}}return best;}
  function clusterRoad(indices,k,m){
    if(k<=1)return [indices.slice()];const caps=capacities(indices.length,k);
    let first=[...indices].sort((a,b)=>(m.durations[0][b]||0)-(m.durations[0][a]||0))[0],seeds=[first];
    while(seeds.length<k){let best=null,bs=-1;for(const p of indices){if(seeds.includes(p))continue;const s=Math.min(...seeds.map(x=>sym(m,p,x)));if(s>bs){bs=s;best=p;}}if(best==null)break;seeds.push(best);}
    let clusters=[];
    for(let pass=0;pass<5;pass++){
      clusters=Array.from({length:k},()=>[]);const rem=caps.slice();
      const items=[...indices].sort((a,b)=>Math.min(...seeds.map(s=>sym(m,b,s)))-Math.min(...seeds.map(s=>sym(m,a,s))));
      for(const p of items){let bi=-1,bs=Infinity;for(let i=0;i<k;i++){if(rem[i]<=0)continue;const s=sym(m,p,seeds[i]);if(s<bs){bs=s;bi=i;}}if(bi<0)bi=0;clusters[bi].push(p);rem[bi]--;}
      seeds=clusters.map((c,i)=>c.length?medoid(c,m):seeds[i]);
    }
    return clusters;
  }

  async function planTwoWeeks(dealers,home,onProgress){
    const located=(dealers||[]).filter(d=>valid(d)),missing=(dealers||[]).filter(d=>!valid(d));
    if(!located.length)return {days:Array.from({length:12},()=>[]),mode:'none',roadKm:0,roadMinutes:0};
    const pts=[home,...located.map(d=>({lat:+d.lat,lng:+d.lng}))],m=await buildMatrix(pts,onProgress);
    const indices=located.map((_,i)=>i+1),k=Math.min(12,indices.length),clusters=clusterRoad(indices,k,m);
    let days=Array.from({length:12},()=>[]);
    clusters.forEach((c,i)=>days[i]=optimizeIndices(c,m));
    // Konumsuzları aynı ilçeden bayi bulunan güne, yoksa en az dolu güne ekle.
    for(const d of missing){let di=-1;if(d.district){di=days.findIndex(arr=>arr.some(idx=>String(located[idx-1]?.district||'').toLocaleUpperCase('tr-TR')===String(d.district||'').toLocaleUpperCase('tr-TR')));}if(di<0)di=days.map((x,i)=>({i,n:x.length})).sort((a,b)=>a.n-b.n)[0].i;days[di].push({missing:d});}
    let totalM=0,totalS=0;
    const mapped=days.map(arr=>{
      const road=arr.filter(x=>typeof x==='number'),extra=arr.filter(x=>typeof x!=='number').map(x=>x.missing),out=road.map(i=>located[i-1]);
      if(road.length){let cur=0;for(const idx of road){totalM+=m.distances[cur][idx]||0;totalS+=m.durations[cur][idx]||0;cur=idx;}totalM+=m.distances[cur][0]||0;totalS+=m.durations[cur][0]||0;}
      return [...out,...extra];
    });
    return {days:mapped,mode:m.mode,roadKm:totalM/1000,roadMinutes:totalS/60,error:m.error||null};
  }

  window.ilkeRoadRouting={buildMatrix,optimizeDealers,planTwoWeeks};
})();