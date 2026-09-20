<template>
  <div class="share-page">
    <nav class="top-nav">
      <div class="top-nav-left">
        <span class="brand">结伴出行</span>
        <span class="nav-badge">只读分享</span>
      </div>
      <router-link to="/login" class="nav-link">去登录</router-link>
    </nav>

    <div v-if="loadError" class="page-main empty-state">{{ loadError }}</div>
    <div v-else-if="!trip" class="page-main empty-state">小动物们正在搬行李…</div>

    <template v-else>
      <!-- 手绘封面：排队出发插画 -->
      <header class="hero-scene">
        <div class="hero-sky">
          <img
            class="hero-illust"
            :src="sceneImg"
            alt="小动物排队出发"
            width="800"
            height="450"
            draggable="false"
          >
        </div>
        <div class="hero-card">
          <p class="hero-from">
            <img class="hero-owner-icon" :src="animalIconFor(trip.ownerName || trip.title)" alt="" draggable="false">
            {{ trip.ownerName ? `${trip.ownerName} 的旅行` : '旅行分享' }}
          </p>
          <h1 class="hero-title">{{ trip.title }}</h1>
          <div class="route-line">
            <span>{{ trip.origin_name || '出发地' }}</span>
            <span class="route-paw" aria-hidden="true">🐾</span>
            <span>{{ destShort }}</span>
          </div>
          <div class="hero-chips">
            <span>{{ trip.depart_date }}</span>
            <span>{{ trip.days }} 天</span>
            <span>{{ trip.transport }}</span>
            <span v-if="trip.distance_km != null">{{ trip.distance_km }} km</span>
          </div>
        </div>
      </header>

      <main class="page-main share-main">
        <!-- 同行小分队 -->
        <section class="board">
          <div class="board-head">
            <div>
              <h2 class="board-title">同行小分队</h2>
              <p class="board-sub">一起出发的伙伴们</p>
            </div>
            <span class="board-total">{{ trip.members?.length || 0 }} 人</span>
          </div>
          <div v-if="!trip.members?.length" class="muted">暂无同行人</div>
          <div v-else class="squad">
            <div
              v-for="(name, i) in trip.members"
              :key="name"
              class="squad-card"
              :style="{ '--delay': (i * 0.06) + 's' }"
            >
              <div class="squad-aura" aria-hidden="true"></div>
              <div class="squad-avatar">
                <div class="squad-avatar-clip">
                  <img :src="animalIconFor(name)" :alt="name" draggable="false">
                </div>
              </div>
              <div class="squad-name">{{ name }}</div>
            </div>
          </div>
        </section>

        <!-- 花费与分摊 -->
        <section class="board">
          <div class="board-head">
            <div>
              <h2 class="board-title">花费与分摊</h2>
              <p class="board-sub">小金库里的账本</p>
            </div>
          </div>
          <div class="stat-row">
            <div class="stat">
              <strong>{{ fmt(trip.settlement?.total) }}</strong>
              <span>总花费</span>
            </div>
            <div class="stat">
              <strong>{{ fmt(trip.settlement?.perPerson) }}</strong>
              <span>人均</span>
            </div>
            <div class="stat">
              <strong>{{ trip.budget != null ? fmt(trip.budget) : '—' }}</strong>
              <span>预算</span>
            </div>
          </div>

          <div v-if="trip.settlement?.transfers?.length" class="transfer-block">
            <div class="transfer-label">转账建议</div>
            <div
              v-for="(t, i) in trip.settlement.transfers"
              :key="i"
              class="transfer-card"
              :style="{ '--delay': (i * 0.05) + 's' }"
            >
              <div class="transfer-who">
                <div class="person">
                  <div class="person-clip">
                    <img :src="animalIconFor(t.from)" :alt="t.from" draggable="false">
                  </div>
                  <span>{{ t.from }}</span>
                  <em>应付</em>
                </div>
                <span class="flow" aria-hidden="true">→</span>
                <div class="person">
                  <div class="person-clip">
                    <img :src="animalIconFor(t.to)" :alt="t.to" draggable="false">
                  </div>
                  <span>{{ t.to }}</span>
                  <em>应收</em>
                </div>
              </div>
              <strong class="amt">{{ fmt(t.amount) }}</strong>
            </div>
          </div>
          <div v-else-if="trip.expenses?.length" class="transfer-ok">
            <img class="ok-icon" :src="animalIconFor('ok')" alt="" draggable="false">
            <span>账目刚好平了，无需转账</span>
          </div>

          <div v-if="!trip.expenses?.length" class="muted">还没有花费记录</div>
          <ul v-else class="expense-list">
            <li v-for="e in trip.expenses" :key="e.id" class="expense-item">
              <img class="expense-avatar" :src="animalIconFor(e.payer)" :alt="e.payer" draggable="false">
              <div class="expense-main">
                <strong>{{ e.payer }}</strong>
                <span class="expense-cat" v-if="e.category">{{ e.category }}</span>
                <span class="expense-note" v-if="e.note">{{ e.note }}</span>
              </div>
              <div class="expense-side">
                <strong>{{ fmt(e.amount) }}</strong>
                <span>{{ e.spent_at }}</span>
              </div>
            </li>
          </ul>
        </section>

        <!-- 行程 -->
        <section class="board">
          <div class="board-head">
            <div>
              <h2 class="board-title">具体行程</h2>
              <p class="board-sub">一天天慢慢逛</p>
            </div>
          </div>
          <div v-if="!itineraryByDay.length" class="muted">还没有填写行程</div>
          <div v-else class="timeline">
            <div v-for="(g, gi) in itineraryByDay" :key="g.day" class="tl-day">
              <div class="tl-marker">
                <img
                  class="tl-animal"
                  :src="animalIconFor(`day-${g.day}`)"
                  alt=""
                  draggable="false"
                >
                <span class="tl-dayno">第 {{ g.day }} 天</span>
              </div>
              <div class="tl-body">
                <div
                  v-for="it in g.items"
                  :key="it.id"
                  class="tl-item"
                  :style="{ '--delay': (gi * 0.04) + 's' }"
                >{{ it.content }}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- 照片 -->
        <section class="board">
          <div class="board-head">
            <div>
              <h2 class="board-title">照片墙</h2>
              <p class="board-sub">旅途中的精彩瞬间</p>
            </div>
            <span v-if="trip.photos?.length" class="board-total">{{ trip.photos.length }}</span>
          </div>
          <div v-if="!trip.photos?.length" class="muted">还没有照片</div>
          <div v-else class="photo-wall">
            <button
              v-for="(p, idx) in trip.photos"
              :key="p.id"
              type="button"
              class="photo-cell"
              @click="openViewer(idx)"
            >
              <img :src="photoUrl(p)" :alt="p.original_name || '照片'" loading="lazy">
            </button>
          </div>
        </section>

        <footer class="share-foot">
          <img class="foot-animal" :src="animalIconFor('foot')" alt="" draggable="false">
          <span>结伴出行 · 小动物们排好队了</span>
        </footer>
      </main>
    </template>

    <el-image-viewer
      v-if="viewerVisible"
      :url-list="viewerUrls"
      :initial-index="viewerIndex"
      @close="viewerVisible = false"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { get } from '../api';
