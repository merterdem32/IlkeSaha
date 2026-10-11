window.ILKE_SUPABASE = {
  url: "https://yluypvikaglsffpobcmj.supabase.co",
  publishableKey: "sb_publishable_9kZ3cqAmd2pRH11Fh4s5yg_6NalER7h"
};

// Rut Planı2 daha önce yalnızca service worker'ın dönüştürdüğü sayfada yükleniyordu.
// İlk kez açılan tarayıcıda service worker henüz kontrolü almadığı için sekme görünmüyordu.
// Bu küçük yükleyici sayesinde Rut Planı2 ilk sayfa açılışında da her zaman yüklenir.
(() => {
  if (window.__ilkeRoute2LoaderStarted) return;
  window.__ilkeRoute2LoaderStarted = true;

  function loadScript(src, onload) {
    if ([...document.scripts].some(s => (s.getAttribute('src') || '').split('?')[0] === src)) {
      if (onload) setTimeout(onload, 0);
      return;
    }
    const s = document.createElement('script');
    s.src = src + '?v=20261012-2';
    s.async = false;
    if (onload) s.onload = onload;
    s.onerror = () => console.error('İlke Saha script yüklenemedi:', src);
    document.head.appendChild(s);
  }

  loadScript('/route-plan2.js', () => loadScript('/route-plan2-actions.js'));
})();
