/* 旅行项目列表 + 发起旅行 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    toast: $('toast'),
    currentUser: $('current-user'),
    logoutBtn: $('logout-btn'),
    guestBanner: $('guest-banner'),
    homeSet: $('home-set'),
    homeName: $('home-name'),
    homeChange: $('home-change'),
    homeSearchBox: $('home-search-box'),
    homeSearchInput: $('home-search-input'),
    homeSearchResults: $('home-search-results'),
    createToggle: $('create-toggle'),
    createModal: $('create-modal'),
    createMask: $('create-mask'),
    createClose: $('create-close'),
    createForm: $('create-form'),
    createCancel: $('create-cancel'),
    createSubmit: $('create-submit'),
    fTitle: $('f-title'),
    fDate: $('f-date'),
    fDays: $('f-days'),
    fTransport: $('f-transport'),
    fBudget: $('f-budget'),
    memberTags: $('member-tags'),
    memberInput: $('member-input'),
    destSearchResults: $('dest-search-results'),
    fDestName: $('f-dest-name'),
    destCoord: $('dest-coord'),
    distanceHint: $('distance-hint'),
    pickerMap: $('picker-map'),
    tripsEmpty: $('trips-empty'),
    tripsList: $('trips-list'),
    yearFilter: $('year-filter'),
    companionCard: $('companion-card'),
    companionList: $('companion-list'),
    memberQuick: $('member-quick'),
  };

  let isGuest = false;
  let profile = null;
  let pickerMap = null;
  let originMarker = null;
  let destMarker = null;
  let destPoint = null; // {lat, lng}
  let destCountry = null;
  let computedDistance = null; // 自动计算的单程公里数
  let amapReady = false;
  let members = [];
  let filterYear = 'all';
  let companions = []; // [{name, n}] 历史同行人及次数
  let companionExpanded = false;

  // ---------- 工具 ----------
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
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      if (res.status === 401) { location.href = '/login.html'; throw new Error('未登录'); }
      let msg = `请求失败 (${res.status})`;
      try { msg = (await res.json()).error || msg; } catch (_) { /* ignore */ }
      toast(msg, true);
      throw new Error(msg);
    }
    return res.json();
  }

  function today() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function haversineKm(a, b) {
    const R = 6371;
    const rad = (x) => (x * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // ---------- 高德加载 ----------
  function loadAmap() {
    return new Promise(async (resolve) => {
      let cfg;
      try { cfg = await api('GET', '/api/config'); } catch (_) { return resolve(false); }
      if (!cfg.amapKey) { toast('未配置高德 Key，地图选点不可用', true); return resolve(false); }
      window._AMapSecurityConfig = { securityJsCode: cfg.amapSecurityCode || '' };
      const script = document.createElement('script');
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(cfg.amapKey)}&plugin=AMap.Driving,AMap.Riding,AMap.Walking`;
      script.onload = () => resolve(true);
      script.onerror = () => { toast('高德地图加载失败', true); resolve(false); };
      document.head.appendChild(script);
    });
  }

  // ---------- 出发城市 ----------
  function renderHome() {
    const hasHome = profile && profile.home_name;
    els.homeSet.classList.toggle('hidden', !hasHome);
    els.homeSearchBox.classList.toggle('hidden', !!hasHome || isGuest);
    if (hasHome) els.homeName.textContent = profile.home_name;
    if (isGuest) els.homeChange.classList.add('hidden');
  }

  function bindSearch(input, resultsEl, onPick) {
    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (!q) { resultsEl.classList.add('hidden'); return; }
      timer = setTimeout(async () => {
        try {
          const list = await api('GET', `/api/cities/search?q=${encodeURIComponent(q)}`);
          resultsEl.innerHTML = '';
          if (!list.length) {
            resultsEl.innerHTML = '<li class="search-none">未找到匹配的城市</li>';
          } else {
            list.forEach((c) => {
              const li = document.createElement('li');
              li.innerHTML = `<strong>${esc(c.name)}</strong>${c.name_en ? ' <em>' + esc(c.name_en) + '</em>' : ''} <span class="search-country">· ${esc(c.country)}</span>`;
              li.addEventListener('click', () => {
                resultsEl.classList.add('hidden');
                input.value = '';
                onPick(c);
              });
              resultsEl.appendChild(li);
            });
          }
          resultsEl.classList.remove('hidden');
        } catch (_) { /* 已提示 */ }
      }, 300);
    });
  }

  bindSearch(els.homeSearchInput, els.homeSearchResults, async (c) => {
    try {
      profile = await api('PUT', '/api/profile', { home_name: c.name, home_lat: c.lat, home_lng: c.lng });
      toast(`出发城市已设为 ${c.name}`);
      renderHome();
    } catch (_) { /* 已提示 */ }
  });

  els.homeChange.addEventListener('click', () => {
    els.homeSet.classList.add('hidden');
    els.homeSearchBox.classList.remove('hidden');
  });

  // ---------- 同行人标签 ----------
  function renderMemberTags() {
    els.memberTags.querySelectorAll('.tag').forEach((t) => t.remove());
    members.forEach((m, idx) => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.innerHTML = `${esc(m)}<button class="tag-x" title="移除">×</button>`;
      tag.querySelector('.tag-x').addEventListener('click', () => {
        members.splice(idx, 1);
        renderMemberTags();
      });
      els.memberTags.insertBefore(tag, els.memberInput);
    });
    renderQuickPick();
  }

  // ---------- 同行人榜单 + 快捷选择 ----------
  async function loadCompanions() {
    try {
      companions = await api('GET', '/api/companions');
    } catch (_) { return; }
    renderLeaderboard();
    renderQuickPick();
  }

  function renderLeaderboard() {
    const list = companions.filter((c) => c.name !== '我');
    els.companionCard.classList.toggle('hidden', list.length === 0);
    const medals = ['🥇', '🥈', '🥉'];
    const shown = companionExpanded ? list : list.slice(0, 3);
    els.companionList.innerHTML = shown.map((c, i) => `
      <div class="companion-row">
        <span class="companion-rank">${medals[i] || (i + 1)}</span>
        <span class="companion-name">${esc(c.name)}</span>
        <span class="companion-count">同行 ${c.n} 次</span>
      </div>`).join('') +
      (list.length > 3 ? `<button class="btn btn-small btn-ghost companion-toggle">${companionExpanded ? '收起 ▴' : `查看全部（共 ${list.length} 人）▾`}</button>` : '');
    const toggle = els.companionList.querySelector('.companion-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        companionExpanded = !companionExpanded;
        renderLeaderboard();
      });
    }
  }

  // 发起弹窗里的历史同行人快捷 chips（已在名单中的不显示）
  function renderQuickPick() {
    if (!els.memberQuick) return;
    const picks = companions.filter((c) => c.name !== '我' && !members.includes(c.name));
    els.memberQuick.classList.toggle('hidden', picks.length === 0);
    els.memberQuick.innerHTML = picks.length
      ? '<span class="quick-label">常客：</span>' + picks.map((c) =>
        `<button class="quick-chip" data-name="${esc(c.name)}">${esc(c.name)} <em>${c.n}次</em></button>`).join('')
      : '';
    els.memberQuick.querySelectorAll('.quick-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        members.push(chip.dataset.name);
        renderMemberTags();
      });
    });
  }

  els.memberInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const name = els.memberInput.value.trim();
    els.memberInput.value = '';
    if (!name) return;
    if (members.includes(name)) { toast('该成员已添加', true); return; }
    members.push(name);
    renderMemberTags();
  });

  // ---------- 选点地图 ----------
  async function ensurePickerMap() {
    if (pickerMap) return;
    if (!amapReady) return;
    const center = profile && profile.home_lat != null ? [profile.home_lng, profile.home_lat] : [105, 35];
    pickerMap = new AMap.Map(els.pickerMap, { zoom: profile && profile.home_lat != null ? 5 : 3, center });
    if (profile && profile.home_lat != null) {
      originMarker = new AMap.Marker({
        position: center,
        title: '出发地',
        label: { content: '出发地', direction: 'top' },
      });
      originMarker.setMap(pickerMap);
    }
    pickerMap.on('click', (e) => {
      destCountry = null; // 手动选点，国家未知
      setDestPoint({ lat: e.lnglat.getLat(), lng: e.lnglat.getLng() });
      if (!els.fDestName.value.trim()) els.fDestName.value = '地图选点';
    });
  }

  function setDestPoint(p) {
    destPoint = p;
    els.destCoord.textContent = `已选：${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
    if (pickerMap) {
      if (destMarker) destMarker.setMap(null);
      destMarker = new AMap.Marker({
        position: [p.lng, p.lat],
        draggable: true,
        title: '目的地',
        label: { content: '目的地', direction: 'top' },
      });
      destMarker.on('dragend', (e) => {
        setDestPoint({ lat: e.lnglat.getLat(), lng: e.lnglat.getLng() });
      });
      destMarker.setMap(pickerMap);
      pickerMap.setCenter([p.lng, p.lat]);
    }
    recalcDistance();
  }

  function recalcDistance() {
    computedDistance = null;
    if (!destPoint) return;
    const origin = profile && profile.home_lat != null
      ? { lat: profile.home_lat, lng: profile.home_lng } : null;
    if (!origin) {
      els.distanceHint.textContent = '未设置出发城市，无法自动计算距离';
      return;
    }
    const transport = els.fTransport.value;
    const pluginMap = { '驾车': 'Driving', '骑行': 'Riding', '步行': 'Walking' };
    const plugin = pluginMap[transport];
    if (plugin && amapReady && AMap[plugin]) {
      els.distanceHint.textContent = '正在计算路线…';
      const router = new AMap[plugin]();
      router.search([origin.lng, origin.lat], [destPoint.lng, destPoint.lat], (status, result) => {
        if (status === 'complete' && result.routes && result.routes.length) {
          const km = result.routes[0].distance / 1000;
          computedDistance = Math.round(km * 10) / 10;
          els.distanceHint.textContent = `单程距离：${transport}路线约 ${km.toFixed(1)} 公里（高德路径规划）`;
        } else {
          const km = haversineKm(origin, destPoint);
          computedDistance = Math.round(km * 10) / 10;
          els.distanceHint.textContent = `单程距离：路线规划失败，直线距离约 ${km.toFixed(1)} 公里`;
        }
      });
    } else {
      const km = haversineKm(origin, destPoint);
      computedDistance = Math.round(km * 10) / 10;
      els.distanceHint.textContent = `单程距离：${transport}无路线规划，直线距离约 ${km.toFixed(1)} 公里`;
    }
  }

  els.fTransport.addEventListener('change', recalcDistance);

  bindSearch(els.fDestName, els.destSearchResults, (c) => {
    els.fDestName.value = c.name;
    destCountry = c.country;
    setDestPoint({ lat: c.lat, lng: c.lng });
  });

  // 点击搜索框外收起下拉
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      els.homeSearchResults.classList.add('hidden');
      els.destSearchResults.classList.add('hidden');
    }
  });

  // ---------- 创建弹窗 ----------
  async function openCreateModal() {
    els.createModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    if (!els.fDate.value) els.fDate.value = today();
    if (!members.length) { members = ['我']; renderMemberTags(); }
    await ensurePickerMap();
    if (pickerMap) pickerMap.resize();
  }

  function closeCreateModal() {
    els.createModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  els.createToggle.addEventListener('click', openCreateModal);
  els.createCancel.addEventListener('click', closeCreateModal);
  els.createClose.addEventListener('click', closeCreateModal);
  els.createMask.addEventListener('click', closeCreateModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.createModal.classList.contains('hidden')) closeCreateModal();
  });

  els.createSubmit.addEventListener('click', async () => {
    const title = els.fTitle.value.trim();
    const destName = els.fDestName.value.trim();
    if (!title) return toast('请填写旅行项目名', true);
    if (!els.fDate.value) return toast('请选择出发时间', true);
    const days = parseInt(els.fDays.value, 10);
    if (!days || days < 1) return toast('请填写旅行天数', true);
    if (!destPoint) return toast('请在地图上选择目的地', true);
    if (!destName) return toast('请填写目的地名称', true);
    if (!members.length) return toast('请至少添加一名同行人', true);
    const body = {
      title,
      dest_name: destName,
      dest_lat: destPoint.lat,
      dest_lng: destPoint.lng,
      dest_country: destCountry,
      depart_date: els.fDate.value,
      days,
      transport: els.fTransport.value,
      distance_km: computedDistance,
      budget: els.fBudget.value ? Number(els.fBudget.value) : null,
      members,
    };
    try {
      const trip = await api('POST', '/api/trips', body);
      toast('旅行项目已创建');
      location.href = `/trip.html?id=${trip.id}`;
    } catch (_) { /* 已提示 */ }
  });

  // ---------- 项目列表 ----------
  async function loadTrips() {
    let trips;
    try {
      trips = await api('GET', '/api/trips' + (filterYear !== 'all' ? `?year=${filterYear}` : ''));
    } catch (_) { return; }
    els.tripsEmpty.classList.toggle('hidden', trips.length > 0);
    els.tripsList.innerHTML = '';
    trips.forEach((t) => {
      const card = document.createElement('a');
      card.className = 'trip-card card';
      card.href = `/trip.html?id=${t.id}`;
      card.innerHTML = `
        <div class="trip-card-head">
          <span class="trip-card-title">${esc(t.title)}</span>
          <span class="trip-card-dest">${esc(t.dest_name)}</span>
        </div>
        <div class="trip-card-meta">
          ${esc(t.depart_date)} · ${t.days} 天 · ${esc(t.transport)}
          ${t.distance_km != null ? ' · 单程 ' + t.distance_km + ' km' : ''}
        </div>
        <div class="trip-card-meta">👥 ${t.memberCount} 人 · 📷 ${t.photoCount} 张 · 已花 ¥${t.spent.toFixed(2)}${t.budget ? ' / 预算 ¥' + t.budget.toFixed(2) : ''}</div>`;
      els.tripsList.appendChild(card);
    });
  }

  els.yearFilter.addEventListener('change', async () => {
    filterYear = els.yearFilter.value;
    await loadTrips();
  });

  async function loadYearOptions() {
    try {
      const s = await api('GET', '/api/summary/yearly?year=all');
      els.yearFilter.innerHTML = '<option value="all">全部年份</option>' +
        s.years.map((y) => `<option${y === filterYear ? ' selected' : ''}>${y}</option>`).join('');
    } catch (_) { /* 已提示 */ }
  }

  // ---------- 退出 ----------
  els.logoutBtn.addEventListener('click', async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) { console.error(e); }
    location.href = '/login.html';
  });

  // ---------- 启动 ----------
  (async function init() {
    let me;
    try { me = await api('GET', '/api/auth/me'); } catch (_) { return; }
    isGuest = !!me.isGuest;
    els.currentUser.textContent = isGuest ? '游客' : me.username;
    if (isGuest) {
      els.guestBanner.classList.remove('hidden');
      els.createToggle.classList.add('hidden');
    }
    try { profile = await api('GET', '/api/profile'); } catch (_) { /* 已提示 */ }
    renderHome();
    amapReady = await loadAmap();
    await loadYearOptions();
    await loadCompanions();
    await loadTrips();
    // 从首页「+」按钮进入时直接打开发起弹窗
    if (!isGuest && new URLSearchParams(location.search).get('new') === '1') {
      await openCreateModal();
    }
  })();
})();