import { animalIconFor } from '../animals';
import sceneImg from '../assets/animals-queue-handdrawn.png';

const route = useRoute();
const trip = ref(null);
const loadError = ref('');
const viewerVisible = ref(false);
const viewerIndex = ref(0);

const token = computed(() => String(route.params.token || ''));

const destShort = computed(() => {
  const list = trip.value?.destinations;
  if (list?.length === 1) return list[0].name;
  if (list?.length > 1) return `${list[0].name} 等 ${list.length} 站`;
  return trip.value?.dest_name || '目的地';
});

const itineraryByDay = computed(() => {
  const items = trip.value?.itinerary || [];
  const map = new Map();
  for (const it of items) {
    const day = it.day_no;
    if (!map.has(day)) map.set(day, []);
    map.get(day).push(it);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, list]) => ({ day, items: list }));
});

function photoUrl(p) {
  return `/api/share/${token.value}/photos/${encodeURIComponent(p.filename)}`;
}

const viewerUrls = computed(() => (trip.value?.photos || []).map(photoUrl));

function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return '¥0.00';
  return `¥${Number(n).toFixed(2)}`;
}

function openViewer(idx) {
  viewerIndex.value = idx;
  viewerVisible.value = true;
}

onMounted(async () => {
  if (!/^[a-f0-9]{32,64}$/i.test(token.value)) {
    loadError.value = '分享链接无效';
    return;
  }
  try {
    trip.value = await get(`/api/share/${token.value}`, { skipAuthRedirect: true, silent: true });
  } catch (e) {
    loadError.value = /不存在|关闭|404/.test(e.message || '')
      ? '分享不存在或已关闭'
      : (e.message || '加载失败');
  }
});
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&display=swap');
</style>

