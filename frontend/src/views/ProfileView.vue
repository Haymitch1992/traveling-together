<template>
  <div class="profile-page">
    <nav class="top-nav">
      <div class="top-nav-left">
        <router-link to="/" class="nav-link">← 旅行地图</router-link>
        <span class="nav-title">个人资料</span>
      </div>
      <div class="user-info">
        <span class="current-user">{{ authState.isGuest ? '游客' : authState.username }}</span>
        <el-button size="small" text @click="logout">退出</el-button>
      </div>
    </nav>

    <main class="page-main">
      <el-card v-if="authState.isGuest" class="profile-card">
        <el-empty description="游客模式没有账号资料，注册账号后即可编辑" />
      </el-card>

      <template v-else>
        <el-card class="profile-card">
          <div class="card-title">账号信息</div>
          <div class="account-row">
            <span class="avatar">{{ authState.username.slice(0, 1) }}</span>
            <div>
              <div class="account-name">{{ authState.username }}</div>
              <div class="account-email">{{ profile?.email || '未绑定邮箱' }}</div>
            </div>
          </div>
        </el-card>

        <el-card class="profile-card">
          <div class="card-title">出发城市</div>
          <div class="search-box">
            <el-input
              v-model="homeQuery"
              placeholder="搜索并选择你的常住城市"
              clearable
              @input="onHomeInput"
            />
            <ul v-if="showResults" class="search-results">
              <li v-if="!results.length" class="search-none">未找到匹配的城市</li>
              <li v-for="c in results" :key="c.name + c.lat" @click="pickHome(c)">
                <strong>{{ c.name }}</strong>
                <em v-if="c.name_en"> {{ c.name_en }}</em>
                <span class="search-country">· {{ c.country }}</span>
              </li>
            </ul>
          </div>
        </el-card>

        <el-card class="profile-card">
          <div class="card-title">修改密码</div>
          <el-form label-position="top" @submit.prevent>
            <el-form-item label="原密码">
              <el-input v-model="pwd.old" type="password" show-password />
            </el-form-item>
            <el-form-item label="新密码（至少 6 位）">
              <el-input v-model="pwd.next" type="password" show-password />
            </el-form-item>
            <el-form-item label="确认新密码">
              <el-input v-model="pwd.confirm" type="password" show-password />
            </el-form-item>
            <el-button type="primary" round :loading="saving" @click="changePassword">保存新密码</el-button>
          </el-form>
        </el-card>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { ElMessage } from 'element-plus';
import { get, put } from '../api';
import { authState, fetchMe, logout } from '../auth';

const profile = ref(null);
const homeQuery = ref('');
const results = ref([]);
const showResults = ref(false);
const pwd = ref({ old: '', next: '', confirm: '' });
const saving = ref(false);

let timer = null;
function onHomeInput(v) {
  const q = (v || '').trim();
  if (!q) { showResults.value = false; return; }
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      results.value = await get(`/api/cities/search?q=${encodeURIComponent(q)}`);
      showResults.value = true;
    } catch (_) { /* 已提示 */ }
  }, 300);
}

async function pickHome(c) {
  showResults.value = false;
  try {
    profile.value = await put('/api/profile', { home_name: c.name, home_lat: c.lat, home_lng: c.lng });
    homeQuery.value = c.name;
    ElMessage.success(`出发城市已设为 ${c.name}`);
  } catch (_) { /* 已提示 */ }
}

function onDocClick(e) {
  if (!e.target.closest('.search-box')) showResults.value = false;
}

async function changePassword() {
  if (!pwd.value.old) return ElMessage.error('请输入原密码');
  if (!pwd.value.next || pwd.value.next.length < 6) return ElMessage.error('新密码至少 6 位');
  if (pwd.value.next !== pwd.value.confirm) return ElMessage.error('两次输入的新密码不一致');
  saving.value = true;
  try {
    await put('/api/auth/password', { oldPassword: pwd.value.old, newPassword: pwd.value.next });
    ElMessage.success('密码已更新，其他设备的登录已失效');
    pwd.value = { old: '', next: '', confirm: '' };
  } catch (_) { /* 已提示 */ } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await fetchMe();
  if (!authState.isGuest) {
    try {
      profile.value = await get('/api/profile');
      homeQuery.value = profile.value.home_name || '';
    } catch (_) { /* 已提示 */ }
  }
  document.addEventListener('click', onDocClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick);
  clearTimeout(timer);
});
</script>

<style scoped>
.profile-page { min-height: 100vh; }
.top-nav {
  display: flex; align-items: center; justify-content: space-between;
  background: rgba(255, 253, 247, 0.88); backdrop-filter: blur(8px);
  border-bottom: 2px solid #fff; padding: 12px 24px;
  position: sticky; top: 0; z-index: 800;
}
.top-nav-left { display: flex; align-items: center; gap: 14px; }
.nav-link { color: #E76F51; text-decoration: none; font-size: 14px; font-weight: 600; }
.nav-title { font-size: 19px; font-weight: 700; }
.user-info { display: flex; align-items: center; gap: 6px; }
.current-user { font-size: 13px; color: var(--brand-sub); }

.profile-card {
  border-radius: 16px; border: 2px solid #fff; margin-bottom: 16px;
  background: var(--brand-cream);
}
.card-title { font-size: 17px; font-weight: 700; margin-bottom: 14px; }
.account-row { display: flex; align-items: center; gap: 14px; }
.avatar {
  width: 52px; height: 52px; border-radius: 50%;
  background: linear-gradient(135deg, #fbbf24, #ea580c);
  color: #fff; font-size: 22px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.account-name { font-size: 18px; font-weight: 700; }
.account-email { font-size: 13px; color: var(--brand-sub); margin-top: 2px; }

.search-box { position: relative; max-width: 360px; }
.search-results {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 500;
  background: #fff; border: 1px solid var(--brand-line); margin: 0; padding: 0;
  border-radius: 10px; box-shadow: 0 8px 24px rgba(74, 64, 57, 0.12);
  list-style: none; max-height: 260px; overflow-y: auto;
}
.search-results li { padding: 10px 14px; font-size: 14px; cursor: pointer; }
.search-results li:hover { background: #fce9e3; }
.search-results em { font-style: normal; color: var(--brand-sub); font-size: 13px; }
.search-country { color: var(--brand-sub); font-size: 13px; }
.search-none { color: var(--brand-sub); cursor: default !important; }
</style>
