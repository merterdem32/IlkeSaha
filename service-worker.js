const CACHE = 'ilke-saha-v52';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/styles.css', '/supabase-config.js', '/cloud.js', '/dealer-management.js', '/daily-report.js', '/z-code.js', '/personal-notes.js', '/potential-dealers.js', '/ui-resume.js', '/ilke-logo.svg', '/app-icon.svg'];

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

async function injectResumeScript(response){
  try{
    const type=response.headers.get('content-type')||'';
    if(!type.includes('text/html')) return response;
    let html=await response.text();
    if(!html.includes('/ui-resume.js')){
      html=html.replace('</body>','<script src="/ui-resume.js?v=20261007-1"></script>\n</body>');
    }
    const headers=new Headers(response.headers);
    headers.delete('content-length');
    return new Response(html,{status:response.status,statusText:response.statusText,headers});
  }catch(_){
    return response;
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch(event.request)
        .then(async response => {
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put('/index.html',copy));
          return injectResumeScript(response);
        })
        .catch(async ()=>{
          const cached=await caches.match('/index.html');
          return cached ? injectResumeScript(cached) : Response.error();
        })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(r => r || caches.match('/index.html')))
  );
});
