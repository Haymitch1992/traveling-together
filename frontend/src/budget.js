/** 旅行预算四档：口语标签 + 人均每日参考价（元） */
export const BUDGET_TIERS = [
  { key: 'thrifty', label: '抠门游', hint: '能吃饱就行', rate: 150 },
  { key: 'chill', label: '刚刚好', hint: '不紧不慢', rate: 300 },
  { key: 'splash', label: '浪一点', hint: '想吃就吃', rate: 550 },
  { key: 'max', label: '拉满', hint: '说花就花', rate: 900 },
];

export function calcBudget(people, days, rate) {
  const p = Math.max(1, Math.round(Number(people) || 1));
  const d = Math.max(1, Math.round(Number(days) || 1));
  const r = Math.max(0, Number(rate) || 0);
  return Math.round(p * d * r);
}

export function budgetHint(people, days, rate) {
  const p = Math.max(1, Math.round(Number(people) || 1));
  const d = Math.max(1, Math.round(Number(days) || 1));
  const total = calcBudget(p, d, rate);
  return `${p} 人 × ${d} 天 × ¥${rate}/人/天 ≈ ¥${total}`;
}

/** 根据已有总预算反推最接近的档位 */
export function matchTierKey(budget, people, days) {
  if (budget == null || budget === '' || Number(budget) <= 0) return 'chill';
  let best = BUDGET_TIERS[1].key;
  let bestDiff = Infinity;
  for (const t of BUDGET_TIERS) {
    const diff = Math.abs(calcBudget(people, days, t.rate) - Number(budget));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = t.key;
    }
  }
  return best;
}

export function tierByKey(key) {
  return BUDGET_TIERS.find((t) => t.key === key) || BUDGET_TIERS[1];
}
