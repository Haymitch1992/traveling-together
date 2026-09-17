// 根据坐标把打卡地点归并到最近的内置城市（80km 内），返回城市名；无法归并返回 null
const path = require('path');
const fs = require('fs');

let cityLib = [];
try {
  cityLib = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'cities.json'), 'utf8'));
} catch (e) {
  console.error('region.js: cities.json 加载失败', e.message);
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const MAX_KM = 80;

function nearestRegion(lat, lng, country) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  let best = null;
  let bestD = Infinity;
  for (const c of cityLib) {
    if (country && c.country !== country) continue;
    const d = haversineKm(lat, lng, c.lat, c.lng);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best && bestD <= MAX_KM ? best.name : null;
}

module.exports = { nearestRegion };
