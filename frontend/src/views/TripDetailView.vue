<template>
  <div class="trip-detail">
    <!-- 顶部导航 -->
    <nav class="top-nav">
      <template v-if="isMobile && editVisible">
        <div class="top-nav-left">
          <a href="#" class="nav-link" @click.prevent="closeEdit">← 返回</a>
          <span class="nav-title">编辑项目</span>
        </div>
      </template>
      <template v-else>
        <div class="top-nav-left">
          <router-link to="/trips" class="nav-link">← 旅行项目</router-link>
          <span class="nav-title">{{ trip ? trip.title : '旅行详情' }}</span>
        </div>
        <div class="user-info">
          <span class="user-capsule user-link" title="编辑个人资料" @click="router.push('/profile')">{{ authState.isGuest ? '游客' : authState.username }}</span>
          <el-button size="small" @click="logout">退出</el-button>
        </div>
      </template>
    </nav>

    <!-- 游客只读横幅 -->
    <div v-if="authState.isGuest && !(isMobile && editVisible)" class="guest-banner">游客模式 · 正在浏览 admin 的旅行项目（只读）</div>

    <!-- 移动端：整页编辑（不用弹窗） -->
    <main v-if="isMobile && editVisible" class="page-main edit-page">
      <CreateTripForm
        ref="editFormRef"
        v-bind="editFormBind"
        @home-input="onEditHomeInput"
        @pick-home="pickEditHome"
        @add-member="addEditMember"
        @remove-member="(i) => editMembers.splice(i, 1)"
        @add-quick="addEditQuick"
        @dest-input="onEditDestInput"
        @pick-dest="pickEditDest"
        @add-dest-query="addEditDestFromQuery"
        @remove-dest="removeEditDest"
        @focus-dest="focusEditDest"
        @transport-change="recalcEditDistance"
        @update:homeQuery="editHomeQuery = $event"
        @update:memberInput="editMemberInput = $event"
        @update:budgetTier="editBudgetTier = $event"
        @update:destQuery="editDestQuery = $event"
      />
      <div class="edit-page-actions">
        <el-button size="large" round class="cancel-btn" @click="closeEdit">取消</el-button>
        <el-button type="primary" size="large" round class="submit-btn" :loading="editSaving" @click="saveEdit">保存</el-button>
      </div>
    </main>

    <main v-if="trip" v-show="!(isMobile && editVisible)" class="page-main">
      <!-- ① 基本信息 -->
      <el-card class="block-card" shadow="never">
        <template #header>
          <div class="card-title-row">
            <span class="card-title">基本信息</span>
            <div v-if="!authState.isGuest" class="card-actions">
              <el-button size="small" @click="openEdit">编辑</el-button>
              <el-button size="small" type="danger" plain @click="removeTrip">删除项目</el-button>
            </div>
          </div>
        </template>
        <div class="info-grid">
          <div class="info-item"><span>出发地</span><strong>{{ trip.origin_name || '未设置' }}</strong></div>
          <div class="info-item"><span>目的地</span><strong>{{ destDisplay }}</strong></div>
          <div class="info-item"><span>出发时间</span><strong>{{ trip.depart_date }}</strong></div>
          <div class="info-item"><span>旅行天数</span><strong>{{ trip.days }} 天</strong></div>
          <div class="info-item"><span>出行方式</span><strong>{{ trip.transport }}</strong></div>
          <div class="info-item"><span>单程距离</span><strong>{{ trip.distance_km != null ? trip.distance_km + ' km' : '未知' }}</strong></div>
          <div class="info-item"><span>预算</span><strong>{{ budgetDisplay }}</strong></div>
          <div class="info-item"><span>已花费</span><strong>{{ fmt(trip.settlement.total) }}</strong></div>
        </div>
      </el-card>

      <!-- ② 同行人（与发起项目同一套逻辑：我默认同行 + 常客快选 + 回车添加） -->
      <el-card class="block-card" shadow="never">
        <template #header><span class="card-title">同行人</span></template>
        <template v-if="!authState.isGuest">
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
            <el-tag round class="member-tag me-tag">我</el-tag>
            <el-tag
              v-for="m in otherMembers"
              :key="m.id"
              closable
              round
              class="member-tag"
              :disable-transitions="true"
              @close="removeMember(m)"
            >{{ m.name }}</el-tag>
            <input
              v-model="memberInput"
              type="text"
              placeholder="输入名字后回车"
              maxlength="20"
              @keydown.enter.prevent="addMember"
            >
          </div>
        </template>
        <div v-else class="member-list">
          <el-tag v-for="m in trip.members" :key="m.id" size="large" :disable-transitions="true">{{ m.name }}</el-tag>
        </div>
      </el-card>

      <!-- ③ 花费与分摊 -->
      <el-card class="block-card" shadow="never">
        <template #header><span class="card-title">花费与分摊</span></template>

        <template v-if="trip.members.length">
          <div class="settle-summary">
            <div class="stat-card"><div class="stat-num">{{ fmt(trip.settlement.total) }}</div><div class="stat-label">总花费</div></div>
            <div class="stat-card"><div class="stat-num">{{ fmt(trip.settlement.perPerson) }}</div><div class="stat-label">人均</div></div>
            <div class="stat-card"><div class="stat-num">{{ trip.budget != null ? fmt(trip.budget) : '—' }}</div><div class="stat-label">预算{{ budgetTierLabel ? '·' + budgetTierLabel : '' }}</div></div>
          </div>
          <el-table :data="trip.settlement.balances" size="small" class="settle-table">
            <el-table-column prop="name" label="成员" />
            <el-table-column label="已付">
              <template #default="{ row }">{{ fmt(row.paid) }}</template>
            </el-table-column>
            <el-table-column label="应付">
              <template #default="{ row }">{{ fmt(row.share) }}</template>
            </el-table-column>
            <el-table-column label="差额">
              <template #default="{ row }">
                <span :class="row.balance >= 0 ? 'pos' : 'neg'">{{ row.balance >= 0 ? '+' : '' }}{{ row.balance.toFixed(2) }}</span>
              </template>
            </el-table-column>
          </el-table>
          <div class="settle-transfers">
            <div class="transfer-head">
              <div>
                <div class="transfer-title">转账建议</div>
                <p class="transfer-sub">谁该补给谁，一眼算清</p>
              </div>
              <span v-if="trip.settlement.transfers.length" class="transfer-count">
                {{ trip.settlement.transfers.length }} 笔
              </span>
            </div>

            <div v-if="trip.settlement.transfers.length" class="transfer-list">
              <div
                v-for="(t, i) in trip.settlement.transfers"
                :key="i"
                class="transfer-card"
                :style="{ '--delay': (i * 0.06) + 's' }"
              >
                <div class="transfer-who">
                  <div class="transfer-person from">
                    <img class="transfer-avatar" :src="animalIconFor(t.from)" :alt="t.from" draggable="false" />
                    <span class="transfer-name">{{ t.from }}</span>
                    <em>应付</em>
                  </div>
                  <div class="transfer-flow" aria-hidden="true">
                    <span class="transfer-arrow-line"></span>
                    <span class="transfer-arrow-tip">→</span>
                  </div>
                  <div class="transfer-person to">
                    <img class="transfer-avatar" :src="animalIconFor(t.to)" :alt="t.to" draggable="false" />
                    <span class="transfer-name">{{ t.to }}</span>
                    <em>应收</em>
                  </div>
                </div>
                <div class="transfer-amount">
                  <span class="transfer-amount-label">转账</span>
                  <strong>{{ fmt(t.amount) }}</strong>
                </div>
              </div>
            </div>
            <div v-else class="transfer-empty">
              <span class="transfer-empty-icon" aria-hidden="true">✓</span>
              <div>
                <strong>账目刚好平了</strong>
                <p>当前无需互相转账</p>
              </div>
            </div>
          </div>
        </template>

        <el-table :data="trip.expenses" size="small" class="expense-table">
          <el-table-column prop="payer" label="付款人" width="100" />
          <el-table-column label="金额" width="110">
            <template #default="{ row }">{{ fmt(row.amount) }}</template>
          </el-table-column>
          <el-table-column prop="category" label="分类" width="90">
            <template #default="{ row }">{{ row.category || '' }}</template>
          </el-table-column>
          <el-table-column prop="note" label="备注" show-overflow-tooltip>
            <template #default="{ row }">{{ row.note || '' }}</template>
          </el-table-column>
          <el-table-column prop="spent_at" label="日期" width="110" />
          <el-table-column v-if="!authState.isGuest" label="" width="70" align="center">
            <template #default="{ row }">
              <el-button size="small" type="danger" link @click="removeExpense(row)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty>还没有花费记录</template>
        </el-table>

        <div v-if="!authState.isGuest" class="inline-add-form">
          <el-select v-model="xPayer" placeholder="付款人" style="width: 110px">
            <el-option v-for="m in trip.members" :key="m.id" :label="m.name" :value="m.name" />
          </el-select>
          <el-input v-model="xAmount" type="number" placeholder="金额" min="0" step="0.01" style="width: 110px" />
          <el-select v-model="xCategory" style="width: 100px">
            <el-option v-for="c in CATEGORIES" :key="c" :label="c" :value="c" />
          </el-select>
          <el-input v-model="xNote" placeholder="备注（可选）" maxlength="50" style="width: 160px" />
          <el-date-picker v-model="xDate" type="date" value-format="YYYY-MM-DD" style="width: 150px" />
          <el-button size="small" type="primary" @click="addExpense">记一笔</el-button>
        </div>
      </el-card>

      <!-- ④ 具体行程 -->
      <el-card class="block-card" shadow="never">
        <template #header>
          <div class="card-title-row">
            <span class="card-title">具体行程</span>
            <el-button
              v-if="!authState.isGuest"
              size="small"
              type="primary"
              :loading="aiLoading"
              :disabled="aiLoading"
              @click="generateAi"
            >{{ aiLoading ? '生成中…' : '✨ AI 生成行程' }}</el-button>
          </div>
        </template>

        <!-- AI 预览（未保存） -->
        <div v-if="aiItems.length" class="ai-preview">
          <div class="ai-preview-title">AI 生成的行程预览（未保存）</div>
          <div v-for="g in aiByDay" :key="g.day" class="day-block">
            <div class="day-title">第 {{ g.day }} 天</div>
            <div v-for="(it, i) in g.items" :key="i" class="ai-row">{{ it.content }}</div>
          </div>
          <div class="ai-actions">
            <el-button size="small" @click="cancelAi">取消</el-button>
            <el-button size="small" :disabled="aiLoading" @click="generateAi">↻ 重新生成</el-button>
            <el-button size="small" type="primary" @click="adoptAi">采用行程</el-button>
          </div>
        </div>

        <div v-if="!trip.itinerary.length" class="visit-none">还没有填写行程</div>
        <template v-else>
          <div v-for="g in itineraryByDay" :key="g.day" class="day-block">
            <div class="day-title">第 {{ g.day }} 天</div>
            <div v-for="it in g.items" :key="it.id" class="it-row">
              <span class="it-content">{{ it.content }}</span>
              <el-button v-if="!authState.isGuest" size="small" type="danger" link @click="removeItinerary(it)">✕</el-button>
            </div>
          </div>
        </template>

        <div v-if="!authState.isGuest" class="inline-add-form itinerary-add-form">
          <el-select v-model="itDay" class="it-day-select" style="width: 110px">
            <el-option v-for="d in dayOptions" :key="d" :label="`第 ${d} 天`" :value="d" />
          </el-select>
          <el-input
            v-model="itContent"
            class="it-content-input"
            placeholder="行程内容，如：上午 西湖游船"
            maxlength="200"
            style="flex: 1"
            @keyup.enter="addItinerary"
          />
          <el-button size="small" type="primary" class="it-add-btn" @click="addItinerary">添加</el-button>
        </div>
      </el-card>

      <!-- ⑤ 照片墙 -->
      <el-card class="block-card" shadow="never">
        <template #header>
          <div class="card-title-row">
            <span class="card-title">照片墙</span>
            <el-upload
              v-if="!authState.isGuest"
              multiple
              :show-file-list="false"
              accept="image/jpeg,image/png,image/webp,image/gif"
              :before-upload="beforePhotoUpload"
              :http-request="uploadPhoto"
            >
              <el-button size="small" type="primary" :loading="uploadingCount > 0">
                {{ uploadingCount > 0 ? '上传中…' : '上传照片' }}
              </el-button>
            </el-upload>
          </div>
        </template>
        <div v-if="!trip.photos.length" class="empty-state">还没有照片，上传旅途中的精彩瞬间吧</div>
        <div v-else class="photo-wall">
          <div v-for="(p, idx) in trip.photos" :key="p.id" class="photo-cell">
            <img :src="photoUrl(p)" :alt="p.original_name || '照片'" loading="lazy" @click="openViewer(idx)">
            <button v-if="!authState.isGuest" class="photo-del" title="删除" @click.stop="removePhoto(p)">×</button>
          </div>
        </div>
      </el-card>
    </main>

    <main v-else-if="loadError" class="page-main">
      <div class="empty-state">旅行项目不存在或无权访问</div>
    </main>

    <!-- 桌面端：弹窗编辑 -->
    <el-dialog
      v-if="!isMobile"
      v-model="editVisible"
      title="编辑项目"
      width="880px"
      class="edit-dialog"
      @opened="onEditOpened"
      @closed="destroyEditMap"
    >
      <CreateTripForm
        ref="editFormRef"
        v-bind="editFormBind"
        @home-input="onEditHomeInput"
        @pick-home="pickEditHome"
        @add-member="addEditMember"
        @remove-member="(i) => editMembers.splice(i, 1)"
        @add-quick="addEditQuick"
        @dest-input="onEditDestInput"
        @pick-dest="pickEditDest"
        @add-dest-query="addEditDestFromQuery"
        @remove-dest="removeEditDest"
        @focus-dest="focusEditDest"
        @transport-change="recalcEditDistance"
        @update:homeQuery="editHomeQuery = $event"
        @update:memberInput="editMemberInput = $event"
        @update:budgetTier="editBudgetTier = $event"
        @update:destQuery="editDestQuery = $event"
      />
      <template #footer>
        <el-button size="large" round @click="closeEdit">取消</el-button>
        <el-button type="primary" size="large" round :loading="editSaving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 照片大图查看 -->
    <el-image-viewer
      v-if="viewerVisible"
      :url-list="photoUrls"
      :initial-index="viewerIndex"
      @close="viewerVisible = false"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { get, post, put, del } from '../api';
