<template>
  <div class="trips-page">
    <nav class="top-nav">
      <template v-if="isMobile && createVisible">
        <div class="top-nav-left">
          <a href="#" class="nav-link" @click.prevent="closeCreate">← 返回</a>
          <span class="nav-title">发起旅行</span>
        </div>
      </template>
      <template v-else>
        <div class="top-nav-left">
          <router-link to="/" class="nav-link">← 旅行地图</router-link>
          <span class="nav-title">旅行项目</span>
        </div>
        <div class="user-info">
          <router-link to="/guestbook" class="nav-link guestbook-link">留言板</router-link>
          <router-link
            v-if="!authState.isGuest && authState.username === 'admin'"
            to="/admin"
            class="nav-link guestbook-link"
          >后台管理</router-link>
          <span class="current-user user-link" title="编辑个人资料" @click="router.push('/profile')">{{ authState.isGuest ? '游客' : authState.username }}</span>
          <el-button size="small" text @click="logout">退出</el-button>
        </div>
      </template>
    </nav>

    <div v-if="authState.isGuest && !(isMobile && createVisible)" class="guest-banner">游客模式 · 正在浏览 admin 的旅行项目（只读）</div>

    <!-- 移动端：整页发起（不用弹窗） -->
    <main v-if="isMobile && createVisible" class="trips-main create-page">
      <CreateTripForm
        ref="createFormRef"
        v-bind="formBind"
        @home-input="onHomeInput"
        @pick-home="pickHome"
        @add-member="addMemberFromInput"
        @remove-member="(i) => members.splice(i, 1)"
        @add-quick="addQuick"
        @dest-input="onDestInput"
        @pick-dest="pickDest"
        @add-dest-query="addDestFromQuery"
        @remove-dest="removeDest"
        @focus-dest="focusDest"
        @transport-change="recalcDistance"
        @update:homeQuery="homeQuery = $event"
        @update:memberInput="memberInput = $event"
        @update:budgetTier="budgetTier = $event"
        @update:destQuery="destQuery = $event"
      />
      <div class="create-page-actions">
        <el-button size="large" round class="cancel-btn" @click="closeCreate">取消</el-button>
        <el-button type="primary" size="large" round class="submit-btn" @click="submit">发起旅行</el-button>
      </div>
    </main>

    <main v-show="!(isMobile && createVisible)" class="trips-main">
      <!-- 发起旅行 -->
      <section v-if="!authState.isGuest" class="card">
        <div class="card-title-row">
          <div class="card-title" style="margin-bottom: 0">✈️ 发起旅行</div>
          <el-button type="primary" round class="create-btn" @click="openCreate">+ 发起旅行</el-button>
        </div>
      </section>

      <!-- 同行人榜单（手绘插画风） -->
      <section v-if="companionBoard.length" class="companion-board">
        <div class="companion-board-head">
          <div>
            <h2 class="companion-board-title">同行小分队</h2>
            <p class="companion-board-sub">一起出发过的伙伴，按同行次数排排站</p>
          </div>
          <span class="companion-board-total">{{ companionBoard.length }} 人</span>
        </div>

        <div v-if="podiumCompanions.length" class="companion-podium">
          <div
            v-for="slot in podiumSlots"
            :key="slot.place"
            class="podium-card"
            :class="'place-' + slot.place"
            :style="{ '--delay': slot.place * 0.08 + 's' }"
          >
            <div class="podium-aura" aria-hidden="true"></div>
            <div class="podium-avatar">
              <div class="podium-avatar-clip">
                <img :src="animalIconFor(slot.item.name)" :alt="slot.item.name" draggable="false" />
              </div>
              <span class="podium-badge">{{ slot.item.n }}</span>
              <span
                class="podium-medal"
                :class="'medal-' + slot.place"
                :aria-label="slot.medalLabel"
              >
                <em class="medal-face">{{ slot.place }}</em>
              </span>
            </div>
            <div class="podium-place">{{ slot.ribbon }}</div>
            <div class="podium-name">{{ slot.item.name }}</div>
            <div class="podium-count">同行 {{ slot.item.n }} 次</div>
          </div>
        </div>

        <div v-if="restCompanions.length" class="companion-rest">
          <div
            v-for="(c, i) in shownRestCompanions"
            :key="c.name"
            class="companion-chip"
            :style="{ '--delay': (0.12 + i * 0.04) + 's' }"
          >
            <img class="chip-avatar" :src="animalIconFor(c.name)" :alt="c.name" draggable="false" />
            <span class="chip-rank">{{ i + podiumCompanions.length + 1 }}</span>
            <span class="chip-name">{{ c.name }}</span>
            <span class="chip-count">{{ c.n }} 次</span>
          </div>
          <button
            v-if="restCompanions.length > 3"
            type="button"
            class="companion-more"
            @click="companionExpanded = !companionExpanded"
          >
            {{ companionExpanded ? '收起小队' : `还有 ${restCompanions.length - 3} 位伙伴` }}
          </button>
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

    <!-- 桌面端：弹窗发起 -->
    <el-dialog
      v-if="!isMobile"
      v-model="createVisible"
      title="✈️ 发起旅行"
      width="880px"
      class="create-dialog"
      @opened="onCreateOpened"
      @closed="destroyPickerMap"
    >
      <CreateTripForm
        ref="createFormRef"
        v-bind="formBind"
        @home-input="onHomeInput"
        @pick-home="pickHome"
        @add-member="addMemberFromInput"
        @remove-member="(i) => members.splice(i, 1)"
        @add-quick="addQuick"
        @dest-input="onDestInput"
        @pick-dest="pickDest"
        @add-dest-query="addDestFromQuery"
        @remove-dest="removeDest"
        @focus-dest="focusDest"
        @transport-change="recalcDistance"
        @update:homeQuery="homeQuery = $event"
        @update:memberInput="memberInput = $event"
        @update:budgetTier="budgetTier = $event"
        @update:destQuery="destQuery = $event"
      />
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
import { celebrateConfetti } from '../confetti';
import { BUDGET_TIERS, calcBudget, budgetHint, tierByKey } from '../budget';
import { animalIconFor } from '../animals';
import CreateTripForm from '../components/CreateTripForm.vue';

