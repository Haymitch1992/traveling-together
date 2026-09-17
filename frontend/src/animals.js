/* 卡通动物 SVG 标记（小熊/兔子/猫咪/企鹅），与登录页同一套形象 */
export const ANIMAL_SVGS = [
  // 小熊
  `<circle cx="14" cy="10" r="4" fill="#B08968"/><circle cx="26" cy="10" r="4" fill="#B08968"/>
   <circle cx="14" cy="10" r="1.8" fill="#E8C9A8"/><circle cx="26" cy="10" r="1.8" fill="#E8C9A8"/>
   <ellipse cx="20" cy="32" rx="13" ry="11" fill="#B08968"/>
   <circle cx="20" cy="18" r="10" fill="#B08968"/>
   <ellipse cx="20" cy="21" rx="5" ry="3.6" fill="#E8C9A8"/>
   <circle cx="20" cy="19.4" r="1.5" fill="#4A4039"/>
   <circle cx="16.5" cy="15.5" r="1.4" fill="#4A4039"/><circle cx="23.5" cy="15.5" r="1.4" fill="#4A4039"/>`,
  // 兔子
  `<ellipse cx="15" cy="8" rx="3" ry="8" fill="#FFFDF7" stroke="#EAD9C2" stroke-width="1"/>
   <ellipse cx="25" cy="8" rx="3" ry="8" fill="#FFFDF7" stroke="#EAD9C2" stroke-width="1"/>
   <ellipse cx="15" cy="8" rx="1.3" ry="5" fill="#F8C8D0"/><ellipse cx="25" cy="8" rx="1.3" ry="5" fill="#F8C8D0"/>
   <ellipse cx="20" cy="33" rx="11" ry="10" fill="#FFFDF7" stroke="#EAD9C2" stroke-width="1"/>
   <circle cx="20" cy="20" r="9" fill="#FFFDF7" stroke="#EAD9C2" stroke-width="1"/>
   <circle cx="16.5" cy="18" r="1.4" fill="#4A4039"/><circle cx="23.5" cy="18" r="1.4" fill="#4A4039"/>
   <path d="M20,21 L21.5,22.5 L20,23.5 Z" fill="#F8A5B8"/>`,
  // 猫咪
  `<path d="M12,14 L14,5 L18,12 Z" fill="#F4A261"/><path d="M22,12 L26,5 L28,14 Z" fill="#F4A261"/>
   <path d="M9,32 Q4,30 5,24" stroke="#F4A261" stroke-width="3.5" fill="none" stroke-linecap="round"/>
   <ellipse cx="20" cy="33" rx="11" ry="10" fill="#F4A261"/>
   <circle cx="20" cy="19" r="9.5" fill="#F4A261"/>
   <circle cx="16.5" cy="17.5" r="1.4" fill="#4A4039"/><circle cx="23.5" cy="17.5" r="1.4" fill="#4A4039"/>
   <path d="M20,20 L21.5,21.5 L20,22.5 Z" fill="#E76F51"/>`,
  // 企鹅
  `<ellipse cx="20" cy="24" rx="10" ry="14" fill="#3A4454"/>
   <ellipse cx="20" cy="28" rx="6" ry="9" fill="#FFFDF7"/>
   <circle cx="16.5" cy="16" r="1.3" fill="#FFFDF7"/><circle cx="23.5" cy="16" r="1.3" fill="#FFFDF7"/>
   <circle cx="16.5" cy="16" r="0.65" fill="#4A4039"/><circle cx="23.5" cy="16" r="0.65" fill="#4A4039"/>
   <path d="M18,19 L22,19 L20,21.5 Z" fill="#F4A261"/>
   <ellipse cx="15" cy="38" rx="3.5" ry="2" fill="#F4A261"/><ellipse cx="25" cy="38" rx="3.5" ry="2" fill="#F4A261"/>`,
];

// 次数 → 大小/颜色（沿用旧版规则：浅橙→深红，0.9→1.5）
export function markerStyle(count) {
  const t = Math.min((count - 1) / 9, 1);
  const lerp = (a, b) => Math.round(a + (b - a) * t);
  const color = `rgb(${lerp(245, 180)}, ${lerp(158, 38)}, ${lerp(11, 38)})`;
  const scale = Math.min(0.9 + (count - 1) * 0.08, 1.5);
  return { color, scale };
}

export function animalContent(kind, scale, color, count) {
  return `<div class="map-animal" style="transform:scale(${scale})">
    <svg width="40" height="44" viewBox="0 0 40 44">${ANIMAL_SVGS[kind % 4]}</svg>
    <span class="map-animal-badge" style="background:${color}">${count}</span>
  </div>`;
}
