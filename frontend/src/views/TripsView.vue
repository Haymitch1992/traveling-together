<template>
  <div class="trips-page">
    <nav class="top-nav">
      <div class="top-nav-left">
        <router-link to="/" class="nav-link">← 旅行地图</router-link>
        <span class="nav-title">旅行项目</span>
      </div>
      <div class="user-info">
        <span class="current-user">{{ authState.isGuest ? '游客' : authState.username }}</span>
        <el-button size="small" text @click="logout">退出</el-button>
      </div>
    </nav>

    <div v-if="authState.isGuest" class="guest-banner">游客模式 · 正在浏览 admin 的旅行项目（只读）</div>

    <main class="trips-main">
      <!-- 出发城市 -->
      <section class="card">
        <div class="card-title">🏠 我的出发城市</div>
        <div v-if="hasHome && !homeEditing" class="home-row">
          <span class="home-name">{{ profile.home_name }}</span>
          <el-button v-if="!authState.isGuest" size="small" text @click="homeEditing = true">修改</el-button>
        </div>
        <div v-else-if="!authState.isGuest" class="home-row">
          <div class="search-box search-box-inline">
            <el-input
              v-model="homeQuery"
              placeholder="搜索并选择你的常住城市"
              clearable
              @input="onHomeInput"
            />
            <ul v-if="homeShowResults" class="search-results">
              <li v-if="!homeResults.length" class="search-none">未找到匹配的城市</li>
              <li v-for="c in homeResults" :key="c.name + c.lat" @click="pickHome(c)">
                <strong>{{ c.name }}</strong>
                <em v-if="c.name_en"> {{ c.name_en }}</em>
                <span class="search-country">· {{ c.country }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- 发起旅行 -->
      <section v-if="!authState.isGuest" class="card">
        <div class="card-title-row">
          <div class="card-title" style="margin-bottom: 0">✈️ 发起旅行</div>
          <el-button type="primary" round class="create-btn" @click="openCreate">+ 发起旅行</el-button>
        </div>
      </section>

      <!-- 同行人榜单 -->
      <section v-if="companionBoard.length" class="card">
        <div class="card-title">👥 同行人榜单</div>
        <div class="companion-list">
          <div v-for="(c, i) in shownCompanions" :key="c.name" class="companion-row">
            <span class="companion-rank">{{ medals[i] || (i + 1) }}</span>
            <span class="companion-name">{{ c.name }}</span>
            <span class="companion-count">同行 {{ c.n }} 次</span>
          </div>
          <el-button
            v-if="companionBoard.length > 3"
            size="small"
            text
            class="companion-toggle"
            @click="companionExpanded = !companionExpanded"
          >
            {{ companionExpanded ? '收起 ▴' : `查看全部（共 ${companionBoard.length} 人）▾` }}
          </el-button>
        </div>
      </section>

      <!-- 项目列表 -->
      <div class="list-head">
        <span class="list-title">全部项目</span>
        <el-select v-model="filterYear" size="small" style="width: 130px" @change="loadTrips">
          <el-option value="all" label="全部年份" />
          <el-option v-for="y in yearOptions" :key="y" :value="String(y)" :label="y" />
        </el-select>
      </div>
      <div v-if="!trips.length" class="empty-state">还没有旅行项目，点击「发起旅行」开始规划吧</div>
      <div class="trips-list">
        <div v-for="t in trips" :key="t.id" class="trip-card card" @click="goTrip(t.id)">
          <div class="trip-card-head">
            <span class="trip-card-title">{{ t.title }}</span>
            <span class="trip-card-dest">{{ t.dest_name }}</span>
          </div>
          <div class="trip-card-meta">
            {{ t.depart_date }} · {{ t.days }} 天 · {{ t.transport }}<template v-if="t.distance_km != null"> · 单程 {{ t.distance_km }} km</template>
          </div>
          <div class="trip-card-meta">
            👥 {{ t.memberCount }} 人 · 📷 {{ t.photoCount }} 张 · 已花 ¥{{ (t.spent ?? 0).toFixed(2) }}<template v-if="t.budget"> / 预算 ¥{{ t.budget.toFixed(2) }}</template>
          </div>
        </div>
      </div>
    </main>

    <!-- 发起旅行弹窗 -->
    <el-dialog
      v-model="createVisible"
      title="✈️ 发起旅行"
      width="880px"
      class="create-dialog"
      @opened="onDialogOpened"
    >
      <div class="create-form">
        <div class="form-grid">
          <label>
            <span class="form-label">旅行项目名</span>
            <el-input v-model="form.title" maxlength="50" placeholder="如：五一川西自驾" />
          </label>
          <label>
            <span class="form-label">出发时间</span>
            <el-date-picker
              v-model="form.date"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择日期"
              style="width: 100%"
            />
          </label>
          <label>
            <span class="form-label">旅行天数</span>
            <el-input-number v-model="form.days" :min="1" :max="365" style="width: 100%" />
          </label>
          <label>
            <span class="form-label">出行方式</span>
            <el-select v-model="form.transport" style="width: 100%" @change="recalcDistance">
              <el-option v-for="t in transports" :key="t" :value="t" :label="t" />
            </el-select>
          </label>
          <label>
            <span class="form-label">总预算（元，可选）</span>
            <el-input-number v-model="form.budget" :min="0" :precision="2" :controls="false" placeholder="如 5000" style="width: 100%" />
          </label>
        </div>

        <div class="form-block">
          <div class="form-label">同行人（我默认同行，回车添加其他伙伴）</div>
          <div v-if="quickPicks.length" class="member-quick">
            <span class="quick-label">常客：</span>
            <button
              v-for="c in quickPicks"
              :key="c.name"
              type="button"
              class="quick-chip"
              @click="addQuick(c.name)"
            >{{ c.name }} <em>{{ c.n }}次</em></button>
          </div>
          <div class="tag-input">
            <el-tag
              v-for="(m, idx) in members"
              :key="m"
              closable
              round
              class="member-tag"
              @close="members.splice(idx, 1)"
            >{{ m }}</el-tag>
            <input
              v-model="memberInput"
              type="text"
              placeholder="输入名字后回车"
              maxlength="20"
              @keydown.enter.prevent="addMemberFromInput"
            >
          </div>
        </div>

        <div class="form-block">
          <div class="form-label">目的地（输入搜索，或直接在地图上点击选点）</div>
          <div class="dest-picker">
            <div class="dest-side">
              <div class="search-box">
                <el-input
                  v-model="destName"
                  placeholder="搜索城市，或直接输入名称"
                  maxlength="50"
                  clearable
                  @input="onDestInput"
                />
                <ul v-if="destShowResults" class="search-results">
                  <li v-if="!destResults.length" class="search-none">未找到匹配的城市</li>
                  <li v-for="c in destResults" :key="c.name + c.lat" @click="pickDest(c)">
                    <strong>{{ c.name }}</strong>
                    <em v-if="c.name_en"> {{ c.name_en }}</em>
                    <span class="search-country">· {{ c.country }}</span>
                  </li>
                </ul>
              </div>
              <div class="dest-coord">{{ destCoordText }}</div>
              <div v-if="distanceHint" class="distance-hint">{{ distanceHint }}</div>
            </div>
            <div ref="pickerMapEl" class="picker-map"></div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button round @click="createVisible = false">取消</el-button>
        <el-button type="primary" round class="submit-btn" @click="submit">发起旅行</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { get, post, put } from '../api';
import { loadAmap, haversineKm } from '../amap';
import { authState, fetchMe, logout } from '../auth';

const route = useRoute();
const router = useRouter();

const medals = ['🥇', '🥈', '🥉'];
const transports = ['驾车', '火车', '飞机', '骑行', '步行', '其他'];

// ---------- 状态 ----------
const profile = ref(null);
const homeEditing = ref(false);
const homeQuery = ref('');
const homeResults = ref([]);
const homeShowResults = ref(false);

const companions = ref([]); // [{name, n}]
const companionExpanded = ref(false);

const trips = ref([]);
const yearOptions = ref([]);
const filterYear = ref('all');

const createVisible = ref(false);
const form = reactive({
  title: '',
  date: '',
  days: 3,
  transport: '驾车',
  budget: undefined,
});
const members = ref([]);
const memberInput = ref('');

const destName = ref('');
const destResults = ref([]);
const destShowResults = ref(false);
const destPoint = ref(null); // {lat, lng}
let destCountry = null;
const destCoordText = ref('尚未选点');
const distanceHint = ref('');
let computedDistance = null;

const pickerMapEl = ref(null);
let pickerMap = null;
let originMarker = null;
let destMarker = null;
let amapReady = false;

// ---------- 计算属性 ----------
const hasHome = computed(() => !!(profile.value && profile.value.home_name));
const companionBoard = computed(() => companions.value.filter((c) => c.name !== '我'));
const shownCompanions = computed(() =>
  companionExpanded.value ? companionBoard.value : companionBoard.value.slice(0, 3));
const quickPicks = computed(() =>
  companions.value.filter((c) => c.name !== '我' && !members.value.includes(c.name)));

// ---------- 工具 ----------
function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function searchCities(q, resultsRef, showRef) {
  return get(`/api/cities/search?q=${encodeURIComponent(q)}`)
    .then((list) => { resultsRef.value = list; showRef.value = true; })
    .catch(() => { /* 已提示 */ });
}

const doHomeSearch = debounce((q) => searchCities(q, homeResults, homeShowResults), 300);
const doDestSearch = debounce((q) => searchCities(q, destResults, destShowResults), 300);

function onHomeInput(v) {
  const q = (v || '').trim();
  if (!q) { homeShowResults.value = false; return; }
  doHomeSearch(q);
}

function onDestInput(v) {
  const q = (v || '').trim();
  if (!q) { destShowResults.value = false; return; }
  doDestSearch(q);
}

function onDocClick(e) {
  if (!e.target.closest('.search-box')) {
    homeShowResults.value = false;
    destShowResults.value = false;
  }
}

// ---------- 出发城市 ----------
async function pickHome(c) {
  homeShowResults.value = false;
  homeQuery.value = '';
  try {
    profile.value = await put('/api/profile', { home_name: c.name, home_lat: c.lat, home_lng: c.lng });
    ElMessage.success(`出发城市已设为 ${c.name}`);
    homeEditing.value = false;
  } catch (_) { /* 已提示 */ }
}

// ---------- 同行人榜单 ----------
async function loadCompanions() {
  try {
    companions.value = await get('/api/companions');
  } catch (_) { /* 已提示 */ }
}

// ---------- 同行人标签 ----------
function addMemberFromInput() {
  const name = memberInput.value.trim();
  memberInput.value = '';
  if (!name) return;
  if (name === '我') { ElMessage.warning('我默认同行，无需添加'); return; }
  if (members.value.includes(name)) { ElMessage.error('该成员已添加'); return; }
  members.value.push(name);
}

function addQuick(name) {
  if (!members.value.includes(name)) members.value.push(name);
}

// ---------- 选点地图 ----------
async function ensurePickerMap() {
  if (pickerMap || !amapReady) return;
  await nextTick();
  if (!pickerMapEl.value) return;
  const center = profile.value && profile.value.home_lat != null
    ? [profile.value.home_lng, profile.value.home_lat] : [105, 35];
  pickerMap = new AMap.Map(pickerMapEl.value, {
    zoom: profile.value && profile.value.home_lat != null ? 5 : 3,
    center,
  });
  if (profile.value && profile.value.home_lat != null) {
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
    if (!destName.value.trim()) destName.value = '地图选点';
  });
}

