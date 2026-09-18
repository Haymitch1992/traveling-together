<template>
  <div class="trip-detail">
    <!-- 顶部导航 -->
    <nav class="top-nav">
      <div class="top-nav-left">
        <router-link to="/trips" class="nav-link">← 旅行项目</router-link>
        <span class="nav-title">{{ trip ? trip.title : '旅行详情' }}</span>
      </div>
      <div class="user-info">
        <span class="user-capsule">{{ authState.isGuest ? '游客' : authState.username }}</span>
        <el-button size="small" @click="logout">退出</el-button>
      </div>
    </nav>

    <!-- 游客只读横幅 -->
    <div v-if="authState.isGuest" class="guest-banner">游客模式 · 正在浏览 admin 的旅行项目（只读）</div>

    <main v-if="trip" class="page-main">
      <!-- ① 基本信息 -->
      <el-card class="block-card" shadow="never">
        <template #header>
          <div class="card-title-row">
            <span class="card-title">基本信息</span>
            <div v-if="!authState.isGuest">
              <el-button size="small" @click="openEdit">编辑</el-button>
              <el-button size="small" type="danger" plain @click="removeTrip">删除项目</el-button>
            </div>
          </div>
        </template>
        <div class="info-grid">
          <div class="info-item"><span>出发地</span><strong>{{ trip.origin_name || '未设置' }}</strong></div>
          <div class="info-item"><span>目的地</span><strong>{{ trip.dest_name }}</strong></div>
          <div class="info-item"><span>出发时间</span><strong>{{ trip.depart_date }}</strong></div>
          <div class="info-item"><span>旅行天数</span><strong>{{ trip.days }} 天</strong></div>
          <div class="info-item"><span>出行方式</span><strong>{{ trip.transport }}</strong></div>
          <div class="info-item"><span>单程距离</span><strong>{{ trip.distance_km != null ? trip.distance_km + ' km' : '未知' }}</strong></div>
          <div class="info-item"><span>预算</span><strong>{{ trip.budget != null ? fmt(trip.budget) : '未设' }}</strong></div>
          <div class="info-item"><span>已花费</span><strong>{{ fmt(trip.settlement.total) }}</strong></div>
        </div>
      </el-card>

      <!-- ② 同行人 -->
      <el-card class="block-card" shadow="never">
        <template #header><span class="card-title">同行人</span></template>
        <div class="member-list">
          <el-tag
            v-for="m in trip.members"
            :key="m.id"
            size="large"
            :closable="!authState.isGuest"
            :disable-transitions="true"
            @close="removeMember(m)"
          >{{ m.name }}</el-tag>
        </div>
        <div v-if="!authState.isGuest" class="inline-add">
          <el-input
            v-model="memberInput"
            placeholder="添加同行人"
            maxlength="20"
            style="max-width: 220px"
            @keyup.enter="addMember"
          />
          <el-button size="small" type="primary" @click="addMember">添加</el-button>
        </div>
      </el-card>

      <!-- ③ 花费与分摊 -->
      <el-card class="block-card" shadow="never">
        <template #header><span class="card-title">花费与分摊</span></template>

        <template v-if="trip.members.length">
          <div class="settle-summary">
            <div class="stat-card"><div class="stat-num">{{ fmt(trip.settlement.total) }}</div><div class="stat-label">总花费</div></div>
            <div class="stat-card"><div class="stat-num">{{ fmt(trip.settlement.perPerson) }}</div><div class="stat-label">人均</div></div>
            <div class="stat-card"><div class="stat-num">{{ trip.budget != null ? fmt(trip.budget) : '—' }}</div><div class="stat-label">预算</div></div>
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
            <div class="sub-label">转账建议</div>
            <ul>
              <template v-if="trip.settlement.transfers.length">
                <li v-for="(t, i) in trip.settlement.transfers" :key="i">
                  {{ t.from }} → {{ t.to }}：<strong>{{ fmt(t.amount) }}</strong>
                </li>
              </template>
              <li v-else>当前无需转账</li>
            </ul>
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

        <div v-if="!authState.isGuest" class="inline-add-form">
          <el-select v-model="itDay" style="width: 110px">
            <el-option v-for="d in dayOptions" :key="d" :label="`第 ${d} 天`" :value="d" />
          </el-select>
          <el-input v-model="itContent" placeholder="行程内容，如：上午 西湖游船" maxlength="200" style="flex: 1" @keyup.enter="addItinerary" />
          <el-button size="small" type="primary" @click="addItinerary">添加</el-button>
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

    <!-- 编辑项目弹窗 -->
    <el-dialog v-model="editVisible" title="编辑项目" width="760px" @opened="onEditDialogOpened">
      <div class="edit-form-grid">
        <div class="form-item">
          <div class="sub-label">旅行项目名</div>
          <el-input v-model="editForm.title" maxlength="50" />
        </div>
        <div class="form-item">
          <div class="sub-label">出发时间</div>
          <el-date-picker v-model="editForm.date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </div>
        <div class="form-item">
          <div class="sub-label">旅行天数</div>
          <el-input-number v-model="editForm.days" :min="1" :max="365" style="width: 100%" />
        </div>
        <div class="form-item">
          <div class="sub-label">出行方式</div>
          <el-select v-model="editForm.transport" style="width: 100%" @change="recalcEditDistance">
            <el-option v-for="t in TRANSPORTS" :key="t" :label="t" :value="t" />
          </el-select>
        </div>
        <div class="form-item">
          <div class="sub-label">总预算（元）</div>
          <el-input-number v-model="editForm.budget" :min="0" :controls="false" :precision="2" placeholder="未设" style="width: 100%" />
        </div>
        <div class="form-item">
          <div class="sub-label">单程距离（公里）</div>
          <el-input-number v-model="editForm.distance" :min="0" :controls="false" :precision="1" style="width: 100%" />
        </div>
      </div>
      <div class="form-block">
        <div class="sub-label">目的地（在地图上点击重新选点）</div>
        <div class="dest-picker">
          <div class="dest-side">
            <div class="sub-label">目的地名称</div>
            <el-input v-model="editForm.destName" maxlength="50" />
            <div class="dest-coord">{{ editCoordText }}</div>
            <div class="distance-hint">{{ editDistanceHint }}</div>
          </div>
          <div ref="editMapEl" class="picker-map"></div>
        </div>
      </div>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSaving" @click="saveEdit">保存</el-button>
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
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { get, post, put, del } from '../api';
import { loadAmap, haversineKm } from '../amap';
import { authState, fetchMe, logout } from '../auth';

