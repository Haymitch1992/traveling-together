/* 地图标记：立体卡通旅行者（挥手小人 + 背包），SVG 伪立体（高光+阴影） */
const TRAVELER_SVG = `
  <!-- 地面阴影 -->
  <ellipse cx="20" cy="45" rx="10" ry="2.5" fill="rgba(74,64,57,0.2)"/>
  <!-- 背包（身体右后侧） -->
  <rect x="25" y="18" width="11" height="14" rx="4" fill="#F5B84C" stroke="#E8A93E" stroke-width="1"/>
  <rect x="27" y="21" width="7" height="4" rx="2" fill="#E8A93E"/>
  <!-- 腿 + 鞋 -->
  <rect x="14" y="34" width="5" height="9" rx="2.5" fill="#5B7A9D"/>
  <rect x="21" y="34" width="5" height="9" rx="2.5" fill="#4E6B8C"/>
  <ellipse cx="16.5" cy="43.5" rx="3.5" ry="1.8" fill="#4A4039"/>
  <ellipse cx="23.5" cy="43.5" rx="3.5" ry="1.8" fill="#4A4039"/>
  <!-- 身体（橘色上衣 + 高光） -->
  <rect x="12" y="20" width="16" height="16" rx="6" fill="#E76F51"/>
  <ellipse cx="16" cy="24" rx="4" ry="3" fill="#F48B6B"/>
  <!-- 挥手的手臂 -->
  <path d="M13,24 Q6,20 5,12" stroke="#F7C491" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <circle cx="5" cy="11" r="2.5" fill="#F7C491"/>
  <!-- 头（皮肤渐变感：底色 + 高光） -->
  <circle cx="19" cy="11" r="8" fill="#F7C491"/>
  <ellipse cx="16" cy="8" rx="4" ry="2.5" fill="#FFDFC2" opacity="0.75"/>
  <!-- 头发 -->
  <path d="M11,10 Q11,3 19,3 Q27,3 27,10 Q23,6 19,6 Q15,6 11,10 Z" fill="#6B4A2F"/>
  <!-- 表情 -->
  <circle cx="16" cy="11" r="1.2" fill="#4A4039"/>
  <circle cx="22" cy="11" r="1.2" fill="#4A4039"/>
  <path d="M16.5,14.5 Q19,17 21.5,14.5" stroke="#4A4039" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  <circle cx="13.8" cy="13.5" r="1.3" fill="#F8A5A0" opacity="0.6"/>
  <circle cx="24.2" cy="13.5" r="1.3" fill="#F8A5A0" opacity="0.6"/>
`;

// 次数 → 大小/角标颜色（沿用旧规则：浅橙→深红，0.9→1.5）
export function markerStyle(count) {
  const t = Math.min((count - 1) / 9, 1);
  const lerp = (a, b) => Math.round(a + (b - a) * t);
  const color = `rgb(${lerp(245, 180)}, ${lerp(158, 38)}, ${lerp(11, 38)})`;
  const scale = Math.min(0.9 + (count - 1) * 0.08, 1.5);
  return { color, scale };
}

export function travelerContent(scale, color, count) {
  return `<div class="map-animal" style="transform:scale(${scale})">
    <svg width="40" height="48" viewBox="0 0 40 48">${TRAVELER_SVG}</svg>
    <span class="map-animal-badge" style="background:${color}">${count}</span>
  </div>`;
}