function setDestPoint(p) {
  destPoint.value = p;
  destCoordText.value = `已选：${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
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
  distanceHint.value = '';
  if (!destPoint.value) return;
  const origin = profile.value && profile.value.home_lat != null
    ? { lat: profile.value.home_lat, lng: profile.value.home_lng } : null;
  if (!origin) {
    distanceHint.value = '未设置出发城市，无法自动计算距离';
    return;
  }
  const transport = form.transport;
  const pluginMap = { '驾车': 'Driving', '骑行': 'Riding', '步行': 'Walking' };
  const plugin = pluginMap[transport];
  if (plugin && amapReady && window.AMap && window.AMap[plugin]) {
    distanceHint.value = '正在计算路线…';
    const router2 = new window.AMap[plugin]();
    router2.search([origin.lng, origin.lat], [destPoint.value.lng, destPoint.value.lat], (status, result) => {
      if (status === 'complete' && result.routes && result.routes.length) {
        const km = result.routes[0].distance / 1000;
        computedDistance = Math.round(km * 10) / 10;
        distanceHint.value = `单程距离：${transport}路线约 ${km.toFixed(1)} 公里（高德路径规划）`;
      } else {
        const km = haversineKm(origin, destPoint.value);
        computedDistance = Math.round(km * 10) / 10;
        distanceHint.value = `单程距离：路线规划失败，直线距离约 ${km.toFixed(1)} 公里`;
      }
    });
  } else {
    const km = haversineKm(origin, destPoint.value);
    computedDistance = Math.round(km * 10) / 10;
    distanceHint.value = `单程距离：${transport}无路线规划，直线距离约 ${km.toFixed(1)} 公里`;
  }
}

function pickDest(c) {
  destShowResults.value = false;
  destName.value = c.name;
  destCountry = c.country;
  setDestPoint({ lat: c.lat, lng: c.lng });
}

// ---------- 发起弹窗 ----------
function openCreate() {
  createVisible.value = true;
  if (!form.date) form.date = today();
}

async function onDialogOpened() {
  await ensurePickerMap();
  if (pickerMap) pickerMap.resize();
}

async function submit() {
  const title = form.title.trim();
  const dest = destName.value.trim();
  if (!title) return ElMessage.error('请填写旅行项目名');
  if (!form.date) return ElMessage.error('请选择出发时间');
  const days = parseInt(form.days, 10);
  if (!days || days < 1) return ElMessage.error('请填写旅行天数');
  if (!destPoint.value) return ElMessage.error('请在地图上选择目的地');
  if (!dest) return ElMessage.error('请填写目的地名称');
  const body = {
    title,
    dest_name: dest,
    dest_lat: destPoint.value.lat,
    dest_lng: destPoint.value.lng,
    dest_country: destCountry,
    depart_date: form.date,
    days,
    transport: form.transport,
    distance_km: computedDistance,
    budget: form.budget ? Number(form.budget) : null,
    members: ['我', ...members.value], // 我默认每次同行
  };
  try {
    const trip = await post('/api/trips', body);
    ElMessage.success('旅行项目已创建');
    router.push(`/trip/${trip.id}`);
  } catch (_) { /* 已提示 */ }
}

// ---------- 项目列表 ----------
async function loadTrips() {
  try {
    trips.value = await get('/api/trips' + (filterYear.value !== 'all' ? `?year=${filterYear.value}` : ''));
  } catch (_) { /* 已提示 */ }
}

async function loadYearOptions() {
  try {
    const s = await get('/api/summary/yearly?year=all');
    yearOptions.value = s.years;
  } catch (_) { /* 已提示 */ }
}

function goTrip(id) {
  router.push(`/trip/${id}`);
}

// ---------- 启动 ----------
onMounted(async () => {
  document.addEventListener('click', onDocClick);
  try { await fetchMe(); } catch (_) { return; }
  try { profile.value = await get('/api/profile'); } catch (_) { /* 已提示 */ }
  amapReady = await loadAmap(['AMap.Driving', 'AMap.Riding', 'AMap.Walking']);
  await loadYearOptions();
  await loadCompanions();
  await loadTrips();
  // /trips/new 进入时直接打开发起弹窗
  if (!authState.isGuest && route.path === '/trips/new') openCreate();
});

onUnmounted(() => {
  document.removeEventListener('click', onDocClick);
});
</script>

<style scoped>
.trips-page { min-height: 100vh; }

.top-nav {
  display: flex; align-items: center; justify-content: space-between;
  background: rgba(255, 253, 247, 0.88); backdrop-filter: blur(8px);
  border-bottom: 2px solid #ffffff; box-shadow: 0 4px 16px rgba(74, 64, 57, 0.06);
  padding: 12px 24px; position: sticky; top: 0; z-index: 800;
}
.top-nav-left { display: flex; align-items: center; gap: 14px; }
.nav-link { color: #E76F51; font-weight: 600; text-decoration: none; font-size: 14px; }
.nav-link:hover { text-decoration: underline; }
.nav-title { font-size: 19px; font-weight: 700; color: var(--brand-ink); }
.user-info { display: flex; align-items: center; gap: 8px; }
.current-user {
  background: #fff; border: 1px solid var(--brand-line); border-radius: 999px;
  padding: 4px 14px; font-size: 13px; font-weight: 600; color: var(--brand-sub);
}

.guest-banner {
  margin: 12px 24px 0;
  background: #fef3c7; color: #92400e;
  border: 1px solid #fde68a; border-radius: 8px;
  padding: 8px 12px; font-size: 13px;
}

.trips-main { max-width: 860px; margin: 0 auto; padding: 20px 16px 60px; }

.card {
  background: var(--brand-cream); border: 2px solid #ffffff; border-radius: 20px;
  box-shadow: 0 10px 30px rgba(74, 64, 57, 0.08);
  padding: 22px 24px; margin-bottom: 16px;
}
.card-title { font-size: 19px; font-weight: 700; color: var(--brand-ink); margin-bottom: 12px; }
.card-title-row { display: flex; align-items: center; justify-content: space-between; }

.home-row { display: flex; align-items: center; gap: 10px; min-height: 38px; }
.home-name { font-size: 17px; font-weight: 700; color: #D95F41; }

/* 搜索下拉 */
.search-box { position: relative; }
.search-box-inline { flex: 1; }
.search-results {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 500;
  background: #fff; border: 1px solid var(--brand-line); margin: 0; padding: 0;
  border-radius: 10px; box-shadow: 0 8px 24px rgba(74, 64, 57, 0.12);
  list-style: none; max-height: 260px; overflow-y: auto;
}
.search-results li { padding: 10px 14px; font-size: 14px; cursor: pointer; }
.search-results li:hover { background: #fef9c3; }
.search-results em { font-style: normal; color: var(--brand-sub); font-size: 13px; }
.search-country { color: var(--brand-sub); font-size: 13px; }
.search-none { color: var(--brand-sub); cursor: default !important; }

/* 同行人榜单 */
.companion-list { display: flex; flex-direction: column; gap: 8px; }
.companion-row {
  display: flex; align-items: center; gap: 10px;
  background: #fff; border: 1px solid var(--brand-line); border-radius: 12px;
  padding: 8px 14px; font-size: 14px;
}
.companion-rank { width: 26px; text-align: center; font-weight: 700; color: var(--brand-sub); }
.companion-name { font-weight: 600; }
.companion-count { margin-left: auto; color: var(--brand-sub); font-size: 13px; }
.companion-toggle { align-self: flex-start; }

/* 列表头 + 项目卡片 */
.list-head {
  display: flex; align-items: center; justify-content: space-between;
  margin: 20px 2px 12px;
}
.list-title { font-size: 16px; font-weight: 700; }
.empty-state { text-align: center; color: var(--brand-sub); padding: 40px 0; font-size: 14px; }

.trips-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px; }
.trip-card {
  position: relative; overflow: hidden; cursor: pointer; margin-bottom: 0;
  border-radius: 18px; transition: transform 0.15s, box-shadow 0.15s;
}
.trip-card::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 5px;
  background: linear-gradient(180deg, #F4A261, #E76F51);
}
.trip-card:hover { transform: translateY(-3px); box-shadow: 0 14px 30px rgba(74, 64, 57, 0.13); }
.trip-card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.trip-card-title { font-size: 17px; font-weight: 700; color: var(--brand-ink); }
.trip-card-dest { color: #D95F41; font-size: 14px; font-weight: 600; flex-shrink: 0; }
.trip-card-meta { color: var(--brand-sub); font-size: 13px; margin-top: 6px; }

/* 发起弹窗 */
.create-form {
  background: #FAF5EA; border: 2px dashed #EFE0C3;
  border-radius: 16px; padding: 18px;
}
.form-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px; margin-bottom: 14px;
}
.form-grid label { display: flex; flex-direction: column; gap: 6px; }
.form-label { color: var(--brand-sub); font-weight: 600; font-size: 13px; }
.form-block { margin-bottom: 14px; }
.form-block .form-label { margin-bottom: 8px; font-size: 14px; }

/* 常客 chips */
.member-quick { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 8px; }
.quick-label { font-size: 13px; color: var(--brand-sub); }
.quick-chip {
  border: 1px solid #F5D9A8; background: #FDEFD9; color: #A5700B;
  border-radius: 999px; padding: 3px 12px; font-size: 13px; cursor: pointer;
  transition: transform 0.12s ease;
}
.quick-chip:hover { transform: scale(1.06); }
.quick-chip em { font-style: normal; font-size: 11px; opacity: 0.75; }

/* 同行人标签输入 */
.tag-input {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  border: 2px solid var(--brand-line); border-radius: 12px;
  padding: 8px 10px; background: #ffffff;
}
.tag-input:focus-within { border-color: #F4A261; box-shadow: 0 0 0 3px rgba(244, 162, 97, 0.2); }
.tag-input input { border: none; outline: none; flex: 1; min-width: 120px; font-size: 14px; padding: 4px; }
.member-tag { font-weight: 600; }

/* 目的地选点 */
.dest-picker { display: flex; gap: 14px; }
.dest-side {
  width: 260px; flex-shrink: 0; display: flex; flex-direction: column; gap: 10px;
  background: #ffffff; border: 2px solid var(--brand-line);
  border-radius: 14px; padding: 14px;
}
.picker-map {
  flex: 1; height: 320px; border-radius: 16px;
  border: 3px solid #ffffff; background: #e5e7eb;
  box-shadow: 0 6px 18px rgba(74, 64, 57, 0.12); overflow: hidden;
}
.dest-coord { font-size: 13px; color: #B9AE9F; }
.distance-hint {
  font-size: 13px; background: #E9F6E3; border-radius: 10px;
  padding: 8px 12px; color: #4E7A36; font-weight: 600;
}

.create-btn {
  font-weight: 700; letter-spacing: 1px;
  box-shadow: 0 4px 12px rgba(231, 111, 81, 0.35);
}
.submit-btn { font-weight: 700; letter-spacing: 1px; box-shadow: 0 4px 12px rgba(231, 111, 81, 0.3); }

@media (max-width: 720px) {
  .dest-picker { flex-direction: column; }
  .dest-side { width: 100%; }
  .picker-map { height: 260px; }
  .top-nav { padding: 10px 14px; }
}
</style>