import { loadAmap, haversineKm } from '../amap';
import { authState, fetchMe, logout } from '../auth';
import { calcBudget, budgetHint, matchTierKey, tierByKey } from '../budget';
import { animalIconFor } from '../animals';
import CreateTripForm from '../components/CreateTripForm.vue';

const route = useRoute();
const router = useRouter();
const tripId = Number(route.params.id);

const TRANSPORTS = ['驾车', '火车', '飞机', '骑行', '步行', '其他'];
const CATEGORIES = ['餐饮', '住宿', '交通', '门票', '购物', '其他'];

const trip = ref(null);
const loadError = ref(false);
const companions = ref([]); // [{name, n}]

// ---------- 工具 ----------
function fmt(n) { return '¥' + Number(n).toFixed(2); }

const budgetDisplay = computed(() => {
  if (!trip.value || trip.value.budget == null) return '未设';
  const people = trip.value.members?.length || 1;
  const tier = tierByKey(matchTierKey(trip.value.budget, people, trip.value.days));
  return `${fmt(trip.value.budget)} · ${tier.label}`;
});
const destDisplay = computed(() => {
  if (!trip.value) return '';
  const list = trip.value.destinations;
  if (list && list.length) return list.map((d) => d.name).join(' · ');
  return trip.value.dest_name;
});
const budgetTierLabel = computed(() => {
  if (!trip.value || trip.value.budget == null) return '';
  const people = trip.value.members?.length || 1;
  return tierByKey(matchTierKey(trip.value.budget, people, trip.value.days)).label;
});

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------- 基本信息编辑（复用新建表单模版） ----------
const editVisible = ref(false);
const isMobile = ref(typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches);
let mq;
function onMqChange(e) { isMobile.value = e.matches; }
const editSaving = ref(false);
const editFormRef = ref(null);
const editForm = reactive({
  title: '', date: '', days: 1, transport: '驾车',
});
const editHomeQuery = ref('');
const editHomeResults = ref([]);
const editHomeShowResults = ref(false);
const editMembers = ref([]);
const editMemberInput = ref('');
const editDestinations = ref([]);
const editDestQuery = ref('');
const editDestResults = ref([]);
const editDestShowResults = ref(false);
const editActiveDestIndex = ref(-1);
const editBudgetTier = ref('chill');
const editCoordText = ref('尚未添加地点');
const editDistanceHint = ref('');
let editComputedDistance = null;
let editDistanceToken = 0;
let editMap = null;
let editOriginMarker = null;
let editDestMarkers = [];
let amapReady = false;
let editProfile = null; // { home_name, home_lat, home_lng }

