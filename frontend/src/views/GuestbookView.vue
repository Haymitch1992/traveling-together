<template>
  <div class="guestbook-page">
    <nav class="top-nav">
      <div class="top-nav-left">
        <router-link to="/" class="nav-link">← 旅行地图</router-link>
        <span class="nav-title">留言板</span>
      </div>
      <div class="user-info">
        <span class="user-capsule" @click="router.push('/profile')">{{ authState.isGuest ? '游客' : authState.username }}</span>
      </div>
    </nav>

    <main class="page-main">
      <section class="gb-hero">
        <h1 class="gb-title">给作者留个言</h1>
        <p class="gb-sub">说点旅途想法、建议或问候，会直接发到作者邮箱</p>
      </section>

      <section class="gb-form-card">
        <label>
          <span class="field-label">你的昵称</span>
          <el-input v-model="form.name" maxlength="20" placeholder="怎么称呼你" clearable />
        </label>
        <label>
          <span class="field-label">联系方式（选填）</span>
          <el-input v-model="form.contact" maxlength="80" placeholder="邮箱或微信号，方便作者回复" clearable />
        </label>
        <label>
          <span class="field-label">留言内容</span>
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="5"
            maxlength="500"
            show-word-limit
            placeholder="想对作者说的话…"
          />
        </label>
        <el-button
          type="primary"
          round
          size="large"
          class="gb-submit"
          :loading="sending"
          @click="submit"
        >发送给作者</el-button>
      </section>

      <section class="gb-board">
        <div class="gb-board-head">
          <h2>墙上的留言</h2>
          <span v-if="messages.length">共 {{ messages.length }} 条</span>
        </div>
        <div v-if="!messages.length" class="gb-empty">还没有留言，来写第一条吧</div>
        <div v-else class="gb-list">
          <article
            v-for="(m, i) in messages"
            :key="m.id"
            class="gb-item"
            :style="{ '--delay': (i * 0.04) + 's' }"
          >
            <img class="gb-avatar" :src="animalIconFor(m.name)" :alt="m.name" draggable="false" />
            <div class="gb-body">
              <div class="gb-meta">
                <strong>{{ m.name }}</strong>
                <time>{{ formatTime(m.created_at) }}</time>
              </div>
              <p class="gb-content">{{ m.content }}</p>
            </div>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { get, post } from '../api';
import { authState, fetchMe } from '../auth';
import { animalIconFor } from '../animals';

const router = useRouter();
const messages = ref([]);
const sending = ref(false);
const form = reactive({ name: '', contact: '', content: '' });

function formatTime(s) {
  if (!s) return '';
  return String(s).replace('T', ' ').slice(0, 16);
}

async function loadMessages() {
  try {
    messages.value = await get('/api/guestbook');
  } catch (_) { /* 已提示 */ }
}

async function submit() {
  const name = form.name.trim();
  const contact = form.contact.trim();
  const content = form.content.trim();
  if (!name) return ElMessage.error('请填写昵称');
  if (!content) return ElMessage.error('请填写留言内容');
  sending.value = true;
  try {
    const row = await post('/api/guestbook', { name, contact, content });
    form.content = '';
    messages.value = [row, ...messages.value.filter((m) => m.id !== row.id)];
    if (row.mailed === false && row.devMode) {
      ElMessage.success('留言已保存（开发模式：邮件仅打印到控制台）');
    } else if (row.mailed === false) {
      ElMessage.warning(row.error || '留言已保存，邮件通知可能延迟');
    } else {
      ElMessage.success('已发送到作者邮箱，谢谢你的留言！');
    }
  } catch (_) { /* 已提示 */ } finally {
    sending.value = false;
  }
}

onMounted(async () => {
  try { await fetchMe(); } catch (_) { /* ignore */ }
  if (!authState.isGuest && authState.username && !form.name) {
    form.name = authState.username;
  }
  await loadMessages();
});
</script>

