/* 旅行项目详情页 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const tripId = Number(new URLSearchParams(location.search).get('id'));
  const els = {
    toast: $('toast'), currentUser: $('current-user'), logoutBtn: $('logout-btn'),
    guestBanner: $('guest-banner'), main: $('main'), navTitle: $('nav-title'),
    infoView: $('info-view'), infoOps: $('info-ops'), infoEdit: $('info-edit'), tripDelete: $('trip-delete'),
    editForm: $('info-edit-form'),
    eTitle: $('e-title'), eDate: $('e-date'), eDays: $('e-days'), eTransport: $('e-transport'),
    eBudget: $('e-budget'), eDistance: $('e-distance'), eDestName: $('e-dest-name'),
    eDestCoord: $('e-dest-coord'), eDistanceHint: $('e-distance-hint'), editMap: $('edit-map'),
    editCancel: $('edit-cancel'), editSave: $('edit-save'),
    memberList: $('member-list'), memberAddBox: $('member-add-box'),
    memberAddInput: $('member-add-input'), memberAddBtn: $('member-add-btn'),
    settlement: $('settlement'), expenseList: $('expense-list'), expenseAddBox: $('expense-add-box'),
    xPayer: $('x-payer'), xAmount: $('x-amount'), xCategory: $('x-category'),
    xNote: $('x-note'), xDate: $('x-date'), xAddBtn: $('x-add-btn'),
    itinerary: $('itinerary'), itAddBox: $('it-add-box'),
    itDay: $('it-day'), itContent: $('it-content'), itAddBtn: $('it-add-btn'),
    aiGenBtn: $('ai-gen-btn'), aiPreview: $('ai-preview'),
    photoUploadLabel: $('photo-upload-label'), photoInput: $('photo-input'),
    photoEmpty: $('photo-empty'), photoWall: $('photo-wall'),
    lightbox: $('lightbox'), lightboxImg: $('lightbox-img'), lightboxClose: $('lightbox-close'),
  };

  let isGuest = false;
  let trip = null;
  let profile = null;
  let editMap = null;
  let editMarker = null;
  let editPoint = null;
  let amapReady = false;

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

  async function api(method, url, body, isForm) {
    const res = await fetch(url, {
      method,
      headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
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

  function fmt(n) { return '¥' + Number(n).toFixed(2); }

  // ---------- 高德 ----------
  function loadAmap() {
    return new Promise(async (resolve) => {
      let cfg;
      try { cfg = await api('GET', '/api/config'); } catch (_) { return resolve(false); }
      if (!cfg.amapKey) return resolve(false);
      window._AMapSecurityConfig = { securityJsCode: cfg.amapSecurityCode || '' };
      const script = document.createElement('script');
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(cfg.amapKey)}&plugin=AMap.Driving,AMap.Riding,AMap.Walking`;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  function ensureEditMap() {
    if (editMap || !amapReady) return;
    editMap = new AMap.Map(els.editMap, { zoom: 5, center: [trip.dest_lng, trip.dest_lat] });
    if (trip.origin_lat != null) {
      new AMap.Marker({
        position: [trip.origin_lng, trip.origin_lat],
        label: { content: '出发地', direction: 'top' },
      }).setMap(editMap);
    }
    editMap.on('click', (e) => {
      setEditPoint({ lat: e.lnglat.getLat(), lng: e.lnglat.getLng() });
    });
    setEditPoint({ lat: trip.dest_lat, lng: trip.dest_lng });
  }

  function setEditPoint(p) {
    editPoint = p;
    els.eDestCoord.textContent = `已选：${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
    if (editMap) {
      if (editMarker) editMarker.setMap(null);
      editMarker = new AMap.Marker({
        position: [p.lng, p.lat], draggable: true,
        label: { content: '目的地', direction: 'top' },
      });
      editMarker.on('dragend', (e) => setEditPoint({ lat: e.lnglat.getLat(), lng: e.lnglat.getLng() }));
      editMarker.setMap(editMap);
      editMap.setCenter([p.lng, p.lat]);
    }
    recalcEditDistance();
  }

  function recalcEditDistance() {
    if (!editPoint) return;
    const origin = trip.origin_lat != null ? { lat: trip.origin_lat, lng: trip.origin_lng } : null;
    if (!origin) { els.eDistanceHint.textContent = '该项目无出发地信息，请手填距离'; return; }
    const transport = els.eTransport.value;
    const pluginMap = { '驾车': 'Driving', '骑行': 'Riding', '步行': 'Walking' };
    const plugin = pluginMap[transport];
    if (plugin && amapReady && AMap[plugin]) {
      els.eDistanceHint.textContent = '正在计算路线…';
      new AMap[plugin]().search([origin.lng, origin.lat], [editPoint.lng, editPoint.lat], (status, result) => {
        if (status === 'complete' && result.routes && result.routes.length) {
          const km = result.routes[0].distance / 1000;
          els.eDistance.value = km.toFixed(1);
          els.eDistanceHint.textContent = `${transport}路线约 ${km.toFixed(1)} 公里`;
        } else {
          const km = haversineKm(origin, editPoint);
          els.eDistance.value = km.toFixed(1);
          els.eDistanceHint.textContent = `路线规划失败，直线距离约 ${km.toFixed(1)} 公里`;
        }
      });
    } else {
      const km = haversineKm(origin, editPoint);
      els.eDistance.value = km.toFixed(1);
      els.eDistanceHint.textContent = `${transport}无路线规划，直线距离约 ${km.toFixed(1)} 公里`;
    }
  }

  els.eTransport.addEventListener('change', recalcEditDistance);

  // ---------- 基本信息 ----------
  function renderInfo() {
    const s = trip.settlement;
    els.infoView.innerHTML = `
      <div class="info-grid">
        <div class="info-item"><span>目的地</span><strong>${esc(trip.dest_name)}</strong></div>
        <div class="info-item"><span>出发地</span><strong>${esc(trip.origin_name || '未设置')}</strong></div>
        <div class="info-item"><span>出发时间</span><strong>${esc(trip.depart_date)}</strong></div>
        <div class="info-item"><span>旅行天数</span><strong>${trip.days} 天</strong></div>
        <div class="info-item"><span>出行方式</span><strong>${esc(trip.transport)}</strong></div>
        <div class="info-item"><span>单程距离</span><strong>${trip.distance_km != null ? trip.distance_km + ' km' : '未知'}</strong></div>
        <div class="info-item"><span>预算</span><strong>${trip.budget != null ? fmt(trip.budget) : '未设'}</strong></div>
        <div class="info-item"><span>已花费</span><strong>${fmt(s.total)}</strong></div>
      </div>`;
  }

  els.infoEdit.addEventListener('click', () => {
    els.eTitle.value = trip.title;
    els.eDate.value = trip.depart_date;
    els.eDays.value = trip.days;
    els.eTransport.value = trip.transport;
    els.eBudget.value = trip.budget != null ? trip.budget : '';
    els.eDistance.value = trip.distance_km != null ? trip.distance_km : '';
    els.eDestName.value = trip.dest_name;
    els.infoView.classList.add('hidden');
    els.editForm.classList.remove('hidden');
    ensureEditMap();
  });

  els.editCancel.addEventListener('click', () => {
    els.editForm.classList.add('hidden');
    els.infoView.classList.remove('hidden');
  });

  els.editSave.addEventListener('click', async () => {
    const days = parseInt(els.eDays.value, 10);
    if (!els.eTitle.value.trim()) return toast('请填写项目名', true);
    if (!els.eDate.value) return toast('请选择出发时间', true);
    if (!days || days < 1) return toast('天数无效', true);
    if (!editPoint) return toast('请在地图上选择目的地', true);
    if (!els.eDestName.value.trim()) return toast('请填写目的地名称', true);
    try {
      await api('PUT', `/api/trips/${tripId}`, {
        title: els.eTitle.value.trim(),
        dest_name: els.eDestName.value.trim(),
        dest_lat: editPoint.lat,
        dest_lng: editPoint.lng,
        depart_date: els.eDate.value,
        days,
        transport: els.eTransport.value,
        distance_km: els.eDistance.value ? Number(els.eDistance.value) : null,
        budget: els.eBudget.value ? Number(els.eBudget.value) : null,
      });
      toast('已保存');
      await reload();
      els.editForm.classList.add('hidden');
      els.infoView.classList.remove('hidden');
    } catch (_) { /* 已提示 */ }
  });

  els.tripDelete.addEventListener('click', async () => {
    if (!confirm(`确定删除「${trip.title}」？花费、行程、照片将全部删除！`)) return;
    try {
      await api('DELETE', `/api/trips/${tripId}`);
      location.href = '/trips.html';
    } catch (_) { /* 已提示 */ }
  });

  // ---------- 同行人 ----------
  function renderMembers() {
    els.memberList.innerHTML = '';
    trip.members.forEach((m) => {
      const tag = document.createElement('span');
      tag.className = 'tag tag-large';
      tag.innerHTML = esc(m.name) + (isGuest ? '' : '<button class="tag-x" title="移除">×</button>');
      if (!isGuest) {
        tag.querySelector('.tag-x').addEventListener('click', async () => {
          try {
            await api('DELETE', `/api/trips/${tripId}/members/${m.id}`);
            toast('已移除');
            await reload();
          } catch (_) { /* 已提示 */ }
        });
      }
      els.memberList.appendChild(tag);
    });
    els.xPayer.innerHTML = trip.members.map((m) => `<option>${esc(m.name)}</option>`).join('');
  }

  els.memberAddBtn.addEventListener('click', async () => {
    const name = els.memberAddInput.value.trim();
    if (!name) return;
    try {
      await api('POST', `/api/trips/${tripId}/members`, { name });
      els.memberAddInput.value = '';
      await reload();
    } catch (_) { /* 已提示 */ }
  });

  // ---------- 花费与分摊 ----------
  function renderSettlement() {
    const s = trip.settlement;
    if (!trip.members.length) { els.settlement.innerHTML = ''; return; }
    const balanceRows = s.balances.map((b) => `
      <tr>
        <td>${esc(b.name)}</td><td>${fmt(b.paid)}</td><td>${fmt(b.share)}</td>
        <td class="${b.balance >= 0 ? 'pos' : 'neg'}">${b.balance >= 0 ? '+' : ''}${b.balance.toFixed(2)}</td>
      </tr>`).join('');
    const transfers = s.transfers.length
      ? s.transfers.map((t) => `<li>${esc(t.from)} → ${esc(t.to)}：<strong>${fmt(t.amount)}</strong></li>`).join('')
      : '<li>当前无需转账</li>';
    els.settlement.innerHTML = `
      <div class="settle-summary">
        <div class="stat-card"><div class="stat-num">${fmt(s.total)}</div><div class="stat-label">总花费</div></div>
        <div class="stat-card"><div class="stat-num">${fmt(s.perPerson)}</div><div class="stat-label">人均</div></div>
        <div class="stat-card"><div class="stat-num">${trip.budget != null ? fmt(trip.budget) : '—'}</div><div class="stat-label">预算</div></div>
      </div>
      <table class="settle-table">
        <thead><tr><th>成员</th><th>已付</th><th>应付</th><th>差额</th></tr></thead>
        <tbody>${balanceRows}</tbody>
      </table>
      <div class="settle-transfers"><div class="form-label">转账建议</div><ul>${transfers}</ul></div>`;
  }

  function renderExpenses() {
    if (!trip.expenses.length) {
      els.expenseList.innerHTML = '<div class="visit-none">还没有花费记录</div>';
      return;
    }
    els.expenseList.innerHTML = trip.expenses.map((e) => `
      <div class="expense-row" data-id="${e.id}">
        <span class="expense-payer">${esc(e.payer)}</span>
        <span class="expense-amount">${fmt(e.amount)}</span>
        ${e.category ? `<span class="expense-cat">${esc(e.category)}</span>` : ''}
        <span class="expense-note">${esc(e.note || '')}</span>
        <span class="expense-date">${esc(e.spent_at)}</span>
        ${isGuest ? '' : '<button class="btn-icon" data-act="del-expense" title="删除">✕</button>'}
      </div>`).join('');
  }

  els.xAddBtn.addEventListener('click', async () => {
    const amount = Number(els.xAmount.value);
    if (!amount || amount <= 0) return toast('请填写金额', true);
    if (!els.xDate.value) return toast('请选择日期', true);
    try {
      await api('POST', `/api/trips/${tripId}/expenses`, {
        payer: els.xPayer.value,
        amount,
        category: els.xCategory.value,
        note: els.xNote.value.trim(),
        spent_at: els.xDate.value,
      });
      els.xAmount.value = '';
      els.xNote.value = '';
      await reload();
    } catch (_) { /* 已提示 */ }
  });

  els.expenseList.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act="del-expense"]');
    if (!btn) return;
    const row = btn.closest('.expense-row');
    if (!confirm('删除这笔花费？')) return;
    try {
      await api('DELETE', `/api/trips/${tripId}/expenses/${row.dataset.id}`);
      await reload();
    } catch (_) { /* 已提示 */ }
  });

  // ---------- 行程 ----------
  function renderItinerary() {
    els.itDay.innerHTML = Array.from({ length: trip.days }, (_, i) => `<option value="${i + 1}">第 ${i + 1} 天</option>`).join('');
    if (!trip.itinerary.length) {
      els.itinerary.innerHTML = '<div class="visit-none">还没有填写行程</div>';
      return;
    }
    const byDay = {};
    trip.itinerary.forEach((it) => {
      (byDay[it.day_no] = byDay[it.day_no] || []).push(it);
    });
    els.itinerary.innerHTML = Object.keys(byDay).sort((a, b) => a - b).map((day) => `
      <div class="day-block">
        <div class="day-title">第 ${day} 天</div>
        ${byDay[day].map((it) => `
          <div class="it-row" data-id="${it.id}">
            <span class="it-content">${esc(it.content)}</span>
            ${isGuest ? '' : '<button class="btn-icon" data-act="del-it" title="删除">✕</button>'}
          </div>`).join('')}
      </div>`).join('');
  }

  els.itAddBtn.addEventListener('click', async () => {
    const content = els.itContent.value.trim();
    if (!content) return;
    try {
      await api('POST', `/api/trips/${tripId}/itinerary`, { day_no: Number(els.itDay.value), content });
      els.itContent.value = '';
      await reload();
    } catch (_) { /* 已提示 */ }
  });

  els.itinerary.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act="del-it"]');
    if (!btn) return;
    const row = btn.closest('.it-row');
    try {
      await api('DELETE', `/api/trips/${tripId}/itinerary/${row.dataset.id}`);
      await reload();
    } catch (_) { /* 已提示 */ }
  });

  // ---------- AI 生成行程 ----------
  let aiItems = [];

  function renderAiPreview() {
    if (!aiItems.length) { els.aiPreview.classList.add('hidden'); return; }
    const byDay = {};
    aiItems.forEach((it) => { (byDay[it.day_no] = byDay[it.day_no] || []).push(it); });
    els.aiPreview.innerHTML = `
      <div class="ai-preview-title">AI 生成的行程预览（未保存）</div>
      ${Object.keys(byDay).sort((a, b) => a - b).map((day) => `
        <div class="day-block">
          <div class="day-title">第 ${day} 天</div>
          ${byDay[day].map((it) => `<div class="ai-row">${esc(it.content)}</div>`).join('')}
        </div>`).join('')}
      <div class="ai-actions">
        <button class="btn btn-small btn-ghost" id="ai-cancel">取消</button>
        <button class="btn btn-small btn-ghost" id="ai-regen">↻ 重新生成</button>
        <button class="btn btn-small btn-primary" id="ai-adopt">采用行程</button>
      </div>`;
    els.aiPreview.classList.remove('hidden');
    $('ai-cancel').addEventListener('click', () => {
      aiItems = [];
      els.aiPreview.classList.add('hidden');
    });
    $('ai-regen').addEventListener('click', generateAi);
    $('ai-adopt').addEventListener('click', adoptAi);
  }

  async function generateAi() {
    els.aiGenBtn.disabled = true;
    els.aiGenBtn.textContent = '生成中…';
    try {
      const data = await api('POST', `/api/trips/${tripId}/itinerary/generate`);
      aiItems = data.items || [];
      if (!aiItems.length) toast('AI 没有生成有效内容，请重试', true);
      renderAiPreview();
    } catch (_) { /* 已提示 */ } finally {
      els.aiGenBtn.disabled = false;
      els.aiGenBtn.textContent = '✨ AI 生成行程';
    }
  }

  async function adoptAi() {
    if (!aiItems.length) return;
    let mode = 'append';
    if (trip.itinerary.length) {
      mode = confirm(`已有 ${trip.itinerary.length} 条行程，用 AI 行程替换它们吗？\n「确定」替换，「取消」追加`) ? 'replace' : 'append';
    }
    try {
      await api('POST', `/api/trips/${tripId}/itinerary/bulk`, { items: aiItems, mode });
      toast('行程已保存');
      aiItems = [];
      els.aiPreview.classList.add('hidden');
      await reload();
    } catch (_) { /* 已提示 */ }
  }

  els.aiGenBtn.addEventListener('click', generateAi);

  // ---------- 照片墙 ----------
  function renderPhotos() {
    els.photoEmpty.classList.toggle('hidden', trip.photos.length > 0);
    els.photoWall.innerHTML = '';
    trip.photos.forEach((p) => {
      const cell = document.createElement('div');
      cell.className = 'photo-cell';
      cell.innerHTML = `
        <img src="/uploads/${tripId}/${p.filename}" alt="${esc(p.original_name || '照片')}" loading="lazy">
        ${isGuest ? '' : '<button class="photo-del" title="删除">×</button>'}`;
      cell.querySelector('img').addEventListener('click', () => {
        els.lightboxImg.src = `/uploads/${tripId}/${p.filename}`;
        els.lightbox.classList.remove('hidden');
      });
      const delBtn = cell.querySelector('.photo-del');
      if (delBtn) {
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('删除这张照片？')) return;
          try {
            await api('DELETE', `/api/trips/${tripId}/photos/${p.id}`);
            await reload();
          } catch (_) { /* 已提示 */ }
        });
      }
      els.photoWall.appendChild(cell);
    });
  }

  els.photoInput.addEventListener('change', async () => {
    if (!els.photoInput.files.length) return;
    const fd = new FormData();
    Array.from(els.photoInput.files).forEach((f) => fd.append('photos', f));
    toast('上传中…');
    try {
      await api('POST', `/api/trips/${tripId}/photos`, fd, true);
      toast('上传成功');
      await reload();
    } catch (_) { /* 已提示 */ }
    els.photoInput.value = '';
  });

  els.lightboxClose.addEventListener('click', () => els.lightbox.classList.add('hidden'));
  els.lightbox.addEventListener('click', (e) => {
    if (e.target === els.lightbox) els.lightbox.classList.add('hidden');
  });

  // ---------- 刷新 ----------
  async function reload() {
    trip = await api('GET', `/api/trips/${tripId}`);
    els.navTitle.textContent = trip.title;
    document.title = `${trip.title} - 结伴出行`;
    renderInfo();
    renderMembers();
    renderSettlement();
    renderExpenses();
    renderItinerary();
    renderPhotos();
  }

  // ---------- 退出 ----------
  els.logoutBtn.addEventListener('click', async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) { console.error(e); }
    location.href = '/login.html';
  });

  // ---------- 启动 ----------
  (async function init() {
    if (!Number.isInteger(tripId)) { location.href = '/trips.html'; return; }
    let me;
    try { me = await api('GET', '/api/auth/me'); } catch (_) { return; }
    isGuest = !!me.isGuest;
    els.currentUser.textContent = isGuest ? '游客' : me.username;
    if (isGuest) {
      els.guestBanner.classList.remove('hidden');
      ['infoOps', 'memberAddBox', 'expenseAddBox', 'itAddBox', 'photoUploadLabel', 'aiGenBtn']
        .forEach((k) => els[k].classList.add('hidden'));
    }
    try {
      await reload();
    } catch (_) {
      els.main.innerHTML = '<div class="empty-state">旅行项目不存在或无权访问</div>';
      els.main.hidden = false;
      return;
    }
    els.main.hidden = false;
    amapReady = await loadAmap();
    els.xDate.value = today();
  })();
})();