const editPeopleCount = computed(() => 1 + editMembers.value.length);
const editEstimatedBudget = computed(() =>
  calcBudget(editPeopleCount.value, editForm.days, tierByKey(editBudgetTier.value).rate));
const editBudgetHintText = computed(() =>
  budgetHint(editPeopleCount.value, editForm.days, tierByKey(editBudgetTier.value).rate));
const editQuickPicks = computed(() =>
  companions.value.filter((c) => c.name !== '我' && !editMembers.value.includes(c.name)));

const editFormBind = computed(() => ({
  form: editForm,
  transports: TRANSPORTS,
  homeQuery: editHomeQuery.value,
  homeResults: editHomeResults.value,
  homeShowResults: editHomeShowResults.value,
  members: editMembers.value,
  memberInput: editMemberInput.value,
  quickPicks: editQuickPicks.value,
  budgetTier: editBudgetTier.value,
  estimatedBudget: editEstimatedBudget.value,
  budgetCalcHint: editBudgetHintText.value,
  destinations: editDestinations.value,
  destQuery: editDestQuery.value,
  destResults: editDestResults.value,
  destShowResults: editDestShowResults.value,
  destCoordText: editCoordText.value,
  distanceHint: editDistanceHint.value,
  activeDestIndex: editActiveDestIndex.value,
}));

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
    .catch(() => {});
}

const doEditHomeSearch = debounce((q) => searchCities(q, editHomeResults, editHomeShowResults), 300);
const doEditDestSearch = debounce((q) => searchCities(q, editDestResults, editDestShowResults), 300);

function onEditHomeInput(v) {
  const q = (v || '').trim();
  if (!q) { editHomeShowResults.value = false; return; }
  doEditHomeSearch(q);
}

function onEditDestInput(v) {
  const q = (v || '').trim();
  if (!q) { editDestShowResults.value = false; return; }
  doEditDestSearch(q);
}

async function pickEditHome(c) {
  editHomeShowResults.value = false;
  editHomeQuery.value = c.name;
  try {
    editProfile = await put('/api/profile', { home_name: c.name, home_lat: c.lat, home_lng: c.lng });
    ElMessage.success(`出发城市已设为 ${c.name}`);
    if (editMap && window.AMap) {
      if (editOriginMarker) editOriginMarker.setMap(null);
      editOriginMarker = new AMap.Marker({
        position: [c.lng, c.lat],
        label: { content: '出发地', direction: 'top' },
      });
      editOriginMarker.setMap(editMap);
    }
    recalcEditDistance();
  } catch (_) { /* 已提示 */ }
}

