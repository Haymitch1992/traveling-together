<template>
  <div class="map-layout" :class="{ 'panel-collapsed': panelCollapsed }">
    <div ref="mapEl" class="map-container" @click="onMapClick">
      <div v-if="mapFailed" class="map-fallback">地图未加载（缺少高德 Key 或网络异常）</div>
    </div>

    <button class="panel-toggle" title="折叠/展开面板" @click="panelCollapsed = !panelCollapsed">☰</button>

    <el-button
      v-if="authState.loaded && !authState.isGuest"
      class="fab"
      type="primary"
      circle
      title="创建行程"
      @click="router.push('/trips/new')"
    >+</el-button>

    <aside class="panel">
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
        <div v-if="authState.isGuest" class="guest-banner">游客模式 · 正在浏览 admin 的地图（只读）</div>
      </header>

      <div class="stats">
        <div class="stat-card"><div class="stat-num">{{ stats.cityCount }}</div><div class="stat-label">城市</div></div>
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
          <div class="year-num"><strong>{{ summary ? summary.cityCount : 0 }}</strong><span>个地方</span></div>
          <div class="year-num"><strong>{{ summary ? summary.totalKm : 0 }}</strong><span>公里(往返)</span></div>
        </div>
        <div class="year-sub">{{ summaryLine }}</div>
        <el-button size="small" text class="ys-toggle" @click="detailVisible = true">查看明细 ▾</el-button>
      </div>

      <div v-if="!cities.length" class="empty-state">
        {{ authState.isGuest ? 'admin 还没有记录任何城市' : '还没有城市记录，点右下角 + 发起你的第一段旅行吧' }}
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
                  <el-button size="small" type="primary" @click="addVisit(city)">再记一次</el-button>
                  <el-button size="small" type="danger" plain @click="deleteCity(city)">删除城市</el-button>
                </div>
              </div>
            </li>
          </ul>
        </li>
      </ul>
    </aside>

    <el-dialog v-model="detailVisible" :title="detailTitle" width="560px">
      <el-table :data="detailRows" size="small" max-height="420" empty-text="还没有记录">
        <el-table-column label="地点" min-width="130">
          <template #default="{ row }">
            <a v-if="row.trip" class="ys-trip-link" href="#" @click.prevent="goTripFromDialog(row.trip.id)">{{ row.name }}</a>
            <span v-else>{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="country" label="国家/地区" min-width="100" />
        <el-table-column prop="n" label="次数" width="70" align="right" />
        <el-table-column label="单程距离" width="110" align="right">
          <template #default="{ row }">{{ row.km != null ? (Math.round(row.km * 10) / 10) + ' km' : '—' }}</template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { get, post, put, del } from '../api';
import { loadAmap } from '../amap';
import { authState, fetchMe, logout } from '../auth';
import { markerStyle, travelerContent } from '../animals';

const router = useRouter();

// ---------- 状态 ----------
const mapEl = ref(null);
const mapFailed = ref(false);
const panelCollapsed = ref(false);
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
      content: travelerContent(scale, color, city.visitCount),
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

const summaryLine = computed(() => {
  const s = summary.value;
  if (!s) return '';
  const label = s.year === 'all' ? '全部年份' : `${s.year} 年`;
  return `${label}：打卡 ${s.visitCount} 次 · 旅行 ${s.tripCount} 次 · 在外 ${s.tripDays} 天 · 单程合计 ${s.oneWayKm} km`;
});

const detailTitle = computed(() => {
  const label = selectedYear.value === 'all' ? '全部年份' : `${selectedYear.value} 年`;
  return `${label} · 明细`;
});

// 次数与距离合并为一行：距离取该地点关联旅行项目的单程合计
const detailRows = computed(() => {
  const s = summary.value;
  if (!s) return [];
  const kmByDest = {};
  const tripByDest = {};
  s.trips.forEach((t) => {
    if (t.distance_km != null) kmByDest[t.dest_name] = (kmByDest[t.dest_name] || 0) + t.distance_km;
    if (!tripByDest[t.dest_name]) tripByDest[t.dest_name] = t;
  });
  return s.cities.map((c) => ({
    name: c.name,
    country: c.country,
    n: c.n,
    km: kmByDest[c.name] ?? null,
    trip: tripByDest[c.name] || null,
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

async function addVisit(city) {
  let note = '';
  try {
    const { value } = await ElMessageBox.prompt('备注（可选，直接确定则留空）:', '再记一次', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '备注',
    });
    note = value || '';
  } catch (_) { return; }
  try {
    await post(`/api/cities/${city.id}/visits`, { visited_at: today(), note });
    ElMessage.success(`已记录一次 ${city.name} 的到访`);
    await refresh();
  } catch (_) { /* 已提示 */ }
}

async function deleteCity(city) {
  try {
    await ElMessageBox.confirm(`确定删除「${city.name}」及其全部到访记录吗？`, '删除城市', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch (_) { return; }
  try {
    await del(`/api/cities/${city.id}`);
    expanded.delete(city.id);
    ElMessage.success(`已删除 ${city.name}`);
    await refresh();
  } catch (_) { /* 已提示 */ }
}

// ---------- 用户胶囊 ----------
const avatarText = computed(() => {
  if (authState.isGuest) return '游';
  return (authState.username || '').slice(0, 1);
});

// ---------- 启动 ----------
onMounted(async () => {
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
  clearMarkers();
  if (map) { map.destroy(); map = null; }
});
</script>

<style scoped>
.map-layout { display: flex; height: 100%; overflow: hidden; }

.map-container { flex: 1; position: relative; min-width: 0; }
.map-fallback {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: var(--brand-sub); font-size: 14px;
}

/* ---------- 面板折叠 ---------- */
.panel-toggle {
  position: fixed; top: 12px; right: 372px; z-index: 900;
  width: 32px; height: 32px; border-radius: 50%;
  border: 1px solid var(--brand-line); background: var(--brand-cream);
  color: var(--brand-ink); cursor: pointer; font-size: 14px;
  box-shadow: 0 2px 8px rgba(74, 64, 57, 0.15);
  transition: right 0.25s ease;
}
.panel-collapsed .panel-toggle { right: 12px; }

/* ---------- 创建行程悬浮按钮 ---------- */
.fab {
  position: fixed; right: 440px; bottom: 32px; z-index: 900;
  width: 54px; height: 54px; font-size: 28px; line-height: 1; padding: 0;
  box-shadow: 0 6px 16px rgba(231, 111, 81, 0.45);
  transition: right 0.25s ease;
}
.panel-collapsed .fab { right: 48px; }

/* ---------- 右侧面板 ---------- */
.panel {
  width: 360px; flex-shrink: 0; overflow-y: auto;
  background: var(--brand-cream);
  border-left: 1px solid var(--brand-line);
  padding: 16px;
  transition: margin-right 0.25s ease;
}
.panel-collapsed .panel { margin-right: -360px; }

.panel-header-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.panel-header h1 { margin: 0; font-size: 20px; }
.subtitle { margin: 4px 0 10px; font-size: 12px; color: var(--brand-sub); }

.user-info { display: flex; align-items: center; gap: 6px; }
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
}
.stat-num { font-size: 20px; font-weight: 700; color: var(--el-color-primary); }
.stat-label { font-size: 12px; color: var(--brand-sub); margin-top: 2px; }

/* ---------- 年度汇总 ---------- */
.year-summary {
  background: #fff; border: 1px solid var(--brand-line);
  border-radius: 14px; padding: 12px; margin-bottom: 12px;
}
.year-summary-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.section-title { font-size: 14px; font-weight: 700; }
.year-select { width: 110px; }
.year-nums { display: flex; gap: 16px; }
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
  padding: 8px 10px; cursor: pointer;
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
  padding: 8px 10px; cursor: pointer;
}
.city-badge {
  min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px;
  background: linear-gradient(135deg, #F4A261, #E76F51);
  color: #fff; font-size: 11px; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center;
  box-sizing: border-box; flex-shrink: 0;
}
.city-name { font-size: 14px; font-weight: 600; }
.city-name em { font-style: normal; font-weight: 400; font-size: 12px; color: var(--brand-sub); }
.city-country { flex: 1; font-size: 12px; color: var(--brand-sub); text-align: right; }

.city-detail { padding: 4px 10px 10px; border-top: 1px dashed var(--brand-line); }
.visit-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 0; font-size: 13px;
  border-bottom: 1px dashed var(--brand-line);
}
.visit-row:last-of-type { border-bottom: none; }
.visit-date { color: var(--brand-sub); flex-shrink: 0; }
.visit-note { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.visit-ops { display: inline-flex; gap: 4px; flex-shrink: 0; }
.btn-icon {
  width: 22px; height: 22px; border-radius: 6px;
  border: 1px solid var(--brand-line); background: var(--brand-cream);
  color: var(--brand-sub); font-size: 12px; cursor: pointer; line-height: 1; padding: 0;
}
.btn-icon:hover { border-color: var(--el-color-primary); color: var(--el-color-primary); }
.edit-date { width: 140px; }
.edit-note { flex: 1; }
.visit-none { padding: 8px 0; font-size: 12px; color: var(--brand-sub); }
.city-detail-actions { display: flex; gap: 8px; margin-top: 8px; }

/* ---------- 明细弹窗 ---------- */
.ys-trip-link { color: var(--el-color-primary); font-weight: 600; text-decoration: none; }
.ys-trip-link:hover { text-decoration: underline; }

/* ---------- 移动端适配 ---------- */
@media (max-width: 768px) {
  .map-layout { flex-direction: column; }
  .map-container { flex: 1; min-height: 45vh; }
  .panel { width: 100%; height: 55vh; border-left: none; border-top: 1px solid var(--brand-line); }
  .panel-collapsed .panel { margin-right: 0; margin-bottom: calc(-55vh + 40px); }
  .panel-toggle { top: auto; bottom: calc(55vh + 8px); right: 12px; }
  .fab { right: 16px; bottom: calc(55vh + 52px); }
}
</style>
