<template>
  <div class="create-form">
    <div class="form-grid">
      <label class="home-field">
        <span class="form-label">出发城市</span>
        <div class="search-box">
          <el-input
            :model-value="homeQuery"
            placeholder="搜索出发城市"
            clearable
            @update:model-value="$emit('update:homeQuery', $event)"
            @input="$emit('home-input', $event)"
          />
          <ul v-if="homeShowResults" class="search-results">
            <li v-if="!homeResults.length" class="search-none">未找到匹配的城市</li>
            <li v-for="c in homeResults" :key="c.name + c.lat" @click="$emit('pick-home', c)">
              <strong>{{ c.name }}</strong>
              <em v-if="c.name_en"> {{ c.name_en }}</em>
              <span class="search-country">· {{ c.country }}</span>
            </li>
          </ul>
        </div>
      </label>
      <label>
        <span class="form-label">旅行项目名</span>
        <el-input :model-value="form.title" maxlength="50" placeholder="如：五一川西自驾" @update:model-value="form.title = $event" />
      </label>
      <label>
        <span class="form-label">出发时间</span>
        <el-date-picker
          :model-value="form.date"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          style="width: 100%"
          @update:model-value="form.date = $event"
        />
      </label>
      <label>
        <span class="form-label">旅行天数</span>
        <el-input-number :model-value="form.days" :min="1" :max="365" style="width: 100%" @update:model-value="form.days = $event" />
      </label>
      <label>
        <span class="form-label">出行方式</span>
        <el-select
          :model-value="form.transport"
          style="width: 100%"
          @update:model-value="(v) => { form.transport = v; $emit('transport-change'); }"
        >
          <el-option v-for="t in transports" :key="t" :value="t" :label="t" />
        </el-select>
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
          @click="$emit('add-quick', c.name)"
        >{{ c.name }} <em>{{ c.n }}次</em></button>
      </div>
      <div class="tag-input">
        <el-tag
          v-for="(m, idx) in members"
          :key="m"
          closable
          round
          class="member-tag"
          @close="$emit('remove-member', idx)"
        >{{ m }}</el-tag>
        <input
          :value="memberInput"
          type="text"
          placeholder="输入名字后回车"
          maxlength="20"
          @input="$emit('update:memberInput', $event.target.value)"
          @keydown.enter.prevent="$emit('add-member')"
        >
      </div>
    </div>

    <div class="form-block">
      <div class="form-label">预算档位（按人数 × 天数自动估算）</div>
      <div class="budget-tiers">
        <button
          v-for="t in BUDGET_TIERS"
          :key="t.key"
          type="button"
          class="budget-tier"
          :class="{ active: budgetTier === t.key }"
          @click="$emit('update:budgetTier', t.key)"
        >
          <strong>{{ t.label }}</strong>
          <em>{{ t.hint }}</em>
          <span>¥{{ t.rate }}/人/天</span>
        </button>
      </div>
      <p class="budget-calc">预估总预算：<strong>¥{{ estimatedBudget }}</strong> · {{ budgetCalcHint }}</p>
    </div>

    <div class="form-block">
      <div class="form-label">目的地（可添加多个；搜索或地图点选）</div>
      <div class="dest-picker">
        <div class="dest-side">
          <div v-if="destinations.length" class="dest-tags">
            <el-tag
              v-for="(d, idx) in destinations"
              :key="d.name + d.lat + idx"
              closable
              round
              class="dest-tag"
              :effect="idx === activeDestIndex ? 'dark' : 'plain'"
              @click="$emit('focus-dest', idx)"
              @close="$emit('remove-dest', idx)"
            >{{ idx + 1 }}. {{ d.name }}</el-tag>
          </div>
          <div v-else class="dest-empty">尚未添加地点</div>
          <div class="search-box">
            <el-input
              :model-value="destQuery"
              placeholder="搜索城市后添加，或地图点选"
              maxlength="50"
              clearable
              @update:model-value="$emit('update:destQuery', $event)"
              @input="$emit('dest-input', $event)"
              @keydown.enter.prevent="$emit('add-dest-query')"
            />
            <ul v-if="destShowResults" class="search-results">
              <li v-if="!destResults.length" class="search-none">未找到匹配的城市</li>
              <li v-for="c in destResults" :key="c.name + c.lat" @click="$emit('pick-dest', c)">
                <strong>{{ c.name }}</strong>
                <em v-if="c.name_en"> {{ c.name_en }}</em>
                <span class="search-country">· {{ c.country }}</span>
              </li>
            </ul>
          </div>
          <div class="dest-coord">{{ destCoordText }}</div>
          <div v-if="distanceHint" class="distance-hint">{{ distanceHint }}</div>
        </div>
        <div ref="mapEl" class="picker-map"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { BUDGET_TIERS } from '../budget';

