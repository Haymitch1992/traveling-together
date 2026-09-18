<template>
  <div class="map-layout" :class="{ 'panel-collapsed': panelCollapsed }">
    <div ref="mapEl" class="map-container" @click="onMapClick">
      <div v-if="mapFailed" class="map-fallback">地图未加载（缺少高德 Key 或网络异常）</div>
    </div>

    <button
      class="panel-toggle"
      type="button"
      :title="panelCollapsed ? '展开面板' : '隐藏面板'"
      :aria-label="panelCollapsed ? '展开面板' : '隐藏面板'"
      @click="panelCollapsed = !panelCollapsed"
    >
      <span class="panel-toggle-icon" aria-hidden="true"></span>
      <span class="panel-toggle-text">{{ panelCollapsed ? '展开' : '隐藏' }}</span>
    </button>

    <aside class="panel">
      <button type="button" class="panel-handle" :title="panelCollapsed ? '展开面板' : '收起面板'" @click="panelCollapsed = !panelCollapsed" aria-label="折叠面板">
        <span class="panel-handle-bar"></span>
        <span class="panel-handle-hint">{{ panelCollapsed ? '上滑展开' : '点击收起' }}</span>
      </button>
      <header class="panel-header">
        <div class="panel-header-row">
          <h1>结伴出行</h1>
          <div class="user-info">
            <span class="user-chip user-chip-link" title="编辑个人资料" @click="router.push('/profile')">
              <span class="user-avatar">{{ avatarText }}</span>
              <span class="current-user">{{ authState.isGuest ? '游客' : authState.username }}</span>
            </span>
            <el-button size="small" text class="logout-btn" title="退出登录" @click="logout">退出</el-button>
          </div>
        </div>
        <p class="subtitle">和伙伴一起，记录走过的城市</p>
        <div class="panel-links">
          <router-link to="/trips" class="panel-link">旅行项目</router-link>
          <router-link to="/guestbook" class="panel-link">留言板</router-link>
        </div>
        <div v-if="authState.isGuest" class="guest-banner">游客模式 · 正在浏览 admin 的地图（只读）</div>
      </header>

      <div class="stats">
        <div class="stat-card"><div class="stat-num">{{ stats.cityCount }}</div><div class="stat-label">省市</div></div>
        <div class="stat-card"><div class="stat-num">{{ stats.visitCount }}</div><div class="stat-label">总次数</div></div>
        <div class="stat-card"><div class="stat-num">{{ stats.countryCount }}</div><div class="stat-label">国家/地区</div></div>
      </div>

      <div class="year-summary">
        <div class="year-summary-head">
          <span class="section-title">年度汇总</span>
          <el-select v-model="selectedYear" size="small" class="year-select" @change="onYearChange">
            <el-option value="all" label="全部" />
            <el-option v-for="y in summaryYears" :key="y" :value="y" :label="y" />
          </el-select>
        </div>
        <div class="year-nums">
          <div class="year-num"><strong>{{ summary ? summary.cityCount : 0 }}</strong><span>个省市</span></div>
          <div class="year-num"><strong>{{ summary ? summary.totalKm : 0 }}</strong><span>公里(往返)</span></div>
        </div>
        <el-button size="small" text class="ys-toggle" @click="detailVisible = true">查看明细 ▾</el-button>
      </div>

      <el-button
        v-if="authState.loaded && !authState.isGuest"
        class="create-trip-btn"
        type="primary"
        round
        @click="router.push('/trips/new')"
      >+ 发起旅行</el-button>

      <div v-if="!cities.length" class="empty-state">
        {{ authState.isGuest ? 'admin 还没有记录任何城市' : '还没有城市记录，点上方「发起旅行」开始吧' }}
      </div>

      <ul class="city-list">
        <li v-for="g in groupedCities" :key="g.name" class="region-group">
          <div class="region-head" @click="toggleRegion(g.name)">
            <span class="city-badge">{{ g.total }}</span>
            <span class="region-name">{{ g.name }}</span>
            <span class="region-sub">{{ g.list.length > 1 ? g.list.length + ' 个地点' : '' }}</span>
            <span class="chevron">{{ collapsedRegions.has(g.name) ? '▸' : '▾' }}</span>
          </div>
          <ul v-show="!collapsedRegions.has(g.name)" class="region-cities">
            <li
              v-for="city in g.list"
              :key="city.id"
              class="city-item"
              :class="{ expanded: expanded.has(city.id) }"
            >
              <div class="city-head" @click="toggleCity(city)">
                <span class="city-badge">{{ city.visitCount }}</span>
                <span class="city-name">{{ city.name }}<em v-if="city.name_en"> {{ city.name_en }}</em></span>
                <span class="city-country">{{ city.country }}</span>
                <span class="chevron">{{ expanded.has(city.id) ? '▾' : '▸' }}</span>
              </div>
              <div v-show="expanded.has(city.id)" class="city-detail">
                <template v-if="city.visits.length">
                  <div v-for="v in city.visits" :key="v.id" class="visit-row">
                    <template v-if="editingVisitId === v.id">
                      <el-date-picker
                        v-model="editDate"
                        type="date"
                        value-format="YYYY-MM-DD"
                        size="small"
                        class="edit-date"
                      />
                      <el-input v-model="editNote" size="small" placeholder="备注" class="edit-note" />
                      <span class="visit-ops">
                        <button class="btn-icon" title="保存" @click="saveVisit(v)">✓</button>
                        <button class="btn-icon" title="取消" @click="editingVisitId = null">✕</button>
                      </span>
                    </template>
                    <template v-else>
                      <span class="visit-date">{{ v.visited_at }}</span>
                      <span class="visit-note">{{ v.note || '' }}</span>
                      <span class="visit-ops">
                        <button
                          v-if="tripOfVisit(v)"
                          class="btn-icon"
                          title="查看行程详情"
                          @click="goTrip(tripOfVisit(v).id)"
                        >→</button>
                        <template v-if="!authState.isGuest">
                          <button
                            v-if="!tripOfVisit(v)"
                            class="btn-icon"
                            title="编辑"
                            @click="startEdit(v)"
                          >✎</button>
                          <button class="btn-icon" title="删除" @click="deleteVisit(city, v)">✕</button>
                        </template>
                      </span>
                    </template>
                  </div>
                </template>
                <div v-else class="visit-none">暂无到访记录</div>
                <div v-if="!authState.isGuest" class="city-detail-actions">
                  <el-button size="small" type="primary" @click="goCreateTrip(city)">再记一次</el-button>
                  <el-button size="small" type="danger" plain @click="deleteCity(city)">删除城市</el-button>
                </div>
              </div>
            </li>
          </ul>
        </li>
      </ul>
    </aside>

    <el-dialog
      v-model="detailVisible"
      :title="detailTitle"
      :width="isMobile ? '92%' : '560px'"
      class="detail-dialog"
    >
      <div class="table-scroll">
        <el-table :data="detailRows" size="small" max-height="420" empty-text="还没有记录">
          <el-table-column label="省市" min-width="100">
            <template #default="{ row }">
              <a v-if="row.trip" class="ys-trip-link" href="#" @click.prevent="goTripFromDialog(row.trip.id)">{{ row.name }}</a>
              <span v-else>{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="country" label="国家/地区" min-width="88" />
          <el-table-column prop="n" label="次数" width="64" align="right" />
          <el-table-column label="单程距离" width="100" align="right">
            <template #default="{ row }">{{ row.km != null ? (Math.round(row.km * 10) / 10) + ' km' : '—' }}</template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { get, put, del } from '../api';
import { loadAmap } from '../amap';
import { authState, fetchMe, logout } from '../auth';
import { markerStyle, travelerContent } from '../animals';

const router = useRouter();

// ---------- 状态 ----------
const mapEl = ref(null);
const mapFailed = ref(false);
const isMobile = ref(typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches);
// 手机端默认收起侧栏，先看地图
const panelCollapsed = ref(isMobile.value);
const cities = ref([]);
const trips = ref([]);
const stats = reactive({ cityCount: 0, visitCount: 0, countryCount: 0 });
const selectedYear = ref(String(new Date().getFullYear())); // 'all' = 全部
const summaryYears = ref([]);
const summary = ref(null);
const expanded = reactive(new Set()); // 展开详情的城市 id
const collapsedRegions = reactive(new Set());
const editingVisitId = ref(null);
const editDate = ref('');
const editNote = ref('');
const detailVisible = ref(false);

// 高德实例不能放进响应式系统
let map = null;
let markers = [];

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

// 到访记录关联的旅行项目（按备注 + 日期匹配）
function tripOfVisit(v) {
  if (!v.note || !v.note.startsWith('旅行项目：')) return null;
  const title = v.note.slice('旅行项目：'.length);
  return trips.value.find((t) => t.title === title && t.depart_date === v.visited_at) || null;
}

// ---------- 地图 ----------
function clearMarkers() {
  markers.forEach((m) => m.setMap(null));
  markers = [];
}

function renderMarkers() {
  if (!map) return;
  clearMarkers();
  cities.value.forEach((city) => {
    if (!city.visitCount) return;
    const { color, scale } = markerStyle(city.visitCount);
    const marker = new AMap.Marker({
      position: [city.lng, city.lat],
      content: travelerContent(scale, color, city.visitCount, city.id),
      anchor: 'bottom-center',
      zIndex: 100 + city.visitCount,
    });
    marker.on('click', () => openInfo(city));
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
    ? `<a class="info-trip-link" href="/trip/${linkedTrip.id}" data-trip-id="${linkedTrip.id}">查看行程：${esc(linkedTrip.title)} →</a>`
    : '';
  const info = new AMap.InfoWindow({
    isCustom: false,
    offset: new AMap.Pixel(0, -68),
    content: `<div class="info-win">
      <div class="info-title">${esc(city.name)}${city.name_en ? ' <span>' + esc(city.name_en) + '</span>' : ''}</div>
      <div class="info-sub">${esc(city.country)} · 去过 ${city.visitCount} 次</div>
      <ul class="info-history">${history}</ul>
      ${tripLink}
    </div>`,
  });
  info.open(map, [city.lng, city.lat]);
}

// InfoWindow 里的行程链接走 SPA 路由（事件委托在地图容器上）
function onMapClick(e) {
  const link = e.target.closest('.info-trip-link');
  if (!link || !link.dataset.tripId) return;
  e.preventDefault();
  router.push(`/trip/${link.dataset.tripId}`);
}

// ---------- 数据刷新 ----------
async function refresh() {
  editingVisitId.value = null;
  const yq = selectedYear.value !== 'all' ? `?year=${selectedYear.value}` : '';
  const [cityData, statData, tripData] = await Promise.all([
    get('/api/cities' + yq),
    get('/api/stats' + yq),
    get('/api/trips' + yq),
  ]);
  cities.value = cityData;
  trips.value = tripData;
  stats.cityCount = statData.cityCount;
  stats.visitCount = statData.visitCount;
  stats.countryCount = statData.countryCount;
  renderMarkers();
  loadYearly(selectedYear.value);
}

// ---------- 年度汇总（年份选择器同时作为全页筛选） ----------
async function loadYearly(year) {
  const y = year || 'all';
  let s;
  try {
    s = await get(`/api/summary/yearly?year=${y}`);
  } catch (_) { return; }
  summaryYears.value = s.years;
  // 当前年份没有数据时，自动落到最近有数据的年份
  if (y !== 'all' && s.years.length && !s.years.includes(y)) {
    selectedYear.value = s.years[0];
    await refresh();
    return;
  }
  summary.value = s;
}

async function onYearChange() {
  try { await refresh(); } catch (_) { /* 已提示 */ }
}

const detailTitle = computed(() => {
  const label = selectedYear.value === 'all' ? '全部年份' : `${selectedYear.value} 年`;
  return `${label} · 明细`;
});

// 次数与距离合并为一行（按省市）；距离取该省市下关联旅行项目的单程合计
const detailRows = computed(() => {
  const s = summary.value;
  if (!s) return [];
  const regionOf = (destName) => {
    const city = cities.value.find((c) => c.name === destName);
    return city ? (city.region || city.name) : destName;
  };
  const kmByRegion = {};
  const tripByRegion = {};
  s.trips.forEach((t) => {
    const names = (t.destinations && t.destinations.length)
      ? t.destinations.map((d) => d.name)
      : String(t.dest_name || '').split(' · ').map((n) => n.trim()).filter(Boolean);
    const keys = [...new Set(names.map((n) => regionOf(n)))];
    const share = keys.length && t.distance_km != null ? t.distance_km / keys.length : null;
    keys.forEach((key) => {
      if (share != null) kmByRegion[key] = (kmByRegion[key] || 0) + share;
      if (!tripByRegion[key]) tripByRegion[key] = t;
    });
  });
  return s.cities.map((c) => ({
    name: c.name,
    country: c.country,
    n: c.n,
    km: kmByRegion[c.name] ?? null,
    trip: tripByRegion[c.name] || null,
  }));
});

// ---------- 城市列表 ----------
// 按所属城市（region，省市归并）分组
const groupedCities = computed(() => {
  const groups = new Map();
  cities.value.forEach((city) => {
    const key = city.region || city.name;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(city);
  });
  return [...groups.entries()]
    .map(([name, list]) => ({ name, list, total: list.reduce((s, c) => s + c.visitCount, 0) }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'zh'));
});

function toggleRegion(name) {
  if (collapsedRegions.has(name)) collapsedRegions.delete(name);
  else collapsedRegions.add(name);
}

function toggleCity(city) {
  if (expanded.has(city.id)) {
    expanded.delete(city.id);
  } else {
    expanded.add(city.id);
    if (map) map.setCenter([city.lng, city.lat]);
  }
}

function goTrip(id) {
  router.push(`/trip/${id}`);
}

function goTripFromDialog(id) {
  detailVisible.value = false;
  router.push(`/trip/${id}`);
}

function startEdit(v) {
  editingVisitId.value = v.id;
  editDate.value = v.visited_at;
  editNote.value = v.note || '';
}

async function saveVisit(v) {
  if (!editDate.value) { ElMessage.error('日期不能为空'); return; }
  try {
    await put(`/api/visits/${v.id}`, { visited_at: editDate.value, note: editNote.value.trim() });
    ElMessage.success('已保存');
    await refresh();
  } catch (_) { /* 已提示 */ }
}

async function deleteVisit(city, v) {
  try {
    await ElMessageBox.confirm(`删除 ${city.name} ${v.visited_at} 这次记录？`, '删除到访记录', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch (_) { return; }
  try {
    await del(`/api/visits/${v.id}`);
    ElMessage.success('已删除到访记录');
    await refresh();
  } catch (_) { /* 已提示 */ }
}

function goCreateTrip(city) {
  router.push({
    path: '/trips/new',
    query: {
      dest: city.name,
      lat: String(city.lat),
      lng: String(city.lng),
      ...(city.country ? { country: city.country } : {}),
    },
  });
}

async function deleteCity(city) {
  const yearAll = selectedYear.value === 'all';
  const yearLabel = yearAll ? '全部年份' : `${selectedYear.value} 年`;
  try {
    await ElMessageBox.confirm(
      `确定清除「${city.name}」在${yearLabel}的全部旅行项目吗？相关到访记录也会一并删除。`,
      '删除城市',
      {
        confirmButtonText: '清除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
  } catch (_) { return; }
  try {
    const yq = yearAll ? '?year=all' : `?year=${selectedYear.value}`;
    const result = await del(`/api/cities/${city.id}${yq}`);
    expanded.delete(city.id);
    const n = result.deletedTrips || 0;
    ElMessage.success(
      n > 0
        ? `已清除「${city.name}」${yearLabel}的 ${n} 个旅行项目`
        : `已清除「${city.name}」${yearLabel}的相关记录`,
    );
    await refresh();
  } catch (_) { /* 已提示 */ }
}

// ---------- 用户胶囊 ----------
const avatarText = computed(() => {
  if (authState.isGuest) return '游';
  return (authState.username || '').slice(0, 1);
});

// ---------- 启动 ----------
let mq;
function onMqChange(e) {
  isMobile.value = e.matches;
}
onMounted(async () => {
  mq = window.matchMedia('(max-width: 768px)');
  mq.addEventListener('change', onMqChange);
  try {
    await fetchMe();
  } catch (_) {
    return; // 401 已由 api.js 跳转登录页
  }
  const ok = await loadAmap();
  if (ok) {
    map = new AMap.Map(mapEl.value, {
      zoom: 4,
      center: [105, 35], // 默认聚焦中国版图
      viewMode: '2D', // 高德默认样式
    });
    renderMarkers();
  } else {
    mapFailed.value = true;
  }
  try {
    await refresh();
  } catch (_) { /* 已提示 */ }
});

onBeforeUnmount(() => {
  if (mq) mq.removeEventListener('change', onMqChange);
  clearMarkers();
  if (map) { map.destroy(); map = null; }
});
</script>

<style scoped>
.map-layout {
  display: flex; height: 100%; height: 100dvh; overflow: hidden;
}

.map-container { flex: 1; position: relative; min-width: 0; min-height: 0; }
.map-fallback {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: var(--brand-sub); font-size: 14px; padding: 16px; text-align: center;
}

/* ---------- 面板折叠 ---------- */
.panel-toggle {
  position: fixed;
  top: calc(14px + var(--safe-top));
  right: 372px;
  z-index: 900;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px 0 10px;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  color: #8A5A2B;
  background: linear-gradient(180deg, #FFFDF7 0%, #FDEFD9 100%);
  box-shadow:
    0 0 0 1.5px rgba(244, 162, 97, 0.35),
    0 4px 14px rgba(74, 64, 57, 0.16);
  transition: right 0.25s ease, transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}
.panel-toggle:hover {
  transform: translateY(-1px);
  box-shadow:
    0 0 0 1.5px rgba(231, 111, 81, 0.45),
    0 8px 18px rgba(74, 64, 57, 0.18);
  background: linear-gradient(180deg, #FFFDF7 0%, #FCE8C8 100%);
}
.panel-toggle:active { transform: translateY(0) scale(0.98); }
.panel-toggle-icon {
  width: 18px; height: 18px;
  border-radius: 50%;
  background: linear-gradient(135deg, #F4A261, #E76F51);
  color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: transform 0.25s ease;
}
.panel-toggle-icon::before {
  content: '';
  width: 6px; height: 6px;
  border-right: 2px solid #fff;
  border-bottom: 2px solid #fff;
  transform: rotate(-45deg); /* 指向右侧面板：› */
  margin-left: -1px;
}
.panel-collapsed .panel-toggle-icon { transform: rotate(180deg); }
.panel-toggle-text {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  line-height: 1;
}
.panel-collapsed .panel-toggle { right: calc(12px + var(--safe-right)); }

.panel-handle {
  display: none; width: 100%; border: none; background: transparent;
  padding: 10px 0 6px; cursor: pointer;
}
.panel-handle-bar {
  display: block; width: 44px; height: 5px; margin: 0 auto;
  border-radius: 999px;
  background: linear-gradient(90deg, #F4A261, #E76F51);
  opacity: 0.85;
  box-shadow: 0 1px 2px rgba(74, 64, 57, 0.12);
}
.panel-handle-hint {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  color: var(--brand-sub);
  letter-spacing: 0.5px;
}
.panel-handle:active .panel-handle-bar { opacity: 1; transform: scaleX(1.08); }

/* ---------- 发起旅行（年度汇总下方） ---------- */
.create-trip-btn {
  width: 100%;
  margin-bottom: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  box-shadow: 0 4px 12px rgba(231, 111, 81, 0.35);
}

/* ---------- 右侧面板 ---------- */
.panel {
  width: 360px; flex-shrink: 0; overflow-y: auto;
  background: var(--brand-cream);
  border-left: 1px solid var(--brand-line);
  padding: 16px;
  transition: margin-right 0.25s ease, margin-bottom 0.25s ease, height 0.25s ease;
  -webkit-overflow-scrolling: touch;
}
.panel-collapsed .panel { margin-right: -360px; }

.panel-header-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.panel-header h1 { margin: 0; font-size: 20px; }
.subtitle { margin: 4px 0 10px; font-size: 12px; color: var(--brand-sub); }
.panel-links {
  display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 10px;
}
.panel-link {
  display: inline-flex; align-items: center;
  padding: 4px 12px; border-radius: 999px;
  background: #FFFDF8; border: 1.5px solid #EFD9B0;
  color: #A5700B; font-size: 12px; font-weight: 700;
  text-decoration: none;
  box-shadow: 0 2px 0 #F5E6C8;
}
.panel-link:hover { color: #D95F41; border-color: #F4C97A; }

.user-info { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.user-chip {
  display: inline-flex; align-items: center; gap: 6px;
  background: #fff; border: 1px solid var(--brand-line); border-radius: 999px;
  padding: 3px 10px 3px 3px; font-size: 13px;
}
.user-avatar {
  width: 24px; height: 24px; border-radius: 50%;
  background: linear-gradient(135deg, #F4A261, #E76F51);
  color: #fff; font-size: 12px; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center;
}
.current-user { max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-chip-link { cursor: pointer; transition: box-shadow 0.15s ease; }
.user-chip-link:hover { box-shadow: 0 0 0 2px var(--el-color-primary-light-7); }
.logout-btn { padding: 4px 6px; color: var(--brand-sub); }

.guest-banner {
  margin-top: 8px; padding: 8px 10px; border-radius: 10px;
  background: #FDEFD9; border: 1px solid #F4D9A8;
  color: #8A5A2B; font-size: 12px;
}

/* ---------- 统计卡片 ---------- */
.stats { display: flex; gap: 10px; margin: 12px 0; }
.stat-card {
  flex: 1; background: #fff; border: 1px solid var(--brand-line);
  border-radius: 14px; padding: 10px 6px; text-align: center;
  min-width: 0;
}
.stat-num { font-size: 20px; font-weight: 700; color: var(--el-color-primary); }
.stat-label { font-size: 12px; color: var(--brand-sub); margin-top: 2px; }

/* ---------- 年度汇总 ---------- */
.year-summary {
  background: #fff; border: 1px solid var(--brand-line);
  border-radius: 14px; padding: 12px; margin-bottom: 12px;
}
.year-summary-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 8px; }
.section-title { font-size: 14px; font-weight: 700; }
.year-select { width: 110px; }
.year-nums { display: flex; gap: 16px; flex-wrap: wrap; }
.year-num { display: flex; align-items: baseline; gap: 4px; }
.year-num strong { font-size: 22px; color: var(--el-color-primary); }
.year-num span { font-size: 12px; color: var(--brand-sub); }
.year-sub { font-size: 12px; color: var(--brand-sub); margin: 6px 0 4px; }
.ys-toggle { padding: 4px 0; font-size: 12px; }

/* ---------- 城市列表 ---------- */
.empty-state {
  padding: 24px 12px; text-align: center; color: var(--brand-sub); font-size: 13px;
  background: #fff; border: 1px dashed var(--brand-line); border-radius: 14px;
}
.city-list, .region-cities { list-style: none; margin: 0; padding: 0; }

.region-group { margin-bottom: 8px; }
.region-head {
  display: flex; align-items: center; gap: 8px;
  padding: 10px; cursor: pointer;
  background: #FBF3E6; border-radius: 12px;
}
.region-name { font-weight: 700; font-size: 14px; }
.region-sub { flex: 1; font-size: 12px; color: var(--brand-sub); }
.chevron { color: var(--brand-sub); font-size: 12px; }

.region-cities { padding: 4px 0 0 8px; }
.city-item {
  background: #fff; border: 1px solid var(--brand-line);
  border-radius: 12px; margin-top: 6px; overflow: hidden;
}
.city-head {
  display: flex; align-items: center; gap: 8px;
  padding: 10px; cursor: pointer;
}
.city-badge {
  min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px;
  background: linear-gradient(135deg, #F4A261, #E76F51);
  color: #fff; font-size: 11px; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center;
  box-sizing: border-box; flex-shrink: 0;
}
.city-name { font-size: 14px; font-weight: 600; min-width: 0; }
.city-name em { font-style: normal; font-weight: 400; font-size: 12px; color: var(--brand-sub); }
.city-country { flex: 1; font-size: 12px; color: var(--brand-sub); text-align: right; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.city-detail { padding: 4px 10px 10px; border-top: 1px dashed var(--brand-line); }
.visit-row {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 0; font-size: 13px;
  border-bottom: 1px dashed var(--brand-line);
  flex-wrap: wrap;
}
.visit-row:last-of-type { border-bottom: none; }
.visit-date { color: var(--brand-sub); flex-shrink: 0; }
.visit-note { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.visit-ops { display: inline-flex; gap: 4px; flex-shrink: 0; }
.btn-icon {
  width: 28px; height: 28px; border-radius: 8px;
  border: 1px solid var(--brand-line); background: var(--brand-cream);
  color: var(--brand-sub); font-size: 13px; cursor: pointer; line-height: 1; padding: 0;
}
.btn-icon:hover { border-color: var(--el-color-primary); color: var(--el-color-primary); }
.edit-date { width: 140px; max-width: 100%; }
.edit-note { flex: 1; min-width: 120px; }
.visit-none { padding: 8px 0; font-size: 12px; color: var(--brand-sub); }
.city-detail-actions { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }

.table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }

/* ---------- 明细弹窗 ---------- */
.ys-trip-link { color: var(--el-color-primary); font-weight: 600; text-decoration: none; }
.ys-trip-link:hover { text-decoration: underline; }

/* ---------- 移动端：底部抽屉 ---------- */
@media (max-width: 768px) {
  .map-layout { flex-direction: column; }
  .map-container { flex: 1; min-height: 0; }

  .panel {
    width: 100%;
    height: min(48dvh, 420px);
    border-left: none;
    border-top: 1px solid var(--brand-line);
    border-radius: 18px 18px 0 0;
    padding: 0 14px calc(14px + var(--safe-bottom));
    box-shadow: 0 -8px 24px rgba(74, 64, 57, 0.12);
    z-index: 850;
  }
  .panel-collapsed .panel {
    margin-right: 0;
    height: calc(52px + var(--safe-bottom));
    overflow: hidden;
  }
  .panel-handle {
    display: flex; flex-direction: column; align-items: center;
    position: sticky; top: 0; z-index: 2;
    background: linear-gradient(180deg, var(--brand-cream) 70%, transparent);
    border-radius: 18px 18px 0 0;
  }

  .panel-toggle {
    top: auto;
    bottom: calc(min(48dvh, 420px) + 12px);
    right: calc(12px + var(--safe-right));
    height: 40px;
    padding: 0 14px 0 10px;
  }
  .panel-collapsed .panel-toggle {
    bottom: calc(66px + var(--safe-bottom));
    right: calc(12px + var(--safe-right));
  }
  /* 手机端箭头改为上下方向 */
  .panel-toggle-icon::before {
    transform: rotate(45deg); /* ∨ 收起时指向下 */
    margin: -2px 0 0 0;
  }
  .panel-collapsed .panel-toggle-icon { transform: rotate(180deg); } /* ∧ 展开 */

  .panel-header h1 { font-size: 18px; }
  .stats { gap: 8px; }
  .stat-num { font-size: 18px; }
  .year-num strong { font-size: 18px; }
  .city-country { display: none; }
  .region-cities { padding-left: 4px; }
  .city-detail-actions :deep(.el-button) { flex: 1; }
}
</style>
