const CACHE = 'ilke-saha-v59';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/styles.css', '/supabase-config.js', '/cloud.js', '/dealer-management.js', '/daily-report.js', '/z-code.js', '/personal-notes.js', '/potential-dealers.js', '/data-safety.js', '/ui-continuity.js', '/dealer-delete.js', '/ilke-logo.svg', '/app-icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

async function transformIndexResponse(response){
  const text=await response.text();
  let html=text
    .replace(/<section id="authLoading"[\s\S]*?<\/section>\s*/i,'')
    .replace('</body>','<script src="/ui-continuity.js?v=20261010-2"></script>\n<script src="/dealer-delete.js?v=20261010-2"></script>\n</body>');
  return new Response(html,{
    status:response.status,
    statusText:response.statusText,
    headers:{'Content-Type':'text/html; charset=utf-8'}
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url=new URL(event.request.url);
  const isNavigation=event.request.mode==='navigate' || url.pathname==='/' || url.pathname==='/index.html';

  if(isNavigation){
    event.respondWith((async()=>{
      try{
        const network=await fetch(event.request);
        const cacheCopy=network.clone();
        caches.open(CACHE).then(cache=>cache.put('/index.html',cacheCopy)).catch(()=>{});
        return await transformIndexResponse(network);
      }catch(_){
        const cached=await caches.match('/index.html');
        if(cached)return await transformIndexResponse(cached);
        throw _;
      }
    })());
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
