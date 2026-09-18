/* 地图标记：封面同款手绘小动物图标 */
import bear from './assets/markers/bear.png';
import rabbit from './assets/markers/rabbit.png';
import cat from './assets/markers/cat.png';
import puppy from './assets/markers/puppy.png';
import fox from './assets/markers/fox.png';
import penguin from './assets/markers/penguin.png';

export const MARKER_ICONS = [bear, rabbit, cat, puppy, fox, penguin];

// 次数 → 大小/角标颜色（浅橙→深红，0.9→1.5）
export function markerStyle(count) {
  const t = Math.min((count - 1) / 9, 1);
  const lerp = (a, b) => Math.round(a + (b - a) * t);
  const color = `rgb(${lerp(245, 180)}, ${lerp(158, 38)}, ${lerp(11, 38)})`;
  const scale = Math.min(0.9 + (count - 1) * 0.08, 1.5);
  return { color, scale };
}

function hashSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return Math.abs(seed);
  const s = String(seed || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function animalIconFor(seed = 0) {
  return MARKER_ICONS[hashSeed(seed) % MARKER_ICONS.length];
}

export function travelerContent(scale, color, count, seed = 0) {
  const src = animalIconFor(seed);
  return `<div class="map-animal" style="--pin-scale:${scale};--pin-color:${color}">
    <div class="map-animal-float">
      <div class="map-animal-head">
        <img class="map-animal-img" src="${src}" width="48" height="48" alt="" draggable="false"/>
        <span class="map-animal-shine" aria-hidden="true"></span>
        <span class="map-animal-badge">${count}</span>
      </div>
      <div class="map-animal-stem" aria-hidden="true"></div>
    </div>
    <div class="map-animal-shadow" aria-hidden="true"></div>
  </div>`;
}