defineProps({
  form: { type: Object, required: true },
  transports: { type: Array, required: true },
  homeQuery: String,
  homeResults: { type: Array, default: () => [] },
  homeShowResults: Boolean,
  members: { type: Array, default: () => [] },
  memberInput: String,
  quickPicks: { type: Array, default: () => [] },
  budgetTier: String,
  estimatedBudget: { type: Number, default: 0 },
  budgetCalcHint: { type: String, default: '' },
  destinations: { type: Array, default: () => [] },
  destQuery: String,
  destResults: { type: Array, default: () => [] },
  destShowResults: Boolean,
  destCoordText: { type: String, default: '' },
  distanceHint: { type: String, default: '' },
  activeDestIndex: { type: Number, default: -1 },
});

defineEmits([
  'update:homeQuery', 'home-input', 'pick-home',
  'update:memberInput', 'add-member', 'remove-member', 'add-quick',
  'update:budgetTier',
  'update:destQuery', 'dest-input', 'pick-dest', 'add-dest-query',
  'remove-dest', 'focus-dest',
  'transport-change',
]);

const mapEl = ref(null);
defineExpose({ mapEl });
</script>

<style scoped>
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

.member-quick { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 8px; }
.quick-label { font-size: 13px; color: var(--brand-sub); }
.quick-chip {
  border: 1px solid #F5D9A8; background: #FDEFD9; color: #A5700B;
  border-radius: 999px; padding: 3px 12px; font-size: 13px; cursor: pointer;
}
.quick-chip em { font-style: normal; font-size: 11px; opacity: 0.75; }

.tag-input {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  border: 2px solid var(--brand-line); border-radius: 12px;
  padding: 8px 10px; background: #ffffff;
}
.tag-input:focus-within { border-color: #F4A261; box-shadow: 0 0 0 3px rgba(244, 162, 97, 0.2); }
.tag-input input { border: none; outline: none; flex: 1; min-width: 120px; font-size: 14px; padding: 4px; background: transparent; }
.member-tag { font-weight: 600; }

.budget-tiers {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.budget-tier {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
  text-align: left; cursor: pointer;
  border: 2px solid var(--brand-line); border-radius: 14px;
  background: #fff; padding: 10px 12px;
}
.budget-tier strong { font-size: 15px; color: var(--brand-ink); }
.budget-tier em { font-style: normal; font-size: 12px; color: var(--brand-sub); }
.budget-tier span { font-size: 11px; color: #B9AE9F; margin-top: 4px; }
.budget-tier.active {
  border-color: #E76F51;
  background: linear-gradient(180deg, #FFF8F0, #FDEFD9);
  box-shadow: 0 0 0 3px rgba(231, 111, 81, 0.18);
}
.budget-calc { margin: 10px 0 0; font-size: 13px; color: var(--brand-sub); }
.budget-calc strong { color: #E76F51; font-size: 16px; }

.dest-picker { display: flex; gap: 14px; }
.dest-side {
  width: 260px; flex-shrink: 0; display: flex; flex-direction: column; gap: 10px;
  background: #ffffff; border: 2px solid var(--brand-line);
  border-radius: 14px; padding: 14px;
}
.dest-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.dest-tag { cursor: pointer; font-weight: 600; max-width: 100%; }
.dest-empty { font-size: 13px; color: #B9AE9F; }
.picker-map {
  flex: 1; height: 320px; min-height: 280px; width: 100%;
  border-radius: 16px;
  border: 3px solid #ffffff; background: #e5e7eb;
  box-shadow: 0 6px 18px rgba(74, 64, 57, 0.12); overflow: hidden;
}
.dest-coord { font-size: 13px; color: #B9AE9F; }
.distance-hint {
  font-size: 13px; background: #E9F6E3; border-radius: 10px;
  padding: 8px 12px; color: #4E7A36; font-weight: 600;
}

@media (max-width: 768px) {
  .create-form { padding: 14px; border-radius: 14px; }
  .form-grid { grid-template-columns: 1fr; }
  .budget-tiers { grid-template-columns: 1fr 1fr; }
  .dest-picker { flex-direction: column; }
  .dest-side { width: 100%; order: 2; }
  .picker-map {
    order: 1;
    flex: none;
    width: 100%;
    height: 42vh;
    min-height: 260px;
    max-height: 360px;
  }
}
</style>