const route = useRoute();
const router = useRouter();

const transports = ['驾车', '火车', '飞机', '骑行', '步行', '其他'];

// ---------- 状态 ----------
const profile = ref(null);
const homeQuery = ref('');
const homeResults = ref([]);
const homeShowResults = ref(false);

const companions = ref([]); // [{name, n}]
const companionExpanded = ref(false);

const trips = ref([]);
const yearOptions = ref([]);
const filterYear = ref('all');

const createVisible = ref(false);
const createFormRef = ref(null);
const isMobile = ref(typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches);
let mq;
function onMqChange(e) { isMobile.value = e.matches; }
const form = reactive({
  title: '',
  date: '',
  days: 3,
  transport: '驾车',
});
const budgetTier = ref('chill');
const members = ref([]);
const memberInput = ref('');

const destinations = ref([]); // [{name, lat, lng, country}]
const destQuery = ref('');
const destResults = ref([]);
const destShowResults = ref(false);
const activeDestIndex = ref(-1);
const destCoordText = ref('尚未添加地点');
const distanceHint = ref('');
let computedDistance = null;
let distanceToken = 0;

let pickerMap = null;
let originMarker = null;
let destMarkers = [];
let amapReady = false;

// ---------- 计算属性 ----------
const companionBoard = computed(() => companions.value.filter((c) => c.name !== '我'));
const podiumCompanions = computed(() => companionBoard.value.slice(0, 3));
const restCompanions = computed(() => companionBoard.value.slice(3));
const shownRestCompanions = computed(() =>
  companionExpanded.value ? restCompanions.value : restCompanions.value.slice(0, 3));
const podiumSlots = computed(() => {
  const list = podiumCompanions.value;
  const ribbons = { 1: '首席旅伴', 2: '常驻搭档', 3: '快乐跟班' };
  const medals = { 1: '金牌', 2: '银牌', 3: '铜牌' };
  // 满 3 人时用领奖台顺序 2 · 1 · 3；不足则按名次横排
  const order = list.length >= 3 ? [2, 1, 3] : list.map((_, i) => i + 1);
  return order
    .filter((place) => list[place - 1])
    .map((place) => ({
      place,
      item: list[place - 1],
      ribbon: ribbons[place],
      medalLabel: medals[place],
    }));
});
const quickPicks = computed(() =>
  companions.value.filter((c) => c.name !== '我' && !members.value.includes(c.name)));
