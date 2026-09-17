/* 旅行地图前端逻辑 */
(function () {
  'use strict';

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const els = {
    keyBanner: $('key-banner'),
    toast: $('toast'),
    mapContainer: $('map-container'),
    mapFallback: $('map-fallback'),
    panel: $('panel'),
    panelToggle: $('panel-toggle'),
    statCities: $('stat-cities'),
    statVisits: $('stat-visits'),
    statCountries: $('stat-countries'),
    emptyState: $('empty-state'),
    cityList: $('city-list'),
    yearSelect: $('year-select'),
    ysCities: $('ys-cities'),
    ysKm: $('ys-km'),
    ysSub: $('ys-sub'),
    ysDetail: $('ys-detail'),
    ysToggle: $('ys-toggle'),
    ysModal: $('ys-modal'),
    ysMask: $('ys-mask'),
    ysClose: $('ys-close'),
    ysModalTitle: $('ys-modal-title'),
    currentUser: $('current-user'),
    userAvatar: $('user-avatar'),
    logoutBtn: $('logout-btn'),
    guestBanner: $('guest-banner'),
    fab: $('fab'),
  };

  // ---------- 状态 ----------
  let map = null;
  let markers = [];
  let cities = [];
  let trips = [];
  let selectedYear = String(new Date().getFullYear()); // 默认当前年份，'all' = 全部
  let isGuest = false;
  const expanded = new Set(); // 展开详情的城市 id

  // ---------- 工具 ----------
  function today() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  let toastTimer = null;
  function toast(msg, isErr) {
    els.toast.textContent = msg;
    els.toast.classList.toggle('toast-err', !!isErr);
    els.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 3000);
  }

  async function api(method, url, body) {
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      console.error(e);
      toast('网络错误，请确认服务已启动', true);
      throw e;
    }
    if (!res.ok) {
      if (res.status === 401) {
        location.href = '/login.html';
        throw new Error('未登录');
      }
      let msg = `请求失败 (${res.status})`;
      try { msg = (await res.json()).error || msg; } catch (_) { /* ignore */ }
      console.error(msg);
      toast(msg, true);
      throw new Error(msg);
    }
    return res.json();
  }

  // ---------- 地图 ----------
  function markerStyle(count) {
    const t = Math.min((count - 1) / 9, 1); // 1次→0, 10次以上→1
    const lerp = (a, b) => Math.round(a + (b - a) * t);
    const color = `rgb(${lerp(245, 180)}, ${lerp(158, 38)}, ${lerp(11, 38)})`; // 浅橙→深红
    const scale = Math.min(0.9 + (count - 1) * 0.08, 1.5);
    return { color, scale };
  }

  // 卡通动物标记（小熊/兔子/猫咪/企鹅轮换，与登录页同一套形象）
  const ANIMAL_SVGS = [
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

  function animalContent(kind, scale, color, count) {
    return `<div class="map-animal" style="transform:scale(${scale})">
      <svg width="40" height="44" viewBox="0 0 40 44">${ANIMAL_SVGS[kind]}</svg>
      <span class="map-animal-badge" style="background:${color}">${count}</span>
    </div>`;
  }

  function clearMarkers() {
    markers.forEach((m) => m.setMap(null));
    markers = [];
  }

  function renderMarkers() {
    if (!map) return;
    clearMarkers();
    cities.forEach((city) => {
      if (!city.visitCount) return;
      const { color, scale } = markerStyle(city.visitCount);
      const marker = new AMap.Marker({
        position: [city.lng, city.lat],
        content: animalContent(city.id % 4, scale, color, city.visitCount),
        anchor: 'bottom-center',
        zIndex: 100 + city.visitCount,
      });
      marker.on('click', () => openInfo(city, marker));
      marker.setMap(map);
      markers.push(marker);
    });
  }

  function openInfo(city) {
    const history = city.visits.length
      ? city.visits.map((v) => `<li>${esc(v.visited_at)}${v.note ? ' · ' + esc(v.note) : ''}</li>`).join('')
      : '<li>暂无到访记录</li>';
    const linkedTrip = city.visits.map((v) => tripOfVisit(v)).find(Boolean);
    const tripLink = linkedTrip
      ? `<a class="info-trip-link" href="/trip.html?id=${linkedTrip.id}">查看行程：${esc(linkedTrip.title)} →</a>`
      : '';
    const info = new AMap.InfoWindow({
      isCustom: false,
      offset: new AMap.Pixel(0, -34),
      content: `<div class="info-win">
        <div class="info-title">${esc(city.name)}${city.name_en ? ' <span>' + esc(city.name_en) + '</span>' : ''}</div>
        <div class="info-sub">${esc(city.country)} · 去过 ${city.visitCount} 次</div>
        <ul class="info-history">${history}</ul>
        ${tripLink}
      </div>`,
    });
    info.open(map, [city.lng, city.lat]);
  }

  function loadAmap(cfg) {
    if (!cfg.amapKey) {
      els.keyBanner.classList.remove('hidden');
      els.mapFallback.classList.remove('hidden');
      return;
    }
    window._AMapSecurityConfig = { securityJsCode: cfg.amapSecurityCode || '' };
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(cfg.amapKey)}`;
    script.onload = () => {
      map = new AMap.Map(els.mapContainer, { zoom: 3, center: [105, 35], viewMode: '2D' });
      renderMarkers();
    };
    script.onerror = () => {
      console.error('高德地图脚本加载失败');
      els.mapFallback.textContent = '高德地图加载失败，请检查 Key 和网络';
      els.mapFallback.classList.remove('hidden');
    };
    document.head.appendChild(script);
  }

  // ---------- 数据刷新 ----------
  async function refresh() {
    const yq = selectedYear !== 'all' ? `?year=${selectedYear}` : '';
    const [cityData, stats, tripData] = await Promise.all([
      api('GET', '/api/cities' + yq),
      api('GET', '/api/stats' + yq),
      api('GET', '/api/trips' + yq),
    ]);
    cities = cityData;
    trips = tripData;
    els.statCities.textContent = stats.cityCount;
    els.statVisits.textContent = stats.visitCount;
    els.statCountries.textContent = stats.countryCount;
    renderCityList();
    renderMarkers();
    loadYearly(selectedYear);
  }

  // ---------- 年度汇总（年份选择器同时作为全页筛选） ----------
  let summaryYears = [];

  async function loadYearly(year) {
    const y = year || 'all';
    let s;
    try {
      s = await api('GET', `/api/summary/yearly?year=${y}`);
    } catch (_) { return; }
    summaryYears = s.years;
    // 当前年份没有数据时，自动落到最近有数据的年份
    if (y !== 'all' && s.years.length && !s.years.includes(y)) {
      selectedYear = s.years[0];
      await refresh();
      return;
    }
    els.yearSelect.innerHTML = `<option value="all"${y === 'all' ? ' selected' : ''}>全部</option>` +
      summaryYears.map((yr) => `<option${yr === y ? ' selected' : ''}>${yr}</option>`).join('');
    els.ysCities.textContent = s.cityCount;
    els.ysKm.textContent = s.totalKm;
    const label = s.year === 'all' ? '全部年份' : `${s.year} 年`;
    els.ysSub.textContent = `${label}：打卡 ${s.visitCount} 次 · 旅行 ${s.tripCount} 次 · 在外 ${s.tripDays} 天 · 单程合计 ${s.oneWayKm} km`;
    // 次数与距离合并为一行：距离取该地点关联旅行项目的单程合计
    const kmByDest = {};
    const tripByDest = {};
    s.trips.forEach((t) => {
      if (t.distance_km != null) kmByDest[t.dest_name] = (kmByDest[t.dest_name] || 0) + t.distance_km;
      if (!tripByDest[t.dest_name]) tripByDest[t.dest_name] = t;
    });
    els.ysDetail.innerHTML = s.cities.length
      ? `<table class="ys-table">
          <thead><tr><th>地点</th><th>国家/地区</th><th class="num">次数</th><th class="num">单程距离</th></tr></thead>
          <tbody>${s.cities.map((c) => {
            const km = kmByDest[c.name];
            const t = tripByDest[c.name];
            const nameHtml = t
              ? `<a href="/trip.html?id=${t.id}" class="ys-trip-link">${esc(c.name)}</a>`
              : esc(c.name);
            return `<tr>
              <td>${nameHtml}</td>
              <td>${esc(c.country)}</td>
              <td class="num">${c.n}</td>
              <td class="num">${km != null ? (Math.round(km * 10) / 10) + ' km' : '—'}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>`
      : '<div class="visit-none">还没有记录</div>';
  }

  els.yearSelect.addEventListener('change', async () => {
    selectedYear = els.yearSelect.value;
    try { await refresh(); } catch (_) { /* 已提示 */ }
  });

  function closeYsModal() {
    els.ysModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  els.ysToggle.addEventListener('click', () => {
    const label = selectedYear === 'all' ? '全部年份' : `${selectedYear} 年`;
    els.ysModalTitle.textContent = `${label} · 明细`;
    els.ysModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });
  els.ysClose.addEventListener('click', closeYsModal);
  els.ysMask.addEventListener('click', closeYsModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.ysModal.classList.contains('hidden')) closeYsModal();
  });

  // ---------- 城市列表 ----------
  // 到访记录关联的旅行项目（按备注 + 日期匹配）
  function tripOfVisit(v) {
    if (!v.note || !v.note.startsWith('旅行项目：')) return null;
    const title = v.note.slice('旅行项目：'.length);
    return trips.find((t) => t.title === title && t.depart_date === v.visited_at) || null;
  }

  const collapsedRegions = new Set();

  function buildCityItem(city) {
    const li = document.createElement('li');
    li.className = 'city-item' + (expanded.has(city.id) ? ' expanded' : '');

    const visitsHtml = city.visits.length
      ? city.visits.map((v) => {
        const trip = tripOfVisit(v);
        return `
          <div class="visit-row" data-visit-id="${v.id}">
            <span class="visit-date">${esc(v.visited_at)}</span>
            <span class="visit-note">${esc(v.note || '')}</span>
            <span class="visit-ops">
              ${trip ? `<button class="btn-icon" data-act="goto" data-trip-id="${trip.id}" title="查看行程详情">→</button>` : ''}
              ${!isGuest && !trip ? `<button class="btn-icon" data-act="edit" title="编辑">✎</button>` : ''}
              ${!isGuest ? `<button class="btn-icon" data-act="del" title="删除">✕</button>` : ''}
            </span>
          </div>`;
      }).join('')
      : '<div class="visit-none">暂无到访记录</div>';

    li.innerHTML = `
        <div class="city-head" data-act="toggle">
          <span class="city-badge">${city.visitCount}</span>
          <span class="city-name">${esc(city.name)}${city.name_en ? ' <em>' + esc(city.name_en) + '</em>' : ''}</span>
          <span class="city-country">${esc(city.country)}</span>
          <span class="city-chevron">▾</span>
        </div>
        <div class="city-detail">
          ${visitsHtml}
          ${isGuest ? '' : `<div class="city-detail-actions">
            <button class="btn btn-small btn-primary" data-act="again">再记一次</button>
            <button class="btn btn-small btn-danger" data-act="del-city">删除城市</button>
          </div>`}
        </div>`;

    li.addEventListener('click', (e) => onCityItemClick(e, city, li));
    return li;
  }

  // 按所属城市（region，省市归并）分组渲染
  function renderCityList() {
    els.emptyState.classList.toggle('hidden', cities.length > 0);
    els.cityList.innerHTML = '';

    const groups = new Map();
    cities.forEach((city) => {
      const key = city.region || city.name;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(city);
    });
    const sorted = [...groups.entries()]
      .map(([name, list]) => ({ name, list, total: list.reduce((s, c) => s + c.visitCount, 0) }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'zh'));

    sorted.forEach((g) => {
      const gi = document.createElement('li');
      gi.className = 'region-group';
      const head = document.createElement('div');
      head.className = 'region-head';
      head.innerHTML = `
        <span class="city-badge">${g.total}</span>
        <span class="region-name">${esc(g.name)}</span>
        <span class="region-sub">${g.list.length > 1 ? g.list.length + ' 个地点' : ''}</span>
        <span class="city-chevron">${collapsedRegions.has(g.name) ? '▸' : '▾'}</span>`;
      const box = document.createElement('ul');
      box.className = 'region-cities' + (collapsedRegions.has(g.name) ? ' hidden' : '');
      g.list.forEach((city) => box.appendChild(buildCityItem(city)));
      head.addEventListener('click', () => {
        if (collapsedRegions.has(g.name)) collapsedRegions.delete(g.name);
        else collapsedRegions.add(g.name);
        box.classList.toggle('hidden', collapsedRegions.has(g.name));
        head.querySelector('.city-chevron').textContent = collapsedRegions.has(g.name) ? '▸' : '▾';
      });
      gi.appendChild(head);
      gi.appendChild(box);
      els.cityList.appendChild(gi);
    });
  }

  async function onCityItemClick(e, city, li) {
    const actEl = e.target.closest('[data-act]');
    if (!actEl) return;
    const act = actEl.dataset.act;

    if (act === 'toggle') {
      if (expanded.has(city.id)) expanded.delete(city.id);
      else {
        expanded.add(city.id);
        if (map) map.setCenter([city.lng, city.lat]);
      }
      li.classList.toggle('expanded', expanded.has(city.id));
      return;
    }

    if (act === 'goto') {
      location.href = `/trip.html?id=${actEl.dataset.tripId}`;
      return;
    }

    if (act === 'again') {
      const note = prompt('备注（可选，直接确定则留空）:') || '';
      try {
        await api('POST', `/api/cities/${city.id}/visits`, { visited_at: today(), note });
        toast(`已记录一次 ${city.name} 的到访`);
        await refresh();
      } catch (_) { /* 已提示 */ }
      return;
    }

    if (act === 'del-city') {
      if (!confirm(`确定删除「${city.name}」及其全部到访记录吗？`)) return;
      try {
        await api('DELETE', `/api/cities/${city.id}`);
        expanded.delete(city.id);
        toast(`已删除 ${city.name}`);
        await refresh();
      } catch (_) { /* 已提示 */ }
      return;
    }

    const row = e.target.closest('.visit-row');
    if (!row) return;
    const visitId = Number(row.dataset.visitId);
    const visit = city.visits.find((v) => v.id === visitId);
    if (!visit) return;

    if (act === 'del') {
      if (!confirm(`删除 ${city.name} ${visit.visited_at} 这次记录？`)) return;
      try {
        await api('DELETE', `/api/visits/${visitId}`);
        toast('已删除到访记录');
        await refresh();
      } catch (_) { /* 已提示 */ }
      return;
    }

    if (act === 'edit') {
      row.innerHTML = `
        <input type="date" class="edit-date" value="${esc(visit.visited_at)}">
        <input type="text" class="edit-note" value="${esc(visit.note || '')}" placeholder="备注">
        <span class="visit-ops">
          <button class="btn-icon" data-act="save" title="保存">✓</button>
          <button class="btn-icon" data-act="cancel" title="取消">✕</button>
        </span>`;
      return;
    }

    if (act === 'save') {
      const date = row.querySelector('.edit-date').value;
      const note = row.querySelector('.edit-note').value.trim();
      if (!date) { toast('日期不能为空', true); return; }
      try {
        await api('PUT', `/api/visits/${visitId}`, { visited_at: date, note });
        toast('已保存');
        await refresh();
      } catch (_) { /* 已提示 */ }
      return;
    }

    if (act === 'cancel') {
      renderCityList();
    }
  }

  // ---------- 面板折叠 ----------
  els.panelToggle.addEventListener('click', () => {
    els.panel.classList.toggle('collapsed');
    document.querySelector('.layout').classList.toggle('panel-collapsed');
  });

  // ---------- 退出登录 ----------
  els.logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) { console.error(e); }
    location.href = '/login.html';
  });

  // ---------- 启动 ----------
  (async function init() {
    let me;
    try {
      me = await api('GET', '/api/auth/me');
    } catch (_) {
      return; // 401 已在 api() 中跳转登录页
    }
    isGuest = !!me.isGuest;
    els.currentUser.textContent = isGuest ? '游客' : me.username;
    els.userAvatar.textContent = isGuest ? '游' : me.username.slice(0, 1);
    if (isGuest) {
      els.guestBanner.classList.remove('hidden');
      els.emptyState.textContent = 'admin 还没有记录任何城市';
    } else {
      els.fab.classList.remove('hidden');
    }
    try {
      const cfg = await api('GET', '/api/config');
      loadAmap(cfg);
    } catch (_) { /* 已提示 */ }
    try {
      await refresh();
    } catch (_) { /* 已提示 */ }
  })();
})();