function addEditMember() {
  const name = editMemberInput.value.trim();
  editMemberInput.value = '';
  if (!name) return;
  if (name === '我') { ElMessage.warning('我默认同行，无需添加'); return; }
  if (editMembers.value.includes(name)) { ElMessage.error('该成员已添加'); return; }
  editMembers.value.push(name);
}

function addEditQuick(name) {
  if (!editMembers.value.includes(name)) editMembers.value.push(name);
}

function updateEditDestText() {
  const n = editDestinations.value.length;
  editCoordText.value = n ? `已添加 ${n} 个地点（地图点选可继续添加）` : '尚未添加地点';
}

function sameDest(a, b) {
  return a.name === b.name
    && Math.abs(a.lat - b.lat) < 0.0001
    && Math.abs(a.lng - b.lng) < 0.0001;
}

function addEditDest(d) {
  if (editDestinations.value.some((x) => sameDest(x, d))) {
    ElMessage.warning('该地点已添加');
    return;
  }
  if (editDestinations.value.length >= 20) {
    ElMessage.error('目的地最多 20 个');
    return;
  }
  editDestinations.value.push({
    name: d.name, lat: d.lat, lng: d.lng, country: d.country || '未知',
  });
  editActiveDestIndex.value = editDestinations.value.length - 1;
  updateEditDestText();
  syncEditMarkers();
  recalcEditDistance();
}

function removeEditDest(idx) {
  editDestinations.value.splice(idx, 1);
  if (editActiveDestIndex.value >= editDestinations.value.length) {
    editActiveDestIndex.value = editDestinations.value.length - 1;
  }
  updateEditDestText();
  syncEditMarkers();
  recalcEditDistance();
}

function focusEditDest(idx) {
  editActiveDestIndex.value = idx;
  const d = editDestinations.value[idx];
  if (d && editMap) editMap.setCenter([d.lng, d.lat]);
}

function pickEditDest(c) {
  editDestShowResults.value = false;
  editDestQuery.value = '';
  addEditDest({ name: c.name, lat: c.lat, lng: c.lng, country: c.country || '未知' });
}

function addEditDestFromQuery() {
  const q = editDestQuery.value.trim();
  if (!q) return;
  if (editDestResults.value.length === 1) {
    pickEditDest(editDestResults.value[0]);
    return;
  }
  ElMessage.info('请从搜索结果中选择，或直接在地图上点选');
}

function destroyEditMap() {
  if (editMap) {
    editMap.destroy();
    editMap = null;
  }
  editDestMarkers = [];
  editOriginMarker = null;
}

function clearEditMarkers() {
  editDestMarkers.forEach((m) => m.setMap(null));
  editDestMarkers = [];
}

function syncEditMarkers() {
  if (!editMap || !window.AMap) return;
  clearEditMarkers();
  editDestinations.value.forEach((d, idx) => {
    const marker = new AMap.Marker({
      position: [d.lng, d.lat],
      draggable: true,
      label: { content: `${idx + 1}.${d.name}`, direction: 'top' },
    });
    marker.on('dragend', (e) => {
      editDestinations.value[idx] = {
        ...editDestinations.value[idx],
        lat: e.lnglat.getLat(),
        lng: e.lnglat.getLng(),
      };
      recalcEditDistance();
    });
    marker.on('click', () => { editActiveDestIndex.value = idx; });
    marker.setMap(editMap);
    editDestMarkers.push(marker);
  });
  if (editDestinations.value.length === 1) {
    editMap.setCenter([editDestinations.value[0].lng, editDestinations.value[0].lat]);
  } else if (editDestinations.value.length > 1) {
    editMap.setFitView(editDestMarkers, false, [40, 40, 40, 40]);
  }
}

async function waitForEditMapEl(retries = 20) {
  for (let i = 0; i < retries; i++) {
    await nextTick();
    const exposed = editFormRef.value?.mapEl;
    const node = exposed && (exposed.value !== undefined ? exposed.value : exposed);
    if (node && node.clientWidth > 0) return node;
    await new Promise((r) => setTimeout(r, 40));
  }
  const exposed = editFormRef.value?.mapEl;
  return exposed && (exposed.value !== undefined ? exposed.value : exposed);
}

async function ensureEditMap() {
  if (editMap) {
    editMap.resize();
    return;
  }
  if (!amapReady) {
    amapReady = await loadAmap(['AMap.Driving', 'AMap.Riding', 'AMap.Walking']);
  }
  if (!amapReady || !window.AMap) return;
  const node = await waitForEditMapEl();
  if (!node) return;

  const origin = editProfile && editProfile.home_lat != null
    ? { lat: editProfile.home_lat, lng: editProfile.home_lng }
    : (trip.value?.origin_lat != null
      ? { lat: trip.value.origin_lat, lng: trip.value.origin_lng }
      : null);
  const center = editDestinations.value[0]
    ? [editDestinations.value[0].lng, editDestinations.value[0].lat]
    : (origin ? [origin.lng, origin.lat] : [105, 35]);

  editMap = new AMap.Map(node, { zoom: 5, center });
  if (origin) {
    editOriginMarker = new AMap.Marker({
      position: [origin.lng, origin.lat],
      label: { content: '出发地', direction: 'top' },
    });
    editOriginMarker.setMap(editMap);
  }
  editMap.on('click', (e) => {
    const name = editDestQuery.value.trim() || `地图选点${editDestinations.value.length + 1}`;
    addEditDest({ name, lat: e.lnglat.getLat(), lng: e.lnglat.getLng(), country: '未知' });
    editDestQuery.value = '';
    editDestShowResults.value = false;
  });
  syncEditMarkers();
  requestAnimationFrame(() => { if (editMap) editMap.resize(); });
  setTimeout(() => { if (editMap) editMap.resize(); }, 200);
  recalcEditDistance();
}

function segmentEditDistance(from, to, transport) {
  return new Promise((resolve) => {
    const pluginMap = { '驾车': 'Driving', '骑行': 'Riding', '步行': 'Walking' };
    const plugin = pluginMap[transport];
    if (plugin && amapReady && window.AMap && AMap[plugin]) {
      new AMap[plugin]().search([from.lng, from.lat], [to.lng, to.lat], (status, result) => {
        if (status === 'complete' && result.routes && result.routes.length) {
          resolve(result.routes[0].distance / 1000);
        } else {
          resolve(haversineKm(from, to));
        }
      });
    } else {
      resolve(haversineKm(from, to));
    }
  });
}

