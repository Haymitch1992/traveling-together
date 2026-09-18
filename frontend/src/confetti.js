/**
 * 轻量彩带庆祝：全屏 canvas，播完自动移除
 * @param {object} [opts]
 * @param {number} [opts.duration=2200] 动画时长 ms
 * @param {number} [opts.count=120] 粒子数量
 */
export function celebrateConfetti(opts = {}) {
  if (typeof document === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const duration = opts.duration ?? 2200;
  const count = opts.count ?? 120;
  const colors = opts.colors ?? [
    '#E76F51', '#F4A261', '#FFD66B', '#7FB069',
    '#7EC8E3', '#F8C8D0', '#B08968', '#FFFDF7',
  ];

  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-layer';
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '99999',
  });
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  const W = () => window.innerWidth;
  const H = () => window.innerHeight;
  const cx = W() / 2;
  const cy = H() * 0.28;

  const pieces = Array.from({ length: count }, () => {
    const angle = (Math.random() * Math.PI) - Math.PI / 2; // 向上扇形
    const speed = 7 + Math.random() * 11;
    return {
      x: cx + (Math.random() - 0.5) * 40,
      y: cy + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed * (0.6 + Math.random()),
      vy: Math.sin(angle) * speed - 4,
      w: 6 + Math.random() * 8,
      h: 10 + Math.random() * 14,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
      color: colors[Math.floor(Math.random() * colors.length)],
      gravity: 0.18 + Math.random() * 0.12,
      drag: 0.988 + Math.random() * 0.008,
      opacity: 1,
      ribbon: Math.random() > 0.35, // 多数为彩带形
    };
  });

  const start = performance.now();
  let raf = 0;

  function frame(now) {
    const t = now - start;
    const fade = t > duration - 500 ? Math.max(0, 1 - (t - (duration - 500)) / 500) : 1;
    ctx.clearRect(0, 0, W(), H());

    for (const p of pieces) {
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.opacity = fade;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      if (p.ribbon) {
        // 轻微扭动的彩带
        ctx.beginPath();
        ctx.moveTo(-p.w / 2, -p.h / 2);
        ctx.quadraticCurveTo(p.w * 0.4, 0, -p.w / 2, p.h / 2);
        ctx.quadraticCurveTo(-p.w * 0.2, 0, -p.w / 2, -p.h / 2);
        ctx.fill();
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * 0.35);
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }

    if (t < duration) {
      raf = requestAnimationFrame(frame);
    } else {
      cleanup();
    }
  }

  function cleanup() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    canvas.remove();
  }

  raf = requestAnimationFrame(frame);
  return cleanup;
}
