import { ElMessage } from 'element-plus';

// 统一 API 封装：JSON、401 跳登录、错误弹 ElMessage
// opts.skipAuthRedirect: 公开接口（如分享页）401/错误时不跳登录
export async function api(method, url, body, isForm = false, opts = {}) {
  const skipAuthRedirect = !!opts.skipAuthRedirect;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch (e) {
    console.error(e);
    ElMessage.error('网络错误，请确认服务已启动');
    throw e;
  }
  if (!res.ok) {
    if (res.status === 401 && !skipAuthRedirect) {
      location.href = '/login';
      throw new Error('未登录');
    }
    let msg = `请求失败 (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch (_) { /* ignore */ }
    if (!opts.silent) ElMessage.error(msg);
    throw new Error(msg);
  }
  return res.json();
}

export const get = (url, opts) => api('GET', url, undefined, false, opts);
export const post = (url, body, isForm, opts) => api('POST', url, body, isForm, opts);
export const put = (url, body, opts) => api('PUT', url, body, false, opts);
export const del = (url, opts) => api('DELETE', url, undefined, false, opts);
