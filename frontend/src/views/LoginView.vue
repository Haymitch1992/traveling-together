<template>
  <div class="login-page">
    <div class="login-card">
      <!-- 手绘风：小动物排队结伴出行 -->
      <div class="login-scene">
        <img
          class="login-scene-img"
          :src="sceneImg"
          alt="小动物排队出发"
          width="800"
          height="450"
        />
      </div>

      <h1 class="login-title">结伴出行</h1>
      <p class="login-subtitle">小动物们排好队了，一起出发吧</p>

      <div class="login-body">
        <form autocomplete="off" @submit.prevent="onSubmit">
          <el-input
            v-model="username"
            class="login-input"
            placeholder="用户名"
            maxlength="20"
            size="large"
          />
          <template v-if="mode === 'register'">
            <el-input
              v-model="email"
              class="login-input"
              placeholder="邮箱"
              maxlength="50"
              size="large"
            />
            <div class="code-row">
              <el-input
                v-model="code"
                class="login-input code-input"
                placeholder="6 位验证码"
                maxlength="6"
                size="large"
              />
              <el-button
                class="send-code-btn"
                size="large"
                :disabled="countdown > 0 || sending"
                :loading="sending"
                @click="sendCode"
              >
                {{ countdown > 0 ? countdown + 's 后重发' : '发送验证码' }}
              </el-button>
            </div>
          </template>
          <el-input
            v-model="password"
            class="login-input"
            type="password"
            placeholder="密码（至少 6 位）"
            size="large"
            show-password
          />
          <el-button
            class="submit-btn"
            type="primary"
            native-type="submit"
            size="large"
            :loading="submitting"
          >
            {{ mode === 'login' ? '登 录' : '注 册' }}
          </el-button>
        </form>

        <div class="login-switch">
          <span>{{ mode === 'login' ? '没有账号？' : '已有账号？' }}</span>
          <a href="javascript:void(0)" @click="toggleMode">{{ mode === 'login' ? '去注册' : '去登录' }}</a>
        </div>

        <div class="login-divider"><span>或</span></div>

        <el-button class="guest-btn" size="large" :loading="guesting" @click="enterAsGuest">
          游客进入 · 先看看
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue';
import { ElMessage } from 'element-plus';
import sceneImg from '../assets/animals-queue-handdrawn.png';

// 本页是 public 页面，直接 fetch（不走 api.js，避免 401 自动跳回 /login 死循环）
const mode = ref('login'); // login | register
const username = ref('');
const email = ref('');
const code = ref('');
const password = ref('');

const submitting = ref(false);
const sending = ref(false);
const guesting = ref(false);
const countdown = ref(0);
let countdownTimer = null;

onBeforeUnmount(() => {
  if (countdownTimer) clearInterval(countdownTimer);
});

function toggleMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login';
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function sendCode() {
  const mail = email.value.trim();
  if (!mail) { ElMessage.error('请先填写邮箱'); return; }
  sending.value = true;
  try {
    const { res, data } = await postJson('/api/auth/send-code', { email: mail });
    if (!res.ok) { ElMessage.error(data.error || '发送失败'); return; }
    if (data.devMode) ElMessage.warning('SMTP 未配置，验证码在服务器控制台');
    countdown.value = 60;
    countdownTimer = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
    }, 1000);
  } catch (err) {
    console.error(err);
    ElMessage.error('网络错误，请确认服务已启动');
  } finally {
    sending.value = false;
  }
}

async function onSubmit() {
  const name = username.value.trim();
  const pwd = password.value;
  if (!name) { ElMessage.error('请填写用户名'); return; }
  if (!pwd || pwd.length < 6) { ElMessage.error('密码至少 6 位'); return; }
  const payload = { username: name, password: pwd };
  if (mode.value === 'register') {
    payload.email = email.value.trim();
    payload.code = code.value.trim();
    if (!payload.email) { ElMessage.error('请填写邮箱'); return; }
    if (!/^\d{6}$/.test(payload.code)) { ElMessage.error('请填写 6 位验证码'); return; }
  }
  submitting.value = true;
  try {
    const { res, data } = await postJson('/api/auth/' + mode.value, payload);
    if (!res.ok) { ElMessage.error(data.error || '操作失败'); return; }
    location.href = '/';
  } catch (err) {
    console.error(err);
    ElMessage.error('网络错误，请确认服务已启动');
  } finally {
    submitting.value = false;
  }
}