<style scoped>
.guestbook-page { min-height: 100vh; min-height: 100dvh; }

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
.nav-title { font-size: 19px; font-weight: 700; color: var(--brand-ink); }
.user-capsule {
  background: #fff; border: 1px solid var(--brand-line); border-radius: 999px;
  padding: 4px 14px; font-size: 13px; font-weight: 600; color: var(--brand-sub); cursor: pointer;
}

.page-main { max-width: 640px; margin: 0 auto; padding: 20px 16px calc(48px + var(--safe-bottom)); }

.gb-hero {
  margin-bottom: 16px;
  padding: 20px 18px;
  border-radius: 22px;
  border: 2.5px dashed #E8D4B0;
  background:
    radial-gradient(ellipse 70% 60% at 10% 0%, rgba(255, 214, 170, 0.45), transparent 55%),
    radial-gradient(ellipse 60% 50% at 95% 10%, rgba(186, 220, 240, 0.35), transparent 50%),
    linear-gradient(165deg, #FFF9EE, #F7EBD2);
}
.gb-title {
  margin: 0;
  font-family: 'KaiTi', 'STKaiti', 'Songti SC', 'PingFang SC', serif;
  font-size: 28px; font-weight: 700; color: #5C4A3A; letter-spacing: 0.04em;
}
.gb-sub { margin: 8px 0 0; font-size: 14px; color: #9A8468; line-height: 1.5; }

.gb-form-card {
  display: flex; flex-direction: column; gap: 12px;
  background: var(--brand-cream);
  border: 2px solid #fff; border-radius: 20px;
  box-shadow: 0 10px 30px rgba(74, 64, 57, 0.08);
  padding: 18px 16px; margin-bottom: 18px;
}
.gb-form-card label { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 13px; font-weight: 600; color: var(--brand-sub); }
.gb-submit {
  margin-top: 4px; font-weight: 700; letter-spacing: 1px;
  min-height: 46px; box-shadow: 0 4px 12px rgba(231, 111, 81, 0.3);
}

.gb-board {
  padding: 16px;
  border-radius: 20px;
  border: 2px solid #fff;
  background: rgba(255, 253, 247, 0.85);
  box-shadow: 0 8px 24px rgba(74, 64, 57, 0.06);
}
.gb-board-head {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 12px;
}
.gb-board-head h2 {
  margin: 0;
  font-family: 'KaiTi', 'STKaiti', 'Songti SC', serif;
  font-size: 20px; color: #5C4A3A;
}
.gb-board-head span { font-size: 12px; color: #9A8468; }
.gb-empty { text-align: center; color: var(--brand-sub); font-size: 14px; padding: 28px 0; }
.gb-list { display: flex; flex-direction: column; gap: 10px; }
.gb-item {
  display: flex; gap: 12px;
  padding: 12px;
  border-radius: 16px;
  background: #FFFDF8;
  border: 1.5px solid #F0E2C8;
  animation: gb-rise 0.4s ease both;
  animation-delay: var(--delay, 0s);
}
.gb-avatar {
  width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%;
  object-fit: cover; object-position: center center;
  background: #fff; box-shadow: 0 0 0 2px #fff, 0 2px 6px rgba(74, 64, 57, 0.12);
}
.gb-body { min-width: 0; flex: 1; }
.gb-meta {
  display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
  margin-bottom: 4px;
}
.gb-meta strong { font-size: 14px; color: var(--brand-ink); }
.gb-meta time { font-size: 12px; color: #B9AE9F; flex-shrink: 0; }
.gb-content {
  margin: 0; font-size: 14px; line-height: 1.6; color: var(--brand-ink);
  white-space: pre-wrap; word-break: break-word;
}

@keyframes gb-rise {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .gb-item { animation: none; }
}

@media (max-width: 768px) {
  .top-nav { padding: 10px 12px; padding-top: calc(10px + var(--safe-top)); }
  .nav-title { font-size: 16px; }
  .page-main { padding: 14px 12px calc(40px + var(--safe-bottom)); }
  .gb-title { font-size: 24px; }
  .gb-submit { width: 100%; }
}
</style>