const route = useRoute();
const router = useRouter();
const tripId = Number(route.params.id);

const TRANSPORTS = ['驾车', '火车', '飞机', '骑行', '步行', '其他'];
const CATEGORIES = ['餐饮', '住宿', '交通', '门票', '购物', '其他'];

const trip = ref(null);
const loadError = ref(false);

// ---------- 工具 ----------
function fmt(n) { return '¥' + Number(n).toFixed(2); }

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------- 基本信息编辑 ----------
const editVisible = ref(false);
const editSaving = ref(false);
const editForm = reactive({
  title: '', date: '', days: 1, transport: '驾车',
  budget: undefined, distance: undefined, destName: '',
});
const editCoordText = ref('');
const editDistanceHint = ref('');
const editMapEl = ref(null);
let editMap = null;
let editMarker = null;
let editPoint = null;
let amapReady = false;

function openEdit() {
  editForm.title = trip.value.title;
  editForm.date = trip.value.depart_date;
  editForm.days = trip.value.days;
  editForm.transport = trip.value.transport;
  editForm.budget = trip.value.budget != null ? trip.value.budget : undefined;
  editForm.distance = trip.value.distance_km != null ? trip.value.distance_km : undefined;
  editForm.destName = trip.value.dest_name;
  editVisible.value = true;
}

function onEditDialogOpened() {
  ensureEditMap();
}

function ensureEditMap() {
  if (editMap || !amapReady || !editMapEl.value) return;
  editMap = new AMap.Map(editMapEl.value, { zoom: 5, center: [trip.value.dest_lng, trip.value.dest_lat] });
  if (trip.value.origin_lat != null) {
    new AMap.Marker({
      position: [trip.value.origin_lng, trip.value.origin_lat],
      label: { content: '出发地', direction: 'top' },
    }).setMap(editMap);
  }
  editMap.on('click', (e) => {
    setEditPoint({ lat: e.lnglat.getLat(), lng: e.lnglat.getLng() });
  });
  setEditPoint({ lat: trip.value.dest_lat, lng: trip.value.dest_lng });
}

function setEditPoint(p) {
  editPoint = p;
  editCoordText.value = `已选：${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
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
  if (!editPoint || !trip.value) return;
  const t = trip.value;
  const origin = t.origin_lat != null ? { lat: t.origin_lat, lng: t.origin_lng } : null;
  if (!origin) { editDistanceHint.value = '该项目无出发地信息，请手填距离'; return; }
  const transport = editForm.transport;
  const pluginMap = { '驾车': 'Driving', '骑行': 'Riding', '步行': 'Walking' };
  const plugin = pluginMap[transport];
  if (plugin && amapReady && window.AMap && AMap[plugin]) {
    editDistanceHint.value = '正在计算路线…';
    new AMap[plugin]().search([origin.lng, origin.lat], [editPoint.lng, editPoint.lat], (status, result) => {
      if (status === 'complete' && result.routes && result.routes.length) {
        const km = result.routes[0].distance / 1000;
        editForm.distance = Number(km.toFixed(1));
        editDistanceHint.value = `${transport}路线约 ${km.toFixed(1)} 公里`;
      } else {
        const km = haversineKm(origin, editPoint);
        editForm.distance = Number(km.toFixed(1));
        editDistanceHint.value = `路线规划失败，直线距离约 ${km.toFixed(1)} 公里`;
      }
    });
  } else {
    const km = haversineKm(origin, editPoint);
    editForm.distance = Number(km.toFixed(1));
    editDistanceHint.value = `${transport}无路线规划，直线距离约 ${km.toFixed(1)} 公里`;
  }
}

async function saveEdit() {
  const days = parseInt(editForm.days, 10);
  if (!editForm.title.trim()) return ElMessage.error('请填写项目名');
  if (!editForm.date) return ElMessage.error('请选择出发时间');
  if (!days || days < 1) return ElMessage.error('天数无效');
  if (!editPoint) return ElMessage.error('请在地图上选择目的地');
  if (!editForm.destName.trim()) return ElMessage.error('请填写目的地名称');
  editSaving.value = true;
  try {
    await put(`/api/trips/${tripId}`, {
      title: editForm.title.trim(),
      dest_name: editForm.destName.trim(),
      dest_lat: editPoint.lat,
      dest_lng: editPoint.lng,
      depart_date: editForm.date,
      days,
      transport: editForm.transport,
      distance_km: editForm.distance != null && editForm.distance !== '' ? Number(editForm.distance) : null,
      budget: editForm.budget != null && editForm.budget !== '' ? Number(editForm.budget) : null,
    });
    ElMessage.success('已保存');
    await reload();
    editVisible.value = false;
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

// ---------- 同行人 ----------
const memberInput = ref('');

async function addMember() {
  const name = memberInput.value.trim();
  if (!name) return;
  try {
    await post(`/api/trips/${tripId}/members`, { name });
    memberInput.value = '';
    await reload();
  } catch (_) { /* 已提示 */ }
}

async function removeMember(m) {
  try {
    await del(`/api/trips/${tripId}/members/${m.id}`);
    ElMessage.success('已移除');
    await reload();
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
  if (!Number.isInteger(tripId)) { router.replace('/trips'); return; }
  try { await fetchMe(); } catch (_) { return; } // 401 由 api.js 自动跳 /login
  try {
    await reload();
  } catch (_) {
    loadError.value = true;
    return;
  }
  amapReady = await loadAmap(['AMap.Driving', 'AMap.Riding', 'AMap.Walking']);
});

onBeforeUnmount(() => {
  if (editMap) { editMap.destroy(); editMap = null; editMarker = null; }
});
</script>

<style scoped>
.trip-detail { min-height: 100%; }

/* 顶部导航 */
.top-nav {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px;
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
.user-info { display: flex; align-items: center; gap: 10px; }
.user-capsule {
  padding: 4px 14px; border-radius: 999px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary-dark-2);
  font-size: 13px; font-weight: 600;
  border: 1px solid var(--el-color-primary-light-7);
}

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
.card-title-row { display: flex; align-items: center; justify-content: space-between; }
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
.info-item strong { font-size: 14px; color: var(--brand-ink); }

/* 同行人 */
.member-list { display: flex; flex-wrap: wrap; gap: 8px; }
.inline-add { display: flex; gap: 8px; margin-top: 14px; align-items: center; }

/* 分摊统计 */
.settle-summary { display: flex; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.stat-card {
  flex: 1; min-width: 120px;
  background: #fff; border: 1px solid var(--brand-line); border-radius: 10px;
  padding: 12px; text-align: center;
}
.stat-num { font-size: 18px; font-weight: 700; color: var(--el-color-primary); }
.stat-label { font-size: 12px; color: var(--brand-sub); margin-top: 4px; }
.settle-table { margin-bottom: 14px; }
.pos { color: #3d9a50; font-weight: 600; }
.neg { color: #d45b4a; font-weight: 600; }
.settle-transfers { margin-bottom: 16px; }
.settle-transfers ul { margin: 0; padding-left: 18px; }
.settle-transfers li { font-size: 13px; color: var(--brand-ink); padding: 2px 0; }

.expense-table { margin-bottom: 14px; }

.inline-add-form { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 6px; }

/* 行程 */
.visit-none { color: var(--brand-sub); font-size: 13px; padding: 8px 0; }
.day-block { margin-bottom: 12px; }
.day-title {
  font-size: 13px; font-weight: 700; color: var(--el-color-primary-dark-2);
  border-left: 3px solid var(--el-color-primary); padding-left: 8px; margin-bottom: 6px;
}
.it-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px; border-radius: 8px;
}
.it-row:hover { background: #fff; }
.it-content { font-size: 14px; color: var(--brand-ink); }

/* AI 预览 */
.ai-preview {
  border: 1px dashed var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
  border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;
}
.ai-preview-title { font-size: 13px; font-weight: 700; color: var(--el-color-primary-dark-2); margin-bottom: 8px; }
.ai-row { font-size: 14px; color: var(--brand-ink); padding: 3px 0; }
.ai-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }

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
  width: 24px; height: 24px; border-radius: 50%;
  border: none; background: rgba(0, 0, 0, 0.55); color: #fff;
  font-size: 14px; line-height: 1; cursor: pointer;
  opacity: 0; transition: opacity 0.15s ease;
}
.photo-cell:hover .photo-del { opacity: 1; }

/* 编辑弹窗 */
.edit-form-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 14px;
}
.form-block { margin-top: 16px; }
.dest-picker { display: flex; gap: 14px; }
.dest-side { width: 220px; flex-shrink: 0; }
.dest-coord { font-size: 12px; color: var(--brand-sub); margin-top: 8px; }
.distance-hint { font-size: 12px; color: var(--el-color-primary-dark-2); margin-top: 6px; min-height: 16px; }
.picker-map { flex: 1; height: 260px; border-radius: 10px; border: 1px solid var(--brand-line); overflow: hidden; }

@media (max-width: 640px) {
  .edit-form-grid { grid-template-columns: 1fr; }
  .dest-picker { flex-direction: column; }
  .dest-side { width: 100%; }
}
</style>