async function enterAsGuest() {
  guesting.value = true;
  try {
    const { res, data } = await postJson('/api/auth/guest');
    if (!res.ok) { ElMessage.error(data.error || '游客登录失败'); return; }
    location.href = '/';
  } catch (err) {
    console.error(err);
    ElMessage.error('网络错误，请确认服务已启动');
  } finally {
    guesting.value = false;
  }
}
</script>

<style>
/* 标题字体（全局引入一次即可） */
@import url('https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&display=swap');
</style>

<style scoped>
.login-page {
  display: flex; align-items: center; justify-content: center;
  min-height: 100vh; padding: 24px 0;
  background: var(--brand-bg);
}

.login-card {
  width: 380px; max-width: calc(100vw - 32px);
  background: var(--brand-cream);
  border: 3px solid #ffffff; border-radius: 26px;
  box-shadow: 0 20px 50px rgba(74, 64, 57, 0.18);
  overflow: hidden;
}

.login-scene {
  display: block;
  width: 100%;
  overflow: hidden;
  background: linear-gradient(180deg, #C8E4F2 0%, #EAF4E4 100%);
}
.login-scene-img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  object-position: center 58%;
  animation: scene-breathe 5.5s ease-in-out infinite;
  transform-origin: center bottom;
}
@keyframes scene-breathe {
  0%, 100% { transform: scale(1) translateY(0); }
  50% { transform: scale(1.015) translateY(-2px); }
}
@media (prefers-reduced-motion: reduce) {
  .login-scene-img { animation: none; }
}

.login-title {
  font-family: 'ZCOOL KuaiLe', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 34px; text-align: center; color: var(--brand-ink);
  letter-spacing: 4px; margin: 14px 0 0;
}
.login-subtitle { text-align: center; color: #8A7F72; font-size: 14px; margin: 6px 0 16px; }

.login-body { padding: 0 32px 26px; }

.login-input { margin-bottom: 12px; }
.login-input :deep(.el-input__wrapper) {
  border-radius: 999px;
  padding: 2px 18px;
  box-shadow: 0 0 0 2px var(--brand-line) inset;
  background: #ffffff;
}
.login-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px #F4A261 inset, 0 0 0 3px rgba(244, 162, 97, 0.2);
}
.login-input :deep(.el-input__inner)::placeholder { color: #B9AE9F; }

.code-row { display: flex; gap: 8px; margin-bottom: 12px; }
.code-row .code-input { flex: 1; margin-bottom: 0; }
.send-code-btn {
  flex-shrink: 0; border-radius: 999px;
  border: 2px solid #F4A261; background: #fff;
  color: #E76F51; font-weight: 600;
}
.send-code-btn:hover:not(:disabled) { background: #FDEFD9; border-color: #F4A261; color: #E76F51; }
.send-code-btn:disabled { border-color: var(--brand-line); color: #B9AE9F; background: #fff; }

.submit-btn {
  width: 100%; border-radius: 999px;
  font-weight: 700; letter-spacing: 2px; font-size: 15px;
}

.login-switch { text-align: center; font-size: 13px; color: #8A7F72; margin-top: 14px; }
.login-switch a { color: #E76F51; text-decoration: none; font-weight: 600; }
.login-switch a:hover { text-decoration: underline; }

.login-divider {
  display: flex; align-items: center; gap: 12px;
  color: #B9AE9F; font-size: 13px; margin: 18px 0;
}
.login-divider::before, .login-divider::after {
  content: ''; flex: 1; height: 1px; background: var(--brand-line);
}

.guest-btn {
  width: 100%; border-radius: 999px; border: none;
  background: #7FB069; color: #ffffff;
  font-weight: 700; letter-spacing: 1px; font-size: 15px;
}
.guest-btn:hover, .guest-btn:focus { background: #6C9C57; color: #ffffff; }

@media (max-width: 480px) {
  .login-page {
    align-items: flex-start;
    min-height: 100dvh;
    padding: calc(12px + var(--safe-top)) 12px calc(20px + var(--safe-bottom));
  }
  .login-card {
    width: 100%;
    max-width: 100%;
    border-radius: 20px;
    border-width: 2px;
  }
  .login-title { font-size: 28px; letter-spacing: 2px; margin-top: 10px; }
  .login-subtitle { font-size: 13px; padding: 0 12px; }
  .login-body { padding: 0 18px 22px; }
  .code-row { flex-direction: column; gap: 10px; }
  .send-code-btn { width: 100%; }
  .login-scene-img { aspect-ratio: 16 / 10; object-position: center 62%; }
}
</style>
