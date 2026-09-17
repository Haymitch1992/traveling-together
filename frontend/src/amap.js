import { get } from './api';

// 高德地图加载（单例），返回是否成功；插件按需传
let promise = null;

export function loadAmap(plugins = []) {
  if (window.AMap) return Promise.resolve(true);
  if (promise) return promise;
  promise = (async () => {
    let cfg;
    try { cfg = await get('/api/config'); } catch (_) { return false; }
    if (!cfg.amapKey) return false;
    window._AMapSecurityConfig = { securityJsCode: cfg.amapSecurityCode || '' };
    return new Promise((resolve) => {
      const script = document.createElement('script');
      const pluginQs = plugins.length ? `&plugin=${plugins.join(',')}` : '';
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(cfg.amapKey)}${pluginQs}`;
      script.onload = () => resolve(true);
      script.onerror = () => { promise = null; resolve(false); };
      document.head.appendChild(script);
    });
  })();
  return promise;
}

export function haversineKm(a, b) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