async function recalcEditDistance() {
  const token = ++editDistanceToken;
  editComputedDistance = null;
  editDistanceHint.value = '';
  if (!editDestinations.value.length) return;
  const origin = editProfile && editProfile.home_lat != null
    ? { lat: editProfile.home_lat, lng: editProfile.home_lng }
    : (trip.value?.origin_lat != null
      ? { lat: trip.value.origin_lat, lng: trip.value.origin_lng }
      : null);
  if (!origin) {
    editDistanceHint.value = '未设置出发城市，无法自动计算距离';
    return;
  }
  editDistanceHint.value = '正在计算路线…';
  const points = [origin, ...editDestinations.value];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += await segmentEditDistance(points[i], points[i + 1], editForm.transport);
    if (token !== editDistanceToken) return;
  }
  editComputedDistance = Number(total.toFixed(1));
  const via = editDestinations.value.length > 1 ? `（经 ${editDestinations.value.length} 站）` : '';
  editDistanceHint.value = `单程距离${via}：约 ${total.toFixed(1)} 公里`;
}

async function openEdit() {
  editForm.title = trip.value.title;
  editForm.date = trip.value.depart_date;
  editForm.days = trip.value.days;
  editForm.transport = trip.value.transport;
  editMembers.value = (trip.value.members || [])
    .filter((m) => m.name !== '我')
    .map((m) => m.name);
  editMemberInput.value = '';
  const list = trip.value.destinations && trip.value.destinations.length
    ? trip.value.destinations
    : [{ name: trip.value.dest_name, lat: trip.value.dest_lat, lng: trip.value.dest_lng, country: '未知' }];
  editDestinations.value = list.map((d) => ({
    name: d.name, lat: d.lat, lng: d.lng, country: d.country || '未知',
  }));
  editDestQuery.value = '';
  editActiveDestIndex.value = editDestinations.value.length ? 0 : -1;
  updateEditDestText();
  editBudgetTier.value = matchTierKey(
    trip.value.budget,
    trip.value.members?.length || 1,
    trip.value.days,
  );
  editComputedDistance = trip.value.distance_km != null ? trip.value.distance_km : null;
  try {
    editProfile = await get('/api/profile');
    editHomeQuery.value = editProfile.home_name
      || trip.value.origin_name
      || '';
  } catch (_) {
    editHomeQuery.value = trip.value.origin_name || '';
  }
  editVisible.value = true;
  if (isMobile.value) {
    await nextTick();
    setTimeout(() => { onEditOpened(); }, 80);
  }
}

function closeEdit() {
  editVisible.value = false;
  destroyEditMap();
}

async function onEditOpened() {
  destroyEditMap();
  await nextTick();
  setTimeout(() => { ensureEditMap(); }, 80);
}

async function syncEditMembers() {
  const current = (trip.value.members || []).filter((m) => m.name !== '我');
  const desired = editMembers.value;
  for (const m of current) {
    if (!desired.includes(m.name)) {
      await del(`/api/trips/${tripId}/members/${m.id}`);
    }
  }
  const kept = new Set(current.filter((m) => desired.includes(m.name)).map((m) => m.name));
  for (const name of desired) {
    if (!kept.has(name)) {
      await post(`/api/trips/${tripId}/members`, { name });
    }
  }
}

async function saveEdit() {
  const days = parseInt(editForm.days, 10);
  if (!editForm.title.trim()) return ElMessage.error('请填写项目名');
  if (!editForm.date) return ElMessage.error('请选择出发时间');
  if (!days || days < 1) return ElMessage.error('天数无效');
  if (!editDestinations.value.length) return ElMessage.error('请至少添加一个目的地');
  editSaving.value = true;
  try {
    await put(`/api/trips/${tripId}`, {
      title: editForm.title.trim(),
      destinations: editDestinations.value.map((d) => ({
        name: d.name, lat: d.lat, lng: d.lng, country: d.country,
      })),
      depart_date: editForm.date,
      days,
      transport: editForm.transport,
      distance_km: editComputedDistance,
      budget: editEstimatedBudget.value,
    });
    await syncEditMembers();
    ElMessage.success('已保存');
    await reload();
    await loadCompanions();
    closeEdit();
  } catch (_) { /* api.js 已提示 */ } finally {
    editSaving.value = false;
  }
}

async function removeTrip() {
  try {
    await ElMessageBox.confirm(
      `确定删除「${trip.value.title}」？花费、行程、照片将全部删除！`,
      '删除项目',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
  } catch (_) { return; }
  try {
    await del(`/api/trips/${tripId}`);
    router.push('/trips');
  } catch (_) { /* 已提示 */ }
}

// ---------- 同行人（与发起项目一致：我默认 + 常客快选 + 回车添加） ----------
const memberInput = ref('');

const otherMembers = computed(() =>
  (trip.value?.members || []).filter((m) => m.name !== '我'));

const quickPicks = computed(() => {
  const taken = new Set((trip.value?.members || []).map((m) => m.name));
  return companions.value.filter((c) => c.name !== '我' && !taken.has(c.name));
});

async function loadCompanions() {
  try {
    companions.value = await get('/api/companions');
  } catch (_) { /* 已提示 */ }
}

async function ensureSelfMember() {
  if (!trip.value) return;
  if (trip.value.members.some((m) => m.name === '我')) return;
  try {
    await post(`/api/trips/${tripId}/members`, { name: '我' });
    await reload();
  } catch (_) { /* 已提示 */ }
}

async function addMember() {
  const name = memberInput.value.trim();
  memberInput.value = '';
  if (!name) return;
  if (name === '我') { ElMessage.warning('我默认同行，无需添加'); return; }
  if ((trip.value?.members || []).some((m) => m.name === name)) {
    ElMessage.error('该成员已添加');
    return;
  }
  try {
    await post(`/api/trips/${tripId}/members`, { name });
    await reload();
    await loadCompanions();
  } catch (_) { /* 已提示 */ }
}

async function addQuick(name) {
  if ((trip.value?.members || []).some((m) => m.name === name)) return;
  try {
    await post(`/api/trips/${tripId}/members`, { name });
    await reload();
    await loadCompanions();
  } catch (_) { /* 已提示 */ }
}

async function removeMember(m) {
  if (m.name === '我') {
    ElMessage.warning('我默认同行，不能移除');
    return;
  }
  try {
    await del(`/api/trips/${tripId}/members/${m.id}`);
    ElMessage.success('已移除');
    await reload();
    await loadCompanions();
  } catch (_) { /* 已提示（如该成员有花费，后端会返回 error） */ }
}

// ---------- 花费 ----------
const xPayer = ref('');
const xAmount = ref('');
const xCategory = ref('餐饮');
const xNote = ref('');
const xDate = ref(today());

async function addExpense() {
  const amount = Number(xAmount.value);
  if (!amount || amount <= 0) return ElMessage.error('请填写金额');
  if (!xDate.value) return ElMessage.error('请选择日期');
  try {
    await post(`/api/trips/${tripId}/expenses`, {
      payer: xPayer.value,
      amount,
      category: xCategory.value,
      note: xNote.value.trim(),
      spent_at: xDate.value,
    });
    xAmount.value = '';
    xNote.value = '';
    await reload();
  } catch (_) { /* 已提示 */ }
}

async function removeExpense(e) {
  try {
    await ElMessageBox.confirm('删除这笔花费？', '提示', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
    });
  } catch (_) { return; }
  try {
    await del(`/api/trips/${tripId}/expenses/${e.id}`);
    await reload();
  } catch (_) { /* 已提示 */ }
}

