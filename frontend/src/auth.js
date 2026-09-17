import { reactive } from 'vue';
import { get, post } from './api';

// 全局登录态（简单 composable，无 Pinia）
export const authState = reactive({
  loaded: false,
  username: '',
  isGuest: false,
});

export async function fetchMe() {
  const me = await get('/api/auth/me');
  authState.loaded = true;
  authState.username = me.username;
  authState.isGuest = !!me.isGuest;
  return me;
}

export async function logout() {
  try { await post('/api/auth/logout'); } catch (_) { /* ignore */ }
  location.href = '/login';
}
