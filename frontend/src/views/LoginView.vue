<template>
  <div class="login-page">
    <div class="login-card">
      <!-- 卡通场景：小动物们结伴出行（SVG 原样迁移自旧 public/login.html） -->
      <svg class="login-scene" viewBox="0 0 400 190" aria-hidden="true">
        <!-- 太阳 -->
        <g class="sun" transform="translate(338,40)">
          <g class="sun-rays" stroke="#F5B84C" stroke-width="3" stroke-linecap="round">
            <line x1="0" y1="-26" x2="0" y2="-32"/><line x1="18" y1="-18" x2="23" y2="-23"/>
            <line x1="26" y1="0" x2="32" y2="0"/><line x1="18" y1="18" x2="23" y2="23"/>
            <line x1="-18" y1="-18" x2="-23" y2="-23"/><line x1="-26" y1="0" x2="-32" y2="0"/>
            <line x1="-18" y1="18" x2="-23" y2="23"/><line x1="0" y1="26" x2="0" y2="32"/>
          </g>
          <circle r="17" fill="#FFD66B" stroke="#F5B84C" stroke-width="2.5"/>
          <circle cx="-5" cy="-3" r="1.8" fill="#4A4039"/><circle cx="5" cy="-3" r="1.8" fill="#4A4039"/>
          <path d="M-5,3 Q0,7 5,3" stroke="#4A4039" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        </g>

        <!-- 云 -->
        <g class="cloud cloud-a" fill="#ffffff" opacity="0.95">
          <circle cx="60" cy="42" r="11"/><circle cx="74" cy="36" r="14"/><circle cx="89" cy="43" r="10"/>
          <rect x="58" y="42" width="34" height="11" rx="5"/>
        </g>
        <g class="cloud cloud-b" fill="#ffffff" opacity="0.85">
          <circle cx="180" cy="26" r="8"/><circle cx="190" cy="21" r="10"/><circle cx="201" cy="27" r="7"/>
          <rect x="178" y="26" width="25" height="8" rx="4"/>
        </g>

        <!-- 远山 -->
        <ellipse cx="80" cy="158" rx="90" ry="26" fill="#A8D5A2"/>
        <ellipse cx="330" cy="162" rx="100" ry="30" fill="#93C98D"/>

        <!-- 草地 + 小路 -->
        <rect x="0" y="150" width="400" height="40" fill="#7FB069"/>
        <path d="M0,176 Q200,158 400,178 L400,190 L0,190 Z" fill="#D9C7A7"/>
        <path d="M0,182 Q200,164 400,184" stroke="#FFFDF7" stroke-width="2.5" stroke-dasharray="10 9" fill="none"/>

        <!-- 小花 -->
        <g class="flower"><line x1="30" y1="158" x2="30" y2="166" stroke="#5D8A4A" stroke-width="1.5"/><circle cx="30" cy="156" r="3.5" fill="#F8C8D0"/></g>
        <g class="flower"><line x1="368" y1="156" x2="368" y2="164" stroke="#5D8A4A" stroke-width="1.5"/><circle cx="368" cy="154" r="3.5" fill="#FFD66B"/></g>

        <!-- 小熊（领队，举旗） -->
        <g transform="translate(118,116)"><g class="animal animal-1">
          <rect x="-27" y="6" width="13" height="17" rx="4" fill="#E76F51"/>
          <ellipse cx="0" cy="18" rx="17" ry="15" fill="#B08968"/>
          <ellipse cx="-8" cy="31" rx="5" ry="3" fill="#8F6B4F"/><ellipse cx="8" cy="31" rx="5" ry="3" fill="#8F6B4F"/>
          <circle cx="-6" cy="-16" r="4.5" fill="#B08968"/><circle cx="10" cy="-16" r="4.5" fill="#B08968"/>
          <circle cx="-6" cy="-16" r="2" fill="#E8C9A8"/><circle cx="10" cy="-16" r="2" fill="#E8C9A8"/>
          <circle cx="2" cy="-6" r="12.5" fill="#B08968"/>
          <ellipse cx="4" cy="-1" rx="6" ry="4.5" fill="#E8C9A8"/>
          <circle cx="4" cy="-3.5" r="1.8" fill="#4A4039"/>
          <circle cx="-2" cy="-8" r="1.6" fill="#4A4039"/><circle cx="8" cy="-8" r="1.6" fill="#4A4039"/>
          <line x1="15" y1="8" x2="15" y2="-16" stroke="#8F6B4F" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M15,-16 L33,-10 L15,-4 Z" fill="#FFD66B"/>
        </g></g>

        <!-- 兔子 -->
        <g transform="translate(188,124)"><g class="animal animal-2">
          <rect x="-19" y="5" width="10" height="13" rx="3" fill="#7EC8E3"/>
          <ellipse cx="-3" cy="-19" rx="3.5" ry="10" fill="#FFFDF7" stroke="#EAD9C2" stroke-width="1.2" transform="rotate(-8 -3 -19)"/>
          <ellipse cx="6" cy="-19" rx="3.5" ry="10" fill="#FFFDF7" stroke="#EAD9C2" stroke-width="1.2" transform="rotate(7 6 -19)"/>
          <ellipse cx="-3" cy="-19" rx="1.6" ry="6" fill="#F8C8D0" transform="rotate(-8 -3 -19)"/>
          <ellipse cx="0" cy="15" rx="13" ry="12" fill="#FFFDF7" stroke="#EAD9C2" stroke-width="1.2"/>
          <ellipse cx="-6" cy="25" rx="4.5" ry="2.8" fill="#F0E6D8"/><ellipse cx="7" cy="25" rx="4.5" ry="2.8" fill="#F0E6D8"/>
          <circle cx="2" cy="-5" r="10" fill="#FFFDF7" stroke="#EAD9C2" stroke-width="1.2"/>
          <circle cx="-1" cy="-7" r="1.5" fill="#4A4039"/><circle cx="6" cy="-7" r="1.5" fill="#4A4039"/>
          <path d="M2,-4 L3.5,-2.5 L2,-1.5 Z" fill="#F8A5B8"/>
        </g></g>

        <!-- 猫咪 -->
        <g transform="translate(248,127)"><g class="animal animal-3">
          <path d="M-13,18 Q-23,14 -21,3" stroke="#F4A261" stroke-width="4.5" fill="none" stroke-linecap="round"/>
          <rect x="-20" y="6" width="10" height="12" rx="3" fill="#7FB069"/>
          <ellipse cx="0" cy="15" rx="13" ry="11" fill="#F4A261"/>
          <ellipse cx="-6" cy="24" rx="4.5" ry="2.8" fill="#E8955A"/><ellipse cx="7" cy="24" rx="4.5" ry="2.8" fill="#E8955A"/>
          <path d="M-6,-13 L-3,-22 L1,-14 Z" fill="#F4A261"/><path d="M5,-14 L9,-22 L12,-13 Z" fill="#F4A261"/>
          <circle cx="2" cy="-5" r="10" fill="#F4A261"/>
          <circle cx="-1" cy="-7" r="1.5" fill="#4A4039"/><circle cx="6" cy="-7" r="1.5" fill="#4A4039"/>
          <path d="M2,-4 L3.5,-2.5 L2,-1.5 Z" fill="#E76F51"/>
          <line x1="-9" y1="-4" x2="-14" y2="-5" stroke="#4A4039" stroke-width="0.9"/>
          <line x1="13" y1="-4" x2="18" y2="-5" stroke="#4A4039" stroke-width="0.9"/>
        </g></g>

        <!-- 小企鹅（拉着行李箱） -->
        <g transform="translate(304,132)"><g class="animal animal-4">
          <ellipse cx="0" cy="12" rx="10" ry="12" fill="#3A4454"/>
          <ellipse cx="0" cy="15" rx="6" ry="8" fill="#FFFDF7"/>
          <circle cx="-3" cy="4" r="1.4" fill="#FFFDF7"/><circle cx="3" cy="4" r="1.4" fill="#FFFDF7"/>
          <circle cx="-3" cy="4" r="0.7" fill="#4A4039"/><circle cx="3" cy="4" r="0.7" fill="#4A4039"/>
          <path d="M-2,7 L2,7 L0,9.5 Z" fill="#F4A261"/>
          <ellipse cx="-4" cy="24" rx="3.5" ry="2" fill="#F4A261"/><ellipse cx="4" cy="24" rx="3.5" ry="2" fill="#F4A261"/>
          <line x1="9" y1="12" x2="14" y2="16" stroke="#8a7f72" stroke-width="1.5"/>
          <rect x="13" y="12" width="13" height="10" rx="2.5" fill="#E76F51"/>
          <line x1="16" y1="12" x2="16" y2="9" stroke="#8a7f72" stroke-width="1.5"/>
          <line x1="23" y1="12" x2="23" y2="9" stroke="#8a7f72" stroke-width="1.5"/>
          <circle cx="17" cy="23.5" r="1.6" fill="#4A4039"/><circle cx="23" cy="23.5" r="1.6" fill="#4A4039"/>
        </g></g>
      </svg>

      <h1 class="login-title">结伴出行</h1>
      <p class="login-subtitle">小动物们都准备好了，一起出发吧</p>

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
        <p class="guest-hint">游客可浏览 admin 的旅行地图（只读）</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue';
import { ElMessage } from 'element-plus';

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
  display: block; width: 100%; height: auto;
  background: linear-gradient(180deg, #BEE6F7 0%, #E8F6FB 62%, #D9EDCF 100%);
}

/* 动效：小动物蹦跶 + 云朵漂移 + 太阳光芒（reduced-motion 下静止） */
@keyframes animal-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
.animal { animation: animal-bob 2.4s ease-in-out infinite; }
.animal-2 { animation-delay: 0.35s; }
.animal-3 { animation-delay: 0.7s; }
.animal-4 { animation-delay: 1.05s; }

@keyframes cloud-drift {
  from { transform: translateX(-90px); }
  to { transform: translateX(470px); }
}
.cloud { animation: cloud-drift 38s linear infinite; }
.cloud-b { animation-duration: 55s; animation-delay: -18s; }

@keyframes sun-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
.sun-rays { animation: sun-spin 60s linear infinite; transform-origin: 0 0; }

@media (prefers-reduced-motion: reduce) {
  .animal, .cloud, .sun-rays { animation: none; }
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

.guest-hint { text-align: center; color: #B9AE9F; font-size: 12px; margin: 10px 0 0; }
</style>