// ---------- 行程 ----------
const itDay = ref(1);
const itContent = ref('');

const dayOptions = computed(() => {
  const days = trip.value ? trip.value.days : 1;
  return Array.from({ length: days }, (_, i) => i + 1);
});

function groupByDay(items) {
  const byDay = {};
  items.forEach((it) => { (byDay[it.day_no] = byDay[it.day_no] || []).push(it); });
  return Object.keys(byDay).sort((a, b) => a - b).map((day) => ({ day: Number(day), items: byDay[day] }));
}

const itineraryByDay = computed(() => (trip.value ? groupByDay(trip.value.itinerary) : []));

async function addItinerary() {
  const content = itContent.value.trim();
  if (!content) return;
  try {
    await post(`/api/trips/${tripId}/itinerary`, { day_no: Number(itDay.value), content });
    itContent.value = '';
    await reload();
  } catch (_) { /* 已提示 */ }
}

async function removeItinerary(it) {
  try {
    await del(`/api/trips/${tripId}/itinerary/${it.id}`);
    await reload();
  } catch (_) { /* 已提示 */ }
}

// ---------- AI 生成行程 ----------
const aiItems = ref([]);
const aiLoading = ref(false);
const aiByDay = computed(() => groupByDay(aiItems.value));

async function generateAi() {
  aiLoading.value = true;
  try {
    const data = await post(`/api/trips/${tripId}/itinerary/generate`);
    aiItems.value = data.items || [];
    if (!aiItems.value.length) ElMessage.error('AI 没有生成有效内容，请重试');
  } catch (_) { /* 已提示 */ } finally {
    aiLoading.value = false;
  }
}

function cancelAi() {
  aiItems.value = [];
}

async function adoptAi() {
  if (!aiItems.value.length) return;
  let mode = 'append';
  if (trip.value.itinerary.length) {
    try {
      await ElMessageBox.confirm(
        `已有 ${trip.value.itinerary.length} 条行程，用 AI 行程替换它们吗？`,
        '采用行程',
        {
          type: 'warning',
          confirmButtonText: '替换',
          cancelButtonText: '追加',
          distinguishCancelAndClose: true,
        },
      );
      mode = 'replace';
    } catch (e) {
      if (e === 'close') return;
      mode = 'append';
    }
  }
  try {
    await post(`/api/trips/${tripId}/itinerary/bulk`, { items: aiItems.value, mode });
    ElMessage.success('行程已保存');
    aiItems.value = [];
    await reload();
  } catch (_) { /* 已提示 */ }
}

// ---------- 照片墙 ----------
const uploadingCount = ref(0);
let uploadFailCount = 0;
const viewerVisible = ref(false);
const viewerIndex = ref(0);

function photoUrl(p) { return `/uploads/${tripId}/${p.filename}`; }

const photoUrls = computed(() => (trip.value ? trip.value.photos.map(photoUrl) : []));

function openViewer(idx) {
  viewerIndex.value = idx;
  viewerVisible.value = true;
}

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function beforePhotoUpload(file) {
  if (!PHOTO_TYPES.includes(file.type)) {
    ElMessage.error('仅支持 jpg/png/webp/gif 图片');
    return false;
  }
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.error('单张照片不能超过 10MB');
    return false;
  }
  return true;
}

async function uploadPhoto({ file }) {
  uploadingCount.value++;
  try {
    const fd = new FormData();
    fd.append('photos', file);
    await post(`/api/trips/${tripId}/photos`, fd, true);
  } catch (_) {
    uploadFailCount++; // 错误已由 api.js 弹出
  } finally {
    uploadingCount.value--;
    if (uploadingCount.value === 0) {
      if (uploadFailCount === 0) ElMessage.success('上传成功');
      uploadFailCount = 0;
      await reload();
    }
  }
}

async function removePhoto(p) {
  try {
    await ElMessageBox.confirm('删除这张照片？', '提示', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
    });
  } catch (_) { return; }
  try {
    await del(`/api/trips/${tripId}/photos/${p.id}`);
    await reload();
  } catch (_) { /* 已提示 */ }
}

// ---------- 刷新 ----------
async function reload() {
  const data = await get(`/api/trips/${tripId}`);
  trip.value = data;
  document.title = `${data.title} - 结伴出行`;
  // 付款人默认选中第一个成员（旧版 select 重渲染后自动落在第一项）
  if (!data.members.some((m) => m.name === xPayer.value)) {
    xPayer.value = data.members.length ? data.members[0].name : '';
  }
}

// ---------- 启动 ----------
onMounted(async () => {
  mq = window.matchMedia('(max-width: 768px)');
  mq.addEventListener('change', onMqChange);
  if (!Number.isInteger(tripId)) { router.replace('/trips'); return; }
  try { await fetchMe(); } catch (_) { return; } // 401 由 api.js 自动跳 /login
  try {
    await reload();
    if (!authState.isGuest) {
      await ensureSelfMember();
      await loadCompanions();
    }
  } catch (_) {
    loadError.value = true;
    return;
  }
  amapReady = await loadAmap(['AMap.Driving', 'AMap.Riding', 'AMap.Walking']);
});

onBeforeUnmount(() => {
  if (mq) mq.removeEventListener('change', onMqChange);
  destroyEditMap();
});
</script>

<style scoped>
.trip-detail { min-height: 100%; min-height: 100dvh; }

