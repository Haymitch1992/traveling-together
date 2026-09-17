import { ElMessage } from 'element-plus';

// 统一 API 封装：JSON、401 跳登录、错误弹 ElMessage
export async function api(method, url, body, isForm = false) {
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
    if (res.status === 401) {
      location.href = '/login';
      throw new Error('未登录');
    }
    let msg = `请求失败 (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch (_) { /* ignore */ }
    ElMessage.error(msg);
    throw new Error(msg);
  }
  return res.json();
}

export const get = (url) => api('GET', url);
export const post = (url, body, isForm) => api('POST', url, body, isForm);
export const put = (url, body) => api('PUT', url, body);
export const del = (url) => api('DELETE', url);