const peopleCount = computed(() => 1 + members.value.length);
const estimatedBudget = computed(() =>
  calcBudget(peopleCount.value, form.days, tierByKey(budgetTier.value).rate));
const budgetCalcHint = computed(() =>
  budgetHint(peopleCount.value, form.days, tierByKey(budgetTier.value).rate));

const formBind = computed(() => ({
  form,
  transports,
  homeQuery: homeQuery.value,
  homeResults: homeResults.value,
  homeShowResults: homeShowResults.value,
  members: members.value,
  memberInput: memberInput.value,
  quickPicks: quickPicks.value,
  budgetTier: budgetTier.value,
  estimatedBudget: estimatedBudget.value,
  budgetCalcHint: budgetCalcHint.value,
  destinations: destinations.value,
  destQuery: destQuery.value,
  destResults: destResults.value,
  destShowResults: destShowResults.value,
  destCoordText: destCoordText.value,
  distanceHint: distanceHint.value,
  activeDestIndex: activeDestIndex.value,
}));

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

// ---------- 出发城市（发起弹窗内选择，选中即保存为常驻出发地） ----------
async function pickHome(c) {
  homeShowResults.value = false;
  homeQuery.value = c.name;
  try {
    profile.value = await put('/api/profile', { home_name: c.name, home_lat: c.lat, home_lng: c.lng });
    ElMessage.success(`出发城市已设为 ${c.name}`);
    // 地图已初始化时同步出发地标记并重算距离
    if (pickerMap && window.AMap) {
      if (originMarker) originMarker.setMap(null);
      originMarker = new AMap.Marker({
        position: [c.lng, c.lat],
        label: { content: '出发地', direction: 'top' },
      });
      originMarker.setMap(pickerMap);
      pickerMap.setCenter([c.lng, c.lat]);
    }
    recalcDistance();
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
function destroyPickerMap() {
  if (pickerMap) {
    pickerMap.destroy();
    pickerMap = null;
  }
  destMarkers = [];
  originMarker = null;
}

function clearDestMarkers() {
  destMarkers.forEach((m) => m.setMap(null));
  destMarkers = [];
}

function syncDestMarkers() {
  if (!pickerMap || !window.AMap) return;
  clearDestMarkers();
  const list = destinations.value;
  list.forEach((d, idx) => {
    const marker = new AMap.Marker({
      position: [d.lng, d.lat],
      draggable: true,
      title: d.name,
      label: { content: `${idx + 1}.${d.name}`, direction: 'top' },
    });
    marker.on('dragend', (e) => {
      destinations.value[idx] = {
        ...destinations.value[idx],
        lat: e.lnglat.getLat(),
        lng: e.lnglat.getLng(),
        country: destinations.value[idx].country || '未知',
      };
      updateDestCoordText();
      recalcDistance();
    });
    marker.on('click', () => { activeDestIndex.value = idx; });
    marker.setMap(pickerMap);
    destMarkers.push(marker);
  });
  if (list.length === 1) {
    pickerMap.setCenter([list[0].lng, list[0].lat]);
  } else if (list.length > 1) {
    pickerMap.setFitView(destMarkers, false, [40, 40, 40, 40]);
  }
}

function updateDestCoordText() {
  const n = destinations.value.length;
  destCoordText.value = n ? `已添加 ${n} 个地点（地图点选可继续添加）` : '尚未添加地点';
}

function sameDest(a, b) {
  return a.name === b.name
    && Math.abs(a.lat - b.lat) < 0.0001
    && Math.abs(a.lng - b.lng) < 0.0001;
}

function addDestination(d) {
  if (destinations.value.some((x) => sameDest(x, d))) {
    ElMessage.warning('该地点已添加');
    return;
  }
  if (destinations.value.length >= 20) {
    ElMessage.error('目的地最多 20 个');
    return;
  }
  destinations.value.push({
    name: d.name,
    lat: d.lat,
    lng: d.lng,
    country: d.country || '未知',
  });
  activeDestIndex.value = destinations.value.length - 1;
  updateDestCoordText();
  syncDestMarkers();
  recalcDistance();
}

function removeDest(idx) {
  destinations.value.splice(idx, 1);
  if (activeDestIndex.value >= destinations.value.length) {
    activeDestIndex.value = destinations.value.length - 1;
  }
  updateDestCoordText();
  syncDestMarkers();
  recalcDistance();
}

function focusDest(idx) {
  activeDestIndex.value = idx;
  const d = destinations.value[idx];
  if (d && pickerMap) pickerMap.setCenter([d.lng, d.lat]);
}

async function waitForMapEl(retries = 20) {
  for (let i = 0; i < retries; i++) {
    await nextTick();
    const exposed = createFormRef.value?.mapEl;
    const node = exposed && (exposed.value !== undefined ? exposed.value : exposed);
    if (node && node.clientWidth > 0) return node;
    await new Promise((r) => setTimeout(r, 40));
  }
  const exposed = createFormRef.value?.mapEl;
  return exposed && (exposed.value !== undefined ? exposed.value : exposed);
}

async function ensurePickerMap() {
  if (pickerMap) {
    pickerMap.resize();
    return;
  }
  if (!amapReady) {
    amapReady = await loadAmap(['AMap.Driving', 'AMap.Riding', 'AMap.Walking']);
  }
  if (!amapReady || !window.AMap) return;

  const node = await waitForMapEl();
  if (!node) return;

  // 移动端容器可能刚挂载，强制给足高度再初始化
  if (!node.style.height) {
    node.style.minHeight = isMobile.value ? '260px' : '320px';
  }

  const center = profile.value && profile.value.home_lat != null
    ? [profile.value.home_lng, profile.value.home_lat] : [105, 35];
  pickerMap = new AMap.Map(node, {
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
    const name = destQuery.value.trim() || `地图选点${destinations.value.length + 1}`;
    addDestination({
      name,
      lat: e.lnglat.getLat(),
      lng: e.lnglat.getLng(),
      country: '未知',
    });
    destQuery.value = '';
    destShowResults.value = false;
  });
  syncDestMarkers();
  requestAnimationFrame(() => {
    if (pickerMap) pickerMap.resize();
  });
  setTimeout(() => {
    if (pickerMap) pickerMap.resize();
  }, 200);
}

async function onCreateOpened() {
  destroyPickerMap();
  await ensurePickerMap();
}

function segmentDistance(from, to, transport) {
  return new Promise((resolve) => {
    const pluginMap = { '驾车': 'Driving', '骑行': 'Riding', '步行': 'Walking' };
    const plugin = pluginMap[transport];
    if (plugin && amapReady && window.AMap && window.AMap[plugin]) {
      const router2 = new window.AMap[plugin]();
      router2.search([from.lng, from.lat], [to.lng, to.lat], (status, result) => {
        if (status === 'complete' && result.routes && result.routes.length) {
          resolve({ km: result.routes[0].distance / 1000, routed: true });
        } else {
          resolve({ km: haversineKm(from, to), routed: false });
        }
      });
    } else {
      resolve({ km: haversineKm(from, to), routed: false });
    }
  });
}

async function recalcDistance() {
  const token = ++distanceToken;
  computedDistance = null;
  distanceHint.value = '';
  if (!destinations.value.length) return;
  const origin = profile.value && profile.value.home_lat != null
    ? { lat: profile.value.home_lat, lng: profile.value.home_lng } : null;
  if (!origin) {
    distanceHint.value = '未设置出发城市，无法自动计算距离';
    return;
  }
  distanceHint.value = '正在计算路线…';
  const points = [origin, ...destinations.value];
  let total = 0;
  let allRouted = true;
  for (let i = 0; i < points.length - 1; i++) {
    const seg = await segmentDistance(points[i], points[i + 1], form.transport);
    if (token !== distanceToken) return;
    total += seg.km;
    if (!seg.routed) allRouted = false;
  }
  computedDistance = Math.round(total * 10) / 10;
  const legs = destinations.value.length;
  const via = legs > 1 ? `（经 ${legs} 站）` : '';
  if (allRouted && ['驾车', '骑行', '步行'].includes(form.transport)) {
    distanceHint.value = `单程距离${via}：${form.transport}路线约 ${total.toFixed(1)} 公里`;
  } else {
    distanceHint.value = `单程距离${via}：约 ${total.toFixed(1)} 公里（含直线估算）`;
  }
}

function pickDest(c) {
  destShowResults.value = false;
  destQuery.value = '';
  addDestination({ name: c.name, lat: c.lat, lng: c.lng, country: c.country });
}

function addDestFromQuery() {
  const q = destQuery.value.trim();
  if (!q) return;
  if (destResults.value.length === 1) {
    pickDest(destResults.value[0]);
    return;
  }
  ElMessage.info('请从搜索结果中选择，或直接在地图上点选');
}

// ---------- 发起弹窗 ----------
function applyPrefillFromQuery() {
  const q = route.query;
  if (!q.dest) return;
  const name = String(q.dest);
  const lat = Number(q.lat);
  const lng = Number(q.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    addDestination({
      name,
      lat,
      lng,
      country: q.country ? String(q.country) : '未知',
    });
  }
  if (!form.title.trim()) form.title = `${name}之行`;
  router.replace({ path: '/trips/new' });
}

async function openCreate() {
  createVisible.value = true;
  if (!form.date) form.date = today();
  homeQuery.value = (profile.value && profile.value.home_name) || '';
  if (!route.query.dest) {
    // 保留当前未提交的选点；仅从「再记一次」带 query 时覆盖
  } else {
    destinations.value = [];
    activeDestIndex.value = -1;
    updateDestCoordText();
  }
  applyPrefillFromQuery();
  if (isMobile.value) {
    if (route.path !== '/trips/new') router.replace({ path: '/trips/new' });
    // 等整页表单挂载后再初始化地图（多等一帧，避免容器宽高为 0）
    await nextTick();
    setTimeout(() => { onCreateOpened(); }, 80);
  }
}

function closeCreate() {
  createVisible.value = false;
  destroyPickerMap();
  if (route.path === '/trips/new') router.replace('/trips');
}

async function submit() {
  const title = form.title.trim();
  if (!title) return ElMessage.error('请填写旅行项目名');
  if (!form.date) return ElMessage.error('请选择出发时间');
  const days = parseInt(form.days, 10);
  if (!days || days < 1) return ElMessage.error('请填写旅行天数');
  if (!destinations.value.length) return ElMessage.error('请至少添加一个目的地');
  const body = {
    title,
    destinations: destinations.value.map((d) => ({
      name: d.name,
      lat: d.lat,
      lng: d.lng,
      country: d.country,
    })),
    depart_date: form.date,
    days,
    transport: form.transport,
    distance_km: computedDistance,
    budget: estimatedBudget.value,
    members: ['我', ...members.value],
  };
  try {
    const trip = await post('/api/trips', body);
    createVisible.value = false;
    destroyPickerMap();
    celebrateConfetti({ duration: 2400, count: 140 });
    ElMessage.success('旅行项目已创建，出发啦！');
    setTimeout(() => {
      router.push(`/trip/${trip.id}`);
    }, 450);
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
  mq = window.matchMedia('(max-width: 768px)');
  mq.addEventListener('change', onMqChange);
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
  if (mq) mq.removeEventListener('change', onMqChange);
  document.removeEventListener('click', onDocClick);
});
</script>

<style scoped>
.trips-page { min-height: 100vh; min-height: 100dvh; }

.top-nav {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  background: rgba(255, 253, 247, 0.88); backdrop-filter: blur(8px);
  border-bottom: 2px solid #ffffff; box-shadow: 0 4px 16px rgba(74, 64, 57, 0.06);
  padding: 12px 24px;
  padding-top: calc(12px + var(--safe-top));
  position: sticky; top: 0; z-index: 800;
}
.top-nav-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
.nav-link { color: #E76F51; font-weight: 600; text-decoration: none; font-size: 14px; white-space: nowrap; }
.nav-link:hover { text-decoration: underline; }
.nav-title { font-size: 19px; font-weight: 700; color: var(--brand-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-info { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.guestbook-link { font-size: 13px; }
.current-user {
  background: #fff; border: 1px solid var(--brand-line); border-radius: 999px;
  padding: 4px 14px; font-size: 13px; font-weight: 600; color: var(--brand-sub);
  max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.user-link { cursor: pointer; }
.user-link:hover { color: #E76F51; border-color: var(--el-color-primary-light-7); }

.guest-banner {
  margin: 12px 24px 0;
  background: #fef3c7; color: #92400e;
  border: 1px solid #fde68a; border-radius: 8px;
  padding: 8px 12px; font-size: 13px;
}

.trips-main { max-width: 860px; margin: 0 auto; padding: 20px 16px calc(60px + var(--safe-bottom)); }

.card {
  background: var(--brand-cream); border: 2px solid #ffffff; border-radius: 20px;
  box-shadow: 0 10px 30px rgba(74, 64, 57, 0.08);
  padding: 22px 24px; margin-bottom: 16px;
}
.card-title { font-size: 19px; font-weight: 700; color: var(--brand-ink); margin-bottom: 12px; }
.card-title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }

/* 搜索下拉 */
.search-box { position: relative; }
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

/* 同行人榜单 · 手绘插画风 */
.companion-board {
  position: relative;
  overflow: hidden;
  margin-bottom: 16px;
  padding: 22px 20px 18px;
  border-radius: 24px;
  border: 2.5px dashed #E8D4B0;
  background:
    radial-gradient(ellipse 80% 50% at 12% 0%, rgba(255, 214, 170, 0.45), transparent 55%),
    radial-gradient(ellipse 70% 45% at 92% 8%, rgba(186, 220, 240, 0.4), transparent 50%),
    linear-gradient(165deg, #FFF9EE 0%, #FDF3E0 48%, #F7EBD2 100%);
  box-shadow: 0 12px 28px rgba(74, 64, 57, 0.08);
}
.companion-board::before {
  content: '';
  position: absolute; inset: 10px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  pointer-events: none;
}
.companion-board-head {
  position: relative;
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 12px; margin-bottom: 18px;
}
.companion-board-title {
  margin: 0;
  font-family: 'KaiTi', 'STKaiti', 'Songti SC', 'PingFang SC', serif;
  font-size: 26px; font-weight: 700; color: #5C4A3A;
  letter-spacing: 0.04em;
}
.companion-board-sub {
  margin: 6px 0 0;
  font-size: 13px; color: #9A8468; line-height: 1.4;
}
.companion-board-total {
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: 999px;
  background: #FFFDF8;
  border: 1.5px solid #EFD9B0;
  color: #A5700B;
  font-size: 13px; font-weight: 700;
  box-shadow: 0 2px 0 #F5E6C8;
}

.companion-podium {
  position: relative;
  display: flex; align-items: flex-end; justify-content: center;
  gap: 10px; margin-bottom: 14px; min-height: 168px;
}
.podium-card {
  position: relative;
  flex: 1; max-width: 150px;
  display: flex; flex-direction: column; align-items: center;
  text-align: center;
  padding: 14px 10px 12px;
  border-radius: 22px 22px 16px 16px;
  background: rgba(255, 253, 247, 0.88);
  border: 2px solid #fff;
  box-shadow: 0 8px 18px rgba(74, 64, 57, 0.1);
  animation: companion-rise 0.55s ease both;
  animation-delay: var(--delay, 0s);
}
.podium-card.place-1 {
  order: 2; z-index: 2;
  padding-top: 18px; padding-bottom: 16px;
  transform: translateY(-10px);
  background: linear-gradient(180deg, #FFF8EC, #FFE8C4);
  border-color: #F4C97A;
  box-shadow: 0 12px 24px rgba(196, 140, 40, 0.18);
}
.podium-card.place-2 { order: 1; }
.podium-card.place-3 { order: 3; }
.podium-aura {
  position: absolute; top: 8px; left: 50%;
  width: 72px; height: 72px; margin-left: -36px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(244, 162, 97, 0.28), transparent 70%);
  pointer-events: none;
}
.podium-card.place-1 .podium-aura {
  width: 88px; height: 88px; margin-left: -44px; top: 6px;
  background: radial-gradient(circle, rgba(244, 201, 122, 0.45), transparent 70%);
}
.podium-avatar {
  position: relative; z-index: 1;
  width: 64px; height: 64px;
  margin-bottom: 10px;
}
.podium-card.place-1 .podium-avatar { width: 78px; height: 78px; }
.podium-avatar-clip {
  width: 100%; height: 100%;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 0 0 3px #fff, 0 4px 10px rgba(74, 64, 57, 0.16);
}
.podium-avatar-clip img {
  display: block; width: 100%; height: 100%;
  object-fit: cover; object-position: center center;
  border-radius: 50%;
  background: #FFFDF8;
  animation: companion-bob 3.2s ease-in-out infinite;
  animation-delay: var(--delay, 0s);
}
.podium-badge {
  position: absolute; top: -4px; right: -6px;
  min-width: 20px; height: 20px; padding: 0 5px;
  border-radius: 999px; border: 2px solid #fff;
  background: #E76F51; color: #fff;
  font-size: 10px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 6px rgba(231, 111, 81, 0.35);
  z-index: 2;
}

/* 金银铜奖牌 · 3D */
.podium-medal {
  position: absolute;
  right: -8px; bottom: -6px;
  width: 30px; height: 30px;
  border-radius: 50%;
  z-index: 3;
  display: flex; align-items: center; justify-content: center;
  transform: perspective(80px) rotateX(18deg);
  filter: drop-shadow(0 4px 3px rgba(74, 64, 57, 0.35));
}
.podium-medal::before {
  content: '';
  position: absolute; inset: 0;
  border-radius: 50%;
  box-shadow:
    inset 0 3px 4px rgba(255, 255, 255, 0.75),
    inset 0 -4px 5px rgba(0, 0, 0, 0.28),
    inset 2px 0 3px rgba(255, 255, 255, 0.35),
    0 0 0 2px rgba(255, 255, 255, 0.55);
  pointer-events: none;
}
.podium-medal::after {
  content: '';
  position: absolute;
  top: 4px; left: 6px;
  width: 10px; height: 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0));
  transform: rotate(-20deg);
  pointer-events: none;
}
.medal-face {
  position: relative; z-index: 1;
  font-style: normal;
  font-size: 13px; font-weight: 900;
  line-height: 1;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.45), 0 -1px 0 rgba(0, 0, 0, 0.2);
}
.medal-1 {
  background:
    radial-gradient(circle at 32% 28%, #FFF8C8 0%, #FFE066 32%, #F5B800 62%, #C48900 100%);
  border: 1.5px solid #A87200;
}
.medal-1 .medal-face { color: #7A5200; }
.medal-2 {
  background:
    radial-gradient(circle at 32% 28%, #FFFFFF 0%, #E8E8E8 32%, #B8B8B8 62%, #8A8A8A 100%);
  border: 1.5px solid #6E6E6E;
}
.medal-2 .medal-face { color: #4A4A4A; }
.medal-3 {
  background:
    radial-gradient(circle at 32% 28%, #FFE0C2 0%, #E8A06A 32%, #C67B3A 62%, #8B4A22 100%);
  border: 1.5px solid #6B3418;
}
.medal-3 .medal-face { color: #5C2E12; }
.podium-card.place-1 .podium-medal {
  width: 34px; height: 34px; right: -10px; bottom: -8px;
}
.podium-card.place-1 .medal-face { font-size: 15px; }
.podium-place {
  font-size: 11px; font-weight: 700; color: #C48C28;
  letter-spacing: 0.06em; margin-bottom: 2px;
}
.podium-card.place-1 .podium-place { color: #D95F41; font-size: 12px; }
.podium-name {
  font-size: 15px; font-weight: 700; color: var(--brand-ink);
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.podium-card.place-1 .podium-name { font-size: 17px; }
.podium-count { margin-top: 2px; font-size: 12px; color: #9A8468; }

.companion-rest {
  position: relative;
  display: flex; flex-direction: column; gap: 8px;
  padding-top: 4px;
}
.companion-chip {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px;
  border-radius: 16px;
  background: rgba(255, 253, 247, 0.92);
  border: 1.5px solid #F0E2C8;
  box-shadow: 0 2px 0 #F5EBDA;
  animation: companion-rise 0.45s ease both;
  animation-delay: var(--delay, 0s);
}
.chip-avatar {
  width: 36px; height: 36px; flex-shrink: 0;
  object-fit: cover; object-position: center center; border-radius: 50%;
  background: #FFFDF8;
  box-shadow: 0 0 0 2px #fff, 0 2px 5px rgba(74, 64, 57, 0.12);
}
.chip-rank {
  width: 22px; text-align: center;
  font-size: 12px; font-weight: 800; color: #C4A882;
}
.chip-name { font-weight: 700; color: var(--brand-ink); min-width: 0; }
.chip-count { margin-left: auto; font-size: 13px; color: #9A8468; font-weight: 600; }
.companion-more {
  align-self: center;
  margin-top: 4px;
  border: none; background: transparent;
  color: #C48C28; font-size: 13px; font-weight: 700;
  cursor: pointer; padding: 6px 12px;
  border-radius: 999px;
}
.companion-more:hover { background: rgba(255, 248, 236, 0.9); color: #D95F41; }

@keyframes companion-rise {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes companion-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@media (prefers-reduced-motion: reduce) {
  .podium-card, .companion-chip, .podium-avatar-clip img { animation: none; }
  .podium-card.place-1 { transform: none; }
}

/* 列表头 + 项目卡片 */
.list-head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  margin: 20px 2px 12px; flex-wrap: wrap;
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
.trip-card-title { font-size: 17px; font-weight: 700; color: var(--brand-ink); min-width: 0; }
.trip-card-dest {
  color: #D95F41; font-size: 14px; font-weight: 600; flex-shrink: 1;
  text-align: right; max-width: 55%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.trip-card-meta { color: var(--brand-sub); font-size: 13px; margin-top: 6px; }

.create-btn {
  font-weight: 700; letter-spacing: 1px;
  box-shadow: 0 4px 12px rgba(231, 111, 81, 0.35);
}
.submit-btn { font-weight: 700; letter-spacing: 1px; box-shadow: 0 4px 12px rgba(231, 111, 81, 0.3); }

.create-page-actions {
  display: flex; gap: 12px; margin-top: 16px;
  position: sticky; bottom: 0;
  padding: 14px 0 calc(14px + var(--safe-bottom));
  background: linear-gradient(180deg, transparent, var(--brand-cream) 28%);
  z-index: 20;
}
.create-page {
  padding-bottom: calc(24px + var(--safe-bottom));
}
.create-page :deep(.picker-map) {
  /* 避免被底部操作栏挡住时误以为地图没出来 */
  scroll-margin-bottom: 88px;
}
.create-page-actions .el-button {
  flex: 1;
  min-height: 48px;
  font-size: 16px;
  font-weight: 700;
}
.create-page-actions .cancel-btn {
  border-width: 2px;
  border-color: #E8D4B0;
  color: var(--brand-ink);
  background: #FFFDF8;
}

@media (max-width: 768px) {
  .top-nav { padding: 10px 12px; padding-top: calc(10px + var(--safe-top)); }
  .nav-title { font-size: 16px; }
  .guest-banner { margin: 10px 12px 0; }
  .trips-main { padding: 14px 12px calc(40px + var(--safe-bottom)); }
  .card { padding: 16px; border-radius: 16px; }
  .card-title { font-size: 17px; }
  .companion-board { padding: 18px 14px 14px; border-radius: 20px; }
  .companion-board-title { font-size: 22px; }
  .companion-podium { gap: 6px; min-height: 150px; }
  .podium-card { padding: 10px 6px 10px; border-radius: 18px 18px 14px 14px; }
  .podium-avatar { width: 52px; height: 52px; }
  .podium-card.place-1 .podium-avatar { width: 64px; height: 64px; }
  .podium-medal { width: 26px; height: 26px; right: -6px; bottom: -4px; }
  .podium-card.place-1 .podium-medal { width: 28px; height: 28px; }
  .medal-face { font-size: 11px; }
  .podium-card.place-1 .medal-face { font-size: 12px; }
  .podium-name { font-size: 13px; }
  .podium-card.place-1 .podium-name { font-size: 15px; }
  .podium-place { font-size: 10px; }
  .trips-list { grid-template-columns: 1fr; gap: 10px; }
  .trip-card-title { font-size: 16px; }
  .create-btn, .submit-btn { width: 100%; }
}
</style>