/* 顶部导航 */
.top-nav {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 12px 20px;
  padding-top: calc(12px + var(--safe-top));
  background: var(--brand-cream);
  border-bottom: 1px solid var(--brand-line);
  position: sticky; top: 0; z-index: 10;
}
.top-nav-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
.nav-link { color: var(--el-color-primary); text-decoration: none; font-size: 14px; font-weight: 600; white-space: nowrap; }
.nav-link:hover { text-decoration: underline; }
.nav-title {
  font-size: 16px; font-weight: 700; color: var(--brand-ink);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.user-info { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.user-capsule {
  padding: 4px 14px; border-radius: 999px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary-dark-2);
  font-size: 13px; font-weight: 600;
  border: 1px solid var(--el-color-primary-light-7);
  max-width: 88px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.user-link { cursor: pointer; }
.user-link:hover { box-shadow: 0 0 0 2px var(--el-color-primary-light-7); }

/* 游客横幅 */
.guest-banner {
  text-align: center; padding: 8px 12px;
  background: #fdf0e5; color: #b25a2f;
  font-size: 13px; border-bottom: 1px solid #f3ddc8;
}

/* 卡片区块 */
.block-card {
  margin-bottom: 18px;
  border-radius: 14px;
  border: 1px solid var(--brand-line);
  background: var(--brand-cream);
}
.block-card :deep(.el-card__header) { padding: 14px 18px; border-bottom: 1px solid var(--brand-line); }
.block-card :deep(.el-card__body) { padding: 14px 18px; }
.card-title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.card-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.card-actions :deep(.el-button) { margin-left: 0; }
.card-title { font-size: 15px; font-weight: 700; color: var(--brand-ink); }
.sub-label { font-size: 13px; color: var(--brand-sub); margin-bottom: 6px; }

/* 基本信息 */
.info-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;
}
.info-item {
  background: #fff; border: 1px solid var(--brand-line); border-radius: 10px;
  padding: 10px 14px; display: flex; flex-direction: column; gap: 4px;
}
.info-item span { font-size: 12px; color: var(--brand-sub); }
.info-item strong { font-size: 14px; color: var(--brand-ink); word-break: break-word; }

/* 同行人（与发起项目同款） */
.form-label { color: var(--brand-sub); font-weight: 600; font-size: 13px; margin-bottom: 8px; }
.member-list { display: flex; flex-wrap: wrap; gap: 8px; }
.member-quick { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 8px; }
.quick-label { font-size: 13px; color: var(--brand-sub); }
.quick-chip {
  border: 1px solid #F5D9A8; background: #FDEFD9; color: #A5700B;
  border-radius: 999px; padding: 3px 12px; font-size: 13px; cursor: pointer;
  transition: transform 0.12s ease;
}
.quick-chip:hover { transform: scale(1.06); }
.quick-chip em { font-style: normal; font-size: 11px; opacity: 0.75; }
.tag-input {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  border: 2px solid var(--brand-line); border-radius: 12px;
  padding: 8px 10px; background: #ffffff;
}
.tag-input:focus-within { border-color: #F4A261; box-shadow: 0 0 0 3px rgba(244, 162, 97, 0.2); }
.tag-input input { border: none; outline: none; flex: 1; min-width: 120px; font-size: 14px; padding: 4px; background: transparent; }
.member-tag { font-weight: 600; }
.me-tag { background: var(--el-color-primary-light-9); color: var(--el-color-primary-dark-2); border-color: var(--el-color-primary-light-7); }
.inline-add { display: flex; gap: 8px; margin-top: 14px; align-items: center; flex-wrap: wrap; }
.inline-add :deep(.el-input) { flex: 1; min-width: 140px; max-width: 100% !important; }

/* 分摊统计 */
.settle-summary { display: flex; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.stat-card {
  flex: 1; min-width: 100px;
  background: #fff; border: 1px solid var(--brand-line); border-radius: 10px;
  padding: 12px; text-align: center;
}
.stat-num { font-size: 18px; font-weight: 700; color: var(--el-color-primary); }
.stat-label { font-size: 12px; color: var(--brand-sub); margin-top: 4px; }
.settle-table, .expense-table { margin-bottom: 14px; width: 100%; overflow-x: auto; }
.pos { color: #3d9a50; font-weight: 600; }
.neg { color: #d45b4a; font-weight: 600; }

/* 转账建议 · 插画风 */
.settle-transfers {
  margin: 4px 0 18px;
  padding: 16px 16px 14px;
  border-radius: 20px;
  border: 2.5px dashed #E8D4B0;
  background:
    radial-gradient(ellipse 70% 60% at 8% 0%, rgba(255, 214, 170, 0.4), transparent 55%),
    radial-gradient(ellipse 60% 50% at 96% 12%, rgba(186, 220, 240, 0.35), transparent 50%),
    linear-gradient(165deg, #FFF9EE 0%, #FDF3E0 55%, #F7EBD2 100%);
}
.transfer-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 10px; margin-bottom: 14px;
}
.transfer-title {
  font-family: 'KaiTi', 'STKaiti', 'Songti SC', 'PingFang SC', serif;
  font-size: 22px; font-weight: 700; color: #5C4A3A; letter-spacing: 0.04em;
}
.transfer-sub { margin: 4px 0 0; font-size: 12px; color: #9A8468; }
.transfer-count {
  flex-shrink: 0; padding: 5px 11px; border-radius: 999px;
  background: #FFFDF8; border: 1.5px solid #EFD9B0;
  color: #A5700B; font-size: 12px; font-weight: 700;
  box-shadow: 0 2px 0 #F5E6C8;
}
.transfer-list { display: flex; flex-direction: column; gap: 10px; }
.transfer-card {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255, 253, 247, 0.94);
  border: 1.5px solid #F0E2C8;
  box-shadow: 0 3px 0 #F5EBDA;
  animation: transfer-rise 0.45s ease both;
  animation-delay: var(--delay, 0s);
}
.transfer-who {
  display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;
}
.transfer-person {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  min-width: 52px; max-width: 72px;
}
.transfer-person em {
  font-style: normal; font-size: 10px; color: #B9AE9F; line-height: 1;
}
.transfer-person.from em { color: #D45B4A; }
.transfer-person.to em { color: #3d9a50; }
.transfer-avatar {
  width: 40px; height: 40px; border-radius: 50%;
  object-fit: cover; object-position: center center;
  background: #FFFDF8;
  box-shadow: 0 0 0 2px #fff, 0 3px 8px rgba(74, 64, 57, 0.14);
}
.transfer-name {
  font-size: 13px; font-weight: 700; color: var(--brand-ink);
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.transfer-flow {
  position: relative;
  flex: 1; min-width: 36px; max-width: 80px;
  height: 28px;
  display: flex; align-items: center; justify-content: center;
}
.transfer-arrow-line {
  position: absolute; left: 4px; right: 14px; top: 50%;
  height: 2px; margin-top: -1px;
  background: linear-gradient(90deg, #F4A261, #E76F51);
  border-radius: 2px;
}
.transfer-arrow-tip {
  position: relative; z-index: 1;
  margin-left: auto; margin-right: 0;
  color: #E76F51; font-size: 18px; font-weight: 700; line-height: 1;
  text-shadow: 0 1px 0 #fff;
}
.transfer-amount {
  flex-shrink: 0;
  display: flex; flex-direction: column; align-items: flex-end; gap: 2px;
  padding: 8px 12px;
  border-radius: 14px;
  background: linear-gradient(180deg, #FFF8EC, #FFE8C4);
  border: 1.5px solid #F4C97A;
}
.transfer-amount-label { font-size: 11px; color: #C48C28; font-weight: 600; }
.transfer-amount strong {
  font-size: 17px; font-weight: 800; color: #D95F41;
  font-variant-numeric: tabular-nums;
}
.transfer-empty {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 12px;
  border-radius: 14px;
  background: rgba(255, 253, 247, 0.9);
  border: 1.5px solid #D8E8C8;
}
.transfer-empty-icon {
  width: 36px; height: 36px; flex-shrink: 0;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: #E9F6E3; color: #4E7A36; font-size: 18px; font-weight: 700;
}
.transfer-empty strong { display: block; font-size: 14px; color: #4E7A36; }
.transfer-empty p { margin: 2px 0 0; font-size: 12px; color: #9A8468; }

@keyframes transfer-rise {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .transfer-card { animation: none; }
}

.inline-add-form { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 6px; }
.inline-add-form :deep(.el-input),
.inline-add-form :deep(.el-select),
.inline-add-form :deep(.el-date-editor) { flex: 1 1 140px; }

/* 行程 */
.visit-none { color: var(--brand-sub); font-size: 13px; padding: 8px 0; }
.day-block { margin-bottom: 12px; }
.day-title {
  font-size: 13px; font-weight: 700; color: var(--el-color-primary-dark-2);
  border-left: 3px solid var(--el-color-primary); padding-left: 8px; margin-bottom: 6px;
}
.it-row {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 8px 10px; border-radius: 8px;
}
.it-row:hover { background: #fff; }
.it-content { font-size: 14px; color: var(--brand-ink); min-width: 0; word-break: break-word; }

/* AI 预览 */
.ai-preview {
  border: 1px dashed var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
  border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;
}
.ai-preview-title { font-size: 13px; font-weight: 700; color: var(--el-color-primary-dark-2); margin-bottom: 8px; }
.ai-row { font-size: 14px; color: var(--brand-ink); padding: 3px 0; }
.ai-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; flex-wrap: wrap; }

/* 照片墙 */
.empty-state { text-align: center; color: var(--brand-sub); font-size: 14px; padding: 40px 0; }
.photo-wall {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px;
}
.photo-cell {
  position: relative; aspect-ratio: 1; border-radius: 10px; overflow: hidden;
  border: 1px solid var(--brand-line);
}
.photo-cell img { width: 100%; height: 100%; object-fit: cover; cursor: zoom-in; display: block; }
.photo-del {
  position: absolute; top: 6px; right: 6px;
  width: 28px; height: 28px; border-radius: 50%;
  border: none; background: rgba(0, 0, 0, 0.55); color: #fff;
  font-size: 14px; line-height: 1; cursor: pointer;
  opacity: 0; transition: opacity 0.15s ease;
}
.photo-cell:hover .photo-del { opacity: 1; }

/* 编辑弹窗 / 移动端整页 */
.edit-dialog :deep(.el-dialog__body) { padding-top: 8px; }
.edit-dialog :deep(.el-dialog__footer) {
  display: flex; gap: 10px; justify-content: flex-end;
}
.edit-dialog :deep(.el-dialog__footer .el-button) { min-width: 96px; }
.edit-page-actions {
  display: flex; gap: 12px; margin-top: 16px;
  position: sticky; bottom: 0;
  padding: 14px 0 calc(14px + var(--safe-bottom));
  background: linear-gradient(180deg, transparent, var(--brand-cream) 28%);
  z-index: 20;
}
.edit-page-actions .el-button {
  flex: 1; min-height: 48px; font-size: 16px; font-weight: 700;
}
.edit-page-actions .cancel-btn {
  border-width: 2px; border-color: #E8D4B0;
  color: var(--brand-ink); background: #FFFDF8;
}
.edit-page-actions .submit-btn {
  box-shadow: 0 4px 12px rgba(231, 111, 81, 0.3);
}

@media (max-width: 768px) {
  .top-nav { padding: 10px 12px; padding-top: calc(10px + var(--safe-top)); }
  .nav-title { font-size: 15px; }
  .block-card :deep(.el-card__header),
  .block-card :deep(.el-card__body) { padding: 12px 14px; }
  .info-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
  .stat-card { min-width: calc(33% - 8px); }
  .photo-wall { grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .photo-del { opacity: 1; }
  .ai-actions :deep(.el-button) { margin-left: 0; }
  .card-actions { gap: 12px; }

  .settle-transfers { padding: 14px 12px 12px; border-radius: 16px; }
  .transfer-title { font-size: 18px; }
  .transfer-card {
    flex-direction: column; align-items: stretch; gap: 10px;
    padding: 12px;
  }
  .transfer-who { justify-content: space-between; }
  .transfer-person { min-width: 64px; max-width: 88px; }
  .transfer-flow { max-width: none; flex: 1; }
  .transfer-amount {
    flex-direction: row; align-items: baseline; justify-content: space-between;
    width: 100%;
  }
  .transfer-amount strong { font-size: 18px; }

  /* 具体行程：天数缩小，内容独占一行 */
  .day-title {
    font-size: 11px;
    font-weight: 600;
    padding-left: 6px;
    margin-bottom: 4px;
    border-left-width: 2px;
    letter-spacing: 0.02em;
  }
  .itinerary-add-form {
    gap: 8px;
  }
  .itinerary-add-form :deep(.it-day-select) {
    width: 88px !important;
    flex: 0 0 88px !important;
    order: 1;
  }
  .itinerary-add-form :deep(.it-day-select .el-select__wrapper) {
    min-height: 32px;
    font-size: 13px;
    padding: 0 8px;
  }
  .itinerary-add-form .it-add-btn {
    order: 2;
    margin-left: auto;
  }
  .itinerary-add-form :deep(.it-content-input) {
    flex: 1 1 100% !important;
    width: 100% !important;
    min-width: 0 !important;
    order: 3;
  }
  .it-row {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
    padding: 10px 12px;
    background: #fff;
    border: 1px solid var(--brand-line);
    margin-bottom: 6px;
  }
  .it-row:hover { background: #fff; }
  .it-content {
    display: block;
    width: 100%;
    font-size: 14px;
    line-height: 1.55;
  }
  .it-row :deep(.el-button) {
    align-self: flex-end;
    margin: 0;
    padding: 0 4px;
  }
  .ai-row {
    display: block;
    width: 100%;
    padding: 8px 10px;
    margin-bottom: 4px;
    background: #fff;
    border-radius: 8px;
    line-height: 1.55;
  }
}
@media (max-width: 400px) {
  .info-grid { grid-template-columns: 1fr; }
}
</style>