<style scoped>
.share-page {
  min-height: 100vh;
  min-height: 100dvh;
}

.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: rgba(255, 253, 247, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 2px solid #fff;
  padding: 10px 20px;
  padding-top: calc(10px + var(--safe-top));
  position: sticky;
  top: 0;
  z-index: 800;
}
.top-nav-left { display: flex; align-items: center; gap: 10px; }
.brand {
  font-family: 'ZCOOL KuaiLe', 'KaiTi', 'PingFang SC', sans-serif;
  font-size: 20px;
  letter-spacing: 2px;
  color: var(--brand-ink);
}
.nav-badge {
  font-size: 11px;
  font-weight: 700;
  color: #7FB069;
  background: rgba(127, 176, 105, 0.16);
  border: 1.5px solid rgba(127, 176, 105, 0.35);
  padding: 3px 9px;
  border-radius: 999px;
}
.nav-link {
  color: #E76F51;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
}

/* —— 手绘封面 —— */
.hero-scene {
  max-width: 720px;
  margin: 12px auto 0;
  padding: 0 14px;
}
.hero-sky {
  overflow: hidden;
  border-radius: 24px 24px 0 0;
  border: 3px solid #fff;
  border-bottom: 0;
  background: linear-gradient(180deg, #C8E4F2 0%, #EAF4E4 100%);
  box-shadow: 0 12px 28px rgba(74, 64, 57, 0.08);
}
.hero-illust {
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

.hero-card {
  position: relative;
  margin-top: -8px;
  padding: 18px 18px 16px;
  background: linear-gradient(180deg, #FFF9EF, #FFFDF7);
  border: 3px solid #fff;
  border-radius: 0 0 24px 24px;
  box-shadow: 0 12px 28px rgba(74, 64, 57, 0.08);
}
.hero-card::before {
  content: '';
  position: absolute;
  inset: 8px;
  border-radius: 16px;
  border: 1px solid rgba(239, 217, 176, 0.55);
  pointer-events: none;
}
.hero-from {
  position: relative;
  margin: 0 0 8px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: #9A8468;
}
.hero-owner-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  background: #FFFDF8;
  box-shadow: 0 0 0 2px #fff, 0 2px 6px rgba(74, 64, 57, 0.12);
  animation: companion-bob 3.2s ease-in-out infinite;
}
.hero-title {
  position: relative;
  margin: 0 0 12px;
  font-family: 'ZCOOL KuaiLe', 'KaiTi', 'PingFang SC', sans-serif;
  font-size: clamp(26px, 6vw, 34px);
  letter-spacing: 2px;
  color: #5C4A3A;
  line-height: 1.3;
}
.route-line {
  position: relative;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--brand-ink);
  margin-bottom: 12px;
}
.route-paw { font-size: 14px; opacity: 0.8; }
.hero-chips {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.hero-chips span {
  font-size: 12px;
  font-weight: 700;
  padding: 5px 11px;
  border-radius: 999px;
  background: #FFFDF8;
  border: 1.5px solid #EFD9B0;
  color: #A5700B;
  box-shadow: 0 2px 0 #F5E6C8;
}

.share-main {
  max-width: 720px;
  margin: 0 auto;
  padding-top: 14px;
  padding-bottom: calc(28px + var(--safe-bottom));
}

/* —— 手绘纸板区块 —— */
.board {
  position: relative;
  background: linear-gradient(180deg, #FFF8EC 0%, #FFFDF7 100%);
  border: 3px solid #fff;
  border-radius: 22px;
  padding: 16px 16px 18px;
  margin-bottom: 14px;
  box-shadow: 0 12px 28px rgba(74, 64, 57, 0.08);
}
.board::before {
  content: '';
  position: absolute;
  inset: 10px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  pointer-events: none;
}
.board-head {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.board-title {
  margin: 0;
  font-family: 'KaiTi', 'STKaiti', 'Songti SC', 'PingFang SC', serif;
  font-size: 22px;
  font-weight: 700;
  color: #5C4A3A;
  letter-spacing: 0.04em;
}
.board-sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: #9A8468;
}
.board-total {
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: 999px;
  background: #FFFDF8;
  border: 1.5px solid #EFD9B0;
  color: #A5700B;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 2px 0 #F5E6C8;
}

/* 同行小队 */
.squad {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-start;
}
.squad-card {
  position: relative;
  width: calc(33.333% - 7px);
  min-width: 92px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 12px 8px 10px;
  border-radius: 18px;
  background: rgba(255, 253, 247, 0.92);
  border: 2px solid #fff;
  box-shadow: 0 6px 14px rgba(74, 64, 57, 0.08);
  animation: companion-rise 0.5s ease both;
  animation-delay: var(--delay, 0s);
}
.squad-aura {
  position: absolute;
  top: 6px;
  left: 50%;
  width: 64px;
  height: 64px;
  margin-left: -32px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(244, 162, 97, 0.28), transparent 70%);
  pointer-events: none;
}
.squad-avatar {
  position: relative;
  z-index: 1;
  width: 56px;
  height: 56px;
  margin-bottom: 8px;
}
.squad-avatar-clip {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 0 0 3px #fff, 0 4px 10px rgba(74, 64, 57, 0.14);
  background: #FFFDF8;
}
.squad-avatar-clip img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  animation: companion-bob 3.2s ease-in-out infinite;
  animation-delay: var(--delay, 0s);
}
.squad-name {
  font-size: 13px;
  font-weight: 800;
  color: #5C4A3A;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes companion-rise {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes companion-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

.stat-row {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}
.stat {
  background: #FFFDF8;
  border: 2px solid #fff;
  border-radius: 16px;
  padding: 12px 8px;
  text-align: center;
  box-shadow: 0 4px 10px rgba(74, 64, 57, 0.05);
}
.stat strong {
  display: block;
  font-size: 17px;
  font-weight: 800;
  color: #5C4A3A;
}
.stat span {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #9A8468;
  font-weight: 600;
}

.transfer-block { position: relative; margin-bottom: 14px; }
.transfer-label {
  font-size: 13px;
  font-weight: 700;
  color: #9A8468;
  margin-bottom: 8px;
}
.transfer-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: #FFFDF8;
  border: 2px solid #fff;
  border-radius: 16px;
  margin-bottom: 8px;
  box-shadow: 0 4px 10px rgba(74, 64, 57, 0.05);
  animation: companion-rise 0.45s ease both;
  animation-delay: var(--delay, 0s);
}
.transfer-who {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.person {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 0;
}
.person-clip {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 0 0 2px #fff, 0 2px 6px rgba(74, 64, 57, 0.12);
  background: #FFF8EC;
}
.person-clip img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.person span {
  font-size: 12px;
  font-weight: 800;
  color: #5C4A3A;
  max-width: 64px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.person em {
  font-style: normal;
  font-size: 10px;
  color: #9A8468;
}
.flow {
  color: #E76F51;
  font-weight: 800;
  font-size: 18px;
  flex-shrink: 0;
  align-self: center;
  margin-bottom: 14px;
}
.amt {
  font-size: 16px;
  font-weight: 800;
  color: #E76F51;
  flex-shrink: 0;
}
.transfer-ok {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(127, 176, 105, 0.14);
  border: 1.5px solid rgba(127, 176, 105, 0.35);
  color: #4F7A3E;
  font-size: 13px;
  font-weight: 700;
}
.ok-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
}

.expense-list {
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.expense-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #FFFDF8;
  border: 2px solid #fff;
  border-radius: 14px;
  box-shadow: 0 3px 8px rgba(74, 64, 57, 0.04);
}
.expense-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: #FFF8EC;
  box-shadow: 0 0 0 2px #fff;
}
.expense-main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
}
.expense-main strong { font-size: 14px; color: #5C4A3A; }
.expense-cat {
  font-size: 11px;
  font-weight: 700;
  color: #7FB069;
  background: rgba(127, 176, 105, 0.14);
  padding: 2px 7px;
  border-radius: 999px;
}
.expense-note {
  font-size: 12px;
  color: #9A8468;
  width: 100%;
}
.expense-side {
  text-align: right;
  flex-shrink: 0;
}
.expense-side strong {
  display: block;
  font-size: 15px;
  color: #5C4A3A;
}
.expense-side span {
  font-size: 11px;
  color: #9A8468;
}

/* 行程时间线 · 小动物路标 */
.timeline {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.tl-day { display: flex; gap: 12px; }
.tl-marker {
  width: 52px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.tl-animal {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  background: #FFFDF8;
  box-shadow: 0 0 0 3px #fff, 0 3px 8px rgba(74, 64, 57, 0.12);
  animation: companion-bob 3.4s ease-in-out infinite;
}
.tl-dayno {
  font-size: 11px;
  font-weight: 800;
  color: #E76F51;
  text-align: center;
  line-height: 1.2;
}
.tl-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.tl-item {
  padding: 10px 12px;
  background: #FFFDF8;
  border: 2px solid #fff;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.55;
  color: #5C4A3A;
  box-shadow: 0 3px 8px rgba(74, 64, 57, 0.04);
}

.photo-wall {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.photo-cell {
  aspect-ratio: 1;
  border: 3px solid #fff;
  padding: 0;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  background: #FFF8EC;
  box-shadow: 0 4px 10px rgba(74, 64, 57, 0.08);
}
.photo-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.share-foot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 10px 0 0;
  font-size: 13px;
  color: #9A8468;
  font-weight: 600;
}
.foot-animal {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  animation: companion-bob 3s ease-in-out infinite;
}

.muted {
  position: relative;
  color: #9A8468;
  font-size: 13px;
  padding: 4px 0;
}
.empty-state {
  text-align: center;
  color: #9A8468;
  padding: 64px 16px;
  font-size: 15px;
}

@media (max-width: 768px) {
  .top-nav { padding: 10px 12px; padding-top: calc(10px + var(--safe-top)); }
  .hero-scene { padding: 0 10px; margin-top: 10px; }
  .hero-card { padding: 14px 14px 14px; }
  .board { padding: 14px 12px 16px; border-radius: 18px; }
  .board-title { font-size: 20px; }
  .squad-card { width: calc(33.333% - 7px); min-width: 0; }
  .stat strong { font-size: 15px; }
  .transfer-card { flex-direction: column; align-items: stretch; }
  .amt { text-align: right; }
  .flow { margin-bottom: 0; }
  .photo-wall { gap: 6px; }
}

@media (max-width: 400px) {
  .squad-card { width: calc(50% - 5px); }
}

@media (prefers-reduced-motion: reduce) {
  .hero-illust,
  .hero-owner-icon,
  .squad-avatar-clip img,
  .tl-animal,
  .foot-animal { animation: none; }
  .squad-card,
  .transfer-card { animation: none; }
}
</style>
