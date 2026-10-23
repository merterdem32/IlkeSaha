const CACHE = 'ilke-saha-v94';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/styles.css', '/supabase-config.js', '/cloud.js', '/dealer-management.js', '/daily-report.js', '/z-code.js', '/personal-notes.js', '/potential-dealers.js', '/data-safety.js', '/ui-continuity.js', '/dealer-delete.js', '/route-plan2.js', '/route-plan2-actions.js', '/route-reconciliation.js', '/route-reconciliation-fix.js', '/route-template-editor.js', '/route-plan2-template-seed.js', '/route-planner.js', '/route-planner-regions.js', '/route-planner-fixes.js', '/leaflet-resize-fix.js', '/map-route-add.js', '/map-route-mobile-fix.js', '/map-route-live-panel.js', '/admin-map-filter.js', '/map-route-pin-status.js', '/road-routing-engine.js', '/road-daily-routing.js', '/road-auto-selection.js', '/road-route-planner.js', '/road-region-planner.js', '/route2-road-ui-fix.js', '/saha1-cari-data-1.js', '/saha1-cari-data-2.js', '/saha1-cari-data-3.js', '/saha1-cari-data-4.js', '/saha1-cari-codes.js', '/cari-code-display.js', '/feature-recovery.js', '/ilke-logo.svg', '/app-icon.svg'];

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
  let html=text.replace(/<section id="authLoading"[\s\S]*?<\/section>\s*/i,'');
  const injection='<script src="/ui-continuity.js?v=20261020-5"></script>\n<script src="/dealer-delete.js?v=20261010-2"></script>\n<script src="/route-plan2.js?v=20261012-3"></script>\n<script src="/leaflet-resize-fix.js?v=20261020-4"></script>\n<script src="/route-plan2-actions.js?v=20261012-6"></script>\n<script src="/route-reconciliation.js?v=20261012-1"></script>\n<script src="/route-reconciliation-fix.js?v=20261012-1"></script>\n<script src="/route-template-editor.js?v=20261013-1"></script>\n<script src="/route-plan2-template-seed.js?v=20261013-1"></script>\n<script src="/route-planner.js?v=20261013-1"></script>\n<script src="/route-planner-regions.js?v=20261013-1"></script>\n<script src="/route-planner-fixes.js?v=20261013-1"></script>\n<script src="/map-route-add.js?v=20261023-2"></script>\n<script src="/map-route-mobile-fix.js?v=20261023-1"></script>\n<script src="/map-route-live-panel.js?v=20261023-2"></script>\n<script src="/admin-map-filter.js?v=20261023-1"></script>\n<script src="/map-route-pin-status.js?v=20261023-1"></script>\n<script src="/road-routing-engine.js?v=20261023-2"></script>\n<script src="/road-daily-routing.js?v=20261023-2"></script>\n<script src="/road-auto-selection.js?v=20261023-2"></script>\n<script src="/road-route-planner.js?v=20261023-2"></script>\n<script src="/road-region-planner.js?v=20261023-1"></script>\n<script src="/route2-road-ui-fix.js?v=20261023-1"></script>\n<script src="/saha1-cari-data-1.js?v=20261023-1"></script>\n<script src="/saha1-cari-data-2.js?v=20261023-1"></script>\n<script src="/saha1-cari-data-3.js?v=20261023-1"></script>\n<script src="/saha1-cari-data-4.js?v=20261023-1"></script>\n<script src="/saha1-cari-codes.js?v=20261023-3"></script>\n<script src="/cari-code-display.js?v=20261023-1"></script>\n<script src="/feature-recovery.js?v=20261023-1"></script>\n';
  html=html.replace('</body>',injection+'</body>');
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