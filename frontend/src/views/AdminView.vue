<template>
  <div class="admin-page">
    <nav class="top-nav">
      <div class="top-nav-left">
        <router-link to="/" class="nav-link">← 旅行地图</router-link>
        <span class="nav-title">后台管理</span>
      </div>
      <div class="user-info">
        <el-button size="small" round :loading="loading" @click="refreshAll">刷新</el-button>
        <span class="user-capsule" @click="router.push('/profile')">{{ authState.username }}</span>
      </div>
    </nav>

    <main class="page-main">
      <div class="tab-switch" role="tablist">
        <button
          type="button"
          role="tab"
          class="tab-btn"
          :class="{ active: activeTab === 'overview' }"
          :aria-selected="activeTab === 'overview'"
          @click="activeTab = 'overview'"
        >数据概览</button>
        <button
          type="button"
          role="tab"
          class="tab-btn"
          :class="{ active: activeTab === 'users' }"
          :aria-selected="activeTab === 'users'"
          @click="switchToUsers"
        >注册用户</button>
      </div>

      <section class="admin-hero">
        <h1 class="admin-title">{{ activeTab === 'overview' ? '数据概览' : '注册用户' }}</h1>
        <p class="admin-sub">{{ activeTab === 'overview' ? '用户、旅行与内容规模一目了然' : '可快速帮用户重置密码' }}</p>
      </section>

      <!-- 数据概览 -->
      <div v-show="activeTab === 'overview'">
      <!-- 核心指标 -->
      <section class="stat-grid" v-loading="statsLoading">
        <div class="stat-tile">
          <div class="stat-label">注册用户</div>
          <div class="stat-num">{{ stats?.users?.total ?? '—' }}</div>
          <div class="stat-foot">近 30 天 +{{ stats?.users?.last30Days ?? 0 }} · 绑邮箱 {{ stats?.users?.withEmail ?? 0 }}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">旅行项目</div>
          <div class="stat-num">{{ stats?.trips?.total ?? '—' }}</div>
          <div class="stat-foot">近 30 天 +{{ stats?.trips?.last30Days ?? 0 }} · 共 {{ stats?.trips?.totalDays ?? 0 }} 天</div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">地图城市</div>
          <div class="stat-num">{{ stats?.cities?.total ?? '—' }}</div>
          <div class="stat-foot">到访 {{ stats?.cities?.visits ?? 0 }} 次 · {{ stats?.cities?.countries ?? 0 }} 国家/地区</div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">行程距离</div>
          <div class="stat-num">{{ formatKm(stats?.trips?.totalDistanceKm) }}</div>
          <div class="stat-foot">花费记账 {{ formatMoney(stats?.content?.expenseAmount) }} · 照片 {{ stats?.content?.photos ?? 0 }}</div>
        </div>
      </section>

      <!-- 次级指标 + 月度趋势 -->
      <div class="two-col">
        <el-card class="admin-card" shadow="never">
          <div class="card-head">内容与活跃</div>
          <div class="metric-list">
            <div class="metric-row"><span>有效会话</span><strong>{{ stats?.sessions?.active ?? 0 }}</strong><em>游客 {{ stats?.sessions?.guest ?? 0 }}</em></div>
            <div class="metric-row"><span>近 7 日新用户</span><strong>{{ stats?.users?.last7Days ?? 0 }}</strong></div>
            <div class="metric-row"><span>行程条目</span><strong>{{ stats?.content?.itinerary ?? 0 }}</strong></div>
            <div class="metric-row"><span>花费笔数</span><strong>{{ stats?.content?.expenses ?? 0 }}</strong></div>
            <div class="metric-row"><span>留言板</span><strong>{{ stats?.content?.guestbook ?? 0 }}</strong></div>
            <div class="metric-row"><span>设预算的旅行</span><strong>{{ stats?.trips?.withBudget ?? 0 }}</strong></div>
          </div>
        </el-card>

        <el-card class="admin-card" shadow="never">
          <div class="card-head">近 6 个月增长</div>
          <div v-if="!monthMax" class="empty-mini">暂无数据</div>
          <div v-else class="month-bars">
            <div v-for="m in (stats?.monthly || [])" :key="m.month" class="month-row">
              <span class="month-label">{{ m.month.slice(5) }}月</span>
              <div class="month-track">
                <div class="bar bar-users" :style="{ width: barPct(m.users) }" :title="`用户 ${m.users}`"></div>
                <div class="bar bar-trips" :style="{ width: barPct(m.trips) }" :title="`旅行 ${m.trips}`"></div>
              </div>
              <span class="month-nums">{{ m.users }}/{{ m.trips }}</span>
            </div>
            <div class="month-legend">
              <span><i class="dot users"></i>新用户</span>
              <span><i class="dot trips"></i>新旅行</span>
            </div>
          </div>
        </el-card>
      </div>

      <div class="two-col">
        <el-card class="admin-card" shadow="never">
          <div class="card-head">旅行活跃用户</div>
          <div v-if="!(stats?.topTripUsers || []).length" class="empty-mini">还没有旅行数据</div>
          <div v-else class="rank-list">
            <div v-for="(u, i) in stats.topTripUsers" :key="u.username" class="rank-row">
              <span class="rank-idx">{{ i + 1 }}</span>
              <span class="rank-name">{{ u.username }}</span>
              <span class="rank-val">{{ u.tripCount }} 个项目</span>
            </div>
          </div>
        </el-card>

        <el-card class="admin-card" shadow="never">
          <div class="card-head">最近创建的旅行</div>
          <div v-if="!(stats?.recentTrips || []).length" class="empty-mini">暂无旅行</div>
          <div v-else class="rank-list">
            <div v-for="t in stats.recentTrips" :key="t.id" class="rank-row recent-trip">
              <div class="trip-main">
                <span class="rank-name">{{ t.title }}</span>
                <span class="trip-meta">{{ t.username }} · {{ t.depart_date }} · {{ t.days }}天</span>
              </div>
            </div>
          </div>
        </el-card>
      </div>
      </div>

      <!-- 注册用户 -->
      <div v-show="activeTab === 'users'">
      <el-card class="admin-card" shadow="never" v-loading="usersLoading">
        <div class="toolbar">
          <span class="count">共 {{ users.length }} 人</span>
        </div>

        <el-table :data="users" class="users-table desktop-only" empty-text="暂无注册用户">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="username" label="用户名" min-width="120">
            <template #default="{ row }">
              <span class="uname">{{ row.username }}</span>
              <el-tag v-if="row.isAdmin" size="small" type="warning" effect="plain" class="admin-tag">管理员</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="email" label="邮箱" min-width="160">
            <template #default="{ row }">{{ row.email || '—' }}</template>
          </el-table-column>
          <el-table-column prop="tripCount" label="旅行" width="80" align="center" />
          <el-table-column prop="cityCount" label="城市" width="80" align="center" />
          <el-table-column prop="created_at" label="注册时间" width="170">
            <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link @click="openReset(row)">重置密码</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="user-list mobile-only">
          <div v-if="!users.length && !usersLoading" class="empty">暂无注册用户</div>
          <div v-for="u in users" :key="u.id" class="user-item">
            <div class="user-item-main">
              <div class="user-item-name">
                <span class="uname">{{ u.username }}</span>
                <el-tag v-if="u.isAdmin" size="small" type="warning" effect="plain">管理员</el-tag>
              </div>
              <div class="user-item-meta">
                {{ u.email || '未绑邮箱' }} · 旅行 {{ u.tripCount }} · 城市 {{ u.cityCount }}
              </div>
            </div>
            <el-button size="small" type="primary" plain round @click="openReset(u)">重置密码</el-button>
          </div>
        </div>
      </el-card>
      </div>
    </main>

    <el-dialog
      v-model="resetVisible"
      :title="`重置密码 · ${resetUser?.username || ''}`"
      :width="isMobile ? '92%' : '420px'"
      destroy-on-close
      @closed="onResetClosed"
    >
      <p class="reset-hint">设置新密码后，该用户所有登录会话将立即失效。</p>
      <el-form label-position="top" @submit.prevent>
        <el-form-item label="新密码（至少 6 位）">
          <el-input v-model="newPassword" type="password" show-password placeholder="输入新密码" />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input v-model="confirmPassword" type="password" show-password placeholder="再输入一次" />
        </el-form-item>
      </el-form>
      <el-button text type="primary" @click="fillRandom">生成随机密码</el-button>
      <template #footer>
        <el-button round @click="resetVisible = false">取消</el-button>
        <el-button type="primary" round :loading="resetting" @click="submitReset">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { get, put } from '../api';
import { authState, fetchMe } from '../auth';

const router = useRouter();
const activeTab = ref('overview');
const usersLoaded = ref(false);
const loading = ref(false);
const statsLoading = ref(false);
const usersLoading = ref(false);
const stats = ref(null);
const users = ref([]);
const isMobile = ref(typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches);

const resetVisible = ref(false);
const resetUser = ref(null);
const newPassword = ref('');
const confirmPassword = ref('');
const resetting = ref(false);

const monthMax = computed(() => {
  const list = stats.value?.monthly || [];
  let max = 0;
  for (const m of list) max = Math.max(max, m.users || 0, m.trips || 0);
  return max;
});

function onMq(e) { isMobile.value = e.matches; }

function formatTime(t) {
  if (!t) return '—';
  return String(t).replace('T', ' ').slice(0, 19);
}

function formatKm(n) {
  if (n == null) return '—';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万 km`;
  return `${n} km`;
}

function formatMoney(n) {
  if (n == null) return '¥0';
  if (n >= 10000) return `¥${(n / 10000).toFixed(1)}万`;
  return `¥${Number(n).toLocaleString('zh-CN')}`;
}

function barPct(n) {
  const max = monthMax.value || 1;
  const pct = Math.max(6, Math.round(((n || 0) / max) * 100));
  return `${n ? pct : 0}%`;
}

function randomPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function fillRandom() {
  const p = randomPassword();
  newPassword.value = p;
  confirmPassword.value = p;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(p).then(() => {
      ElMessage.success('已生成并复制到剪贴板');
    }).catch(() => {
      ElMessage.info(`随机密码：${p}`);
    });
  } else {
    ElMessage.info(`随机密码：${p}`);
  }
}

function openReset(row) {
  resetUser.value = row;
  newPassword.value = '';
  confirmPassword.value = '';
  resetVisible.value = true;
}

function onResetClosed() {
  resetUser.value = null;
  newPassword.value = '';
  confirmPassword.value = '';
}

async function submitReset() {
  if (!resetUser.value) return;
  if (!newPassword.value || newPassword.value.length < 6) {
    return ElMessage.error('新密码至少 6 位');
  }
  if (newPassword.value !== confirmPassword.value) {
    return ElMessage.error('两次输入的新密码不一致');
  }
  resetting.value = true;
  try {
    const data = await put(`/api/admin/users/${resetUser.value.id}/password`, {
      newPassword: newPassword.value,
    });
    ElMessage.success(`已重置「${data.username}」的密码`);
    resetVisible.value = false;
    if (data.selfReset) {
      ElMessage.warning('当前账号密码已重置，请重新登录');
      setTimeout(() => { location.href = '/login'; }, 800);
    }
  } catch (_) { /* api 已提示 */ } finally {
    resetting.value = false;
  }
}

async function loadStats() {
  statsLoading.value = true;
  try {
    stats.value = await get('/api/admin/stats');
  } catch (_) {
    stats.value = null;
  } finally {
    statsLoading.value = false;
  }
}

async function refreshAll() {
  loading.value = true;
  try {
    if (activeTab.value === 'overview') {
      await loadStats();
    } else {
      await loadUsers();
    }
  } finally {
    loading.value = false;
  }
}

async function switchToUsers() {
  activeTab.value = 'users';
  if (!usersLoaded.value) await loadUsers();
}

async function loadUsers() {
  usersLoading.value = true;
  try {
    users.value = await get('/api/admin/users');
    usersLoaded.value = true;
  } catch (_) {
    users.value = [];
  } finally {
    usersLoading.value = false;
  }
}

onMounted(async () => {
  const mq = window.matchMedia('(max-width: 768px)');
  mq.addEventListener('change', onMq);
  try {
    await fetchMe();
  } catch (_) {
    return;
  }
  if (authState.isGuest || authState.username !== 'admin') {
    ElMessage.error('仅管理员可访问');
    router.replace('/');
    return;
  }
  await loadStats();
});

onBeforeUnmount(() => {
  window.matchMedia('(max-width: 768px)').removeEventListener('change', onMq);
});
</script>

<style scoped>
.admin-page { min-height: 100vh; min-height: 100dvh; }
.top-nav {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  background: rgba(255, 253, 247, 0.88); backdrop-filter: blur(8px);
  border-bottom: 2px solid #fff; padding: 12px 24px;
  padding-top: calc(12px + var(--safe-top));
  position: sticky; top: 0; z-index: 800;
}
.top-nav-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
.nav-link { color: #E76F51; text-decoration: none; font-size: 14px; font-weight: 600; white-space: nowrap; }
.nav-title { font-size: 19px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-info { display: flex; align-items: center; gap: 8px; }
.user-capsule {
  font-size: 13px; color: var(--brand-sub); cursor: pointer;
  padding: 4px 10px; border-radius: 999px; background: rgba(231, 111, 81, 0.08);
}

.admin-hero { margin-bottom: 14px; }
.admin-title { margin: 0 0 6px; font-size: 22px; font-weight: 800; color: var(--brand-ink); }
.admin-sub { margin: 0; font-size: 14px; color: var(--brand-sub); }

.tab-switch {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 16px;
  background: rgba(61, 41, 20, 0.06);
  border-radius: 12px;
}
.tab-btn {
  border: 0;
  background: transparent;
  color: var(--brand-sub);
  font-size: 14px;
  font-weight: 700;
  padding: 8px 16px;
  border-radius: 9px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.tab-btn.active {
  background: #fff;
  color: var(--brand-ink);
  box-shadow: 0 1px 4px rgba(61, 41, 20, 0.08);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.stat-tile {
  background: var(--brand-cream);
  border: 2px solid #fff;
  border-radius: 16px;
  padding: 16px 18px;
  box-shadow: 0 2px 10px rgba(61, 41, 20, 0.04);
}
.stat-label { font-size: 13px; color: var(--brand-sub); font-weight: 600; margin-bottom: 6px; }
.stat-num { font-size: 28px; font-weight: 800; color: var(--brand-ink); letter-spacing: -0.02em; line-height: 1.1; }
.stat-foot { margin-top: 8px; font-size: 12px; color: var(--brand-sub); line-height: 1.4; }

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}
.admin-card {
  border-radius: 16px; border: 2px solid #fff;
  background: var(--brand-cream);
}
.card-head {
  font-size: 15px; font-weight: 700; margin-bottom: 12px; color: var(--brand-ink);
}

.metric-list { display: flex; flex-direction: column; gap: 10px; }
.metric-row {
  display: flex; align-items: baseline; gap: 10px;
  padding-bottom: 8px; border-bottom: 1px dashed var(--brand-line);
  font-size: 14px;
}
.metric-row:last-child { border-bottom: 0; padding-bottom: 0; }
.metric-row span { color: var(--brand-sub); flex: 1; }
.metric-row strong { font-size: 16px; font-weight: 800; color: var(--brand-ink); }
.metric-row em { font-style: normal; font-size: 12px; color: var(--brand-sub); }

.month-bars { display: flex; flex-direction: column; gap: 10px; }
.month-row { display: flex; align-items: center; gap: 8px; }
.month-label { width: 36px; font-size: 12px; color: var(--brand-sub); flex-shrink: 0; }
.month-track {
  flex: 1; display: flex; flex-direction: column; gap: 3px;
  min-width: 0;
}
.bar { height: 7px; border-radius: 4px; min-width: 0; transition: width 0.25s ease; }
.bar-users { background: #E76F51; }
.bar-trips { background: #2A9D8F; }
.month-nums { width: 48px; text-align: right; font-size: 11px; color: var(--brand-sub); flex-shrink: 0; }
.month-legend {
  display: flex; gap: 14px; margin-top: 6px; font-size: 12px; color: var(--brand-sub);
}
.month-legend .dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  margin-right: 5px; vertical-align: middle;
}
.dot.users { background: #E76F51; }
.dot.trips { background: #2A9D8F; }

.rank-list { display: flex; flex-direction: column; gap: 8px; }
.rank-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; background: #fff; border-radius: 10px;
  border: 1px solid var(--brand-line);
}
.rank-idx {
  width: 22px; height: 22px; border-radius: 50%;
  background: rgba(231, 111, 81, 0.12); color: #E76F51;
  font-size: 12px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.rank-name { font-weight: 700; font-size: 14px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-val { font-size: 13px; color: var(--brand-sub); flex-shrink: 0; }
.recent-trip .trip-main { min-width: 0; flex: 1; }
.trip-meta { display: block; font-size: 12px; color: var(--brand-sub); margin-top: 2px; font-weight: 400; }
.empty-mini { text-align: center; color: var(--brand-sub); padding: 18px 0; font-size: 13px; }

.toolbar {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.count { font-size: 14px; color: var(--brand-sub); font-weight: 600; }
.uname { font-weight: 700; }
.admin-tag { margin-left: 8px; vertical-align: middle; }
.reset-hint { margin: 0 0 12px; font-size: 13px; color: var(--brand-sub); line-height: 1.5; }

.users-table { width: 100%; }
.mobile-only { display: none; }
.desktop-only { display: block; }

.user-list { display: flex; flex-direction: column; gap: 10px; }
.user-item {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 14px; background: #fff; border: 1px solid var(--brand-line);
  border-radius: 12px;
}
.user-item-name { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.user-item-meta { font-size: 12px; color: var(--brand-sub); }
.empty { text-align: center; color: var(--brand-sub); padding: 24px 0; font-size: 14px; }

@media (max-width: 900px) {
  .stat-grid { grid-template-columns: 1fr 1fr; }
  .two-col { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .top-nav {
    padding: 10px 12px;
    padding-top: calc(10px + var(--safe-top));
  }
  .nav-title { font-size: 16px; }
  .admin-title { font-size: 20px; }
  .stat-num { font-size: 24px; }
  .desktop-only { display: none; }
  .mobile-only { display: block; }
}
@media (max-width: 400px) {
  .stat-grid { grid-template-columns: 1fr; }
}
</style>
