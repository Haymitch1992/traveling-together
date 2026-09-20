const crypto = require('crypto');
const db = require('./db');

const SESSION_COOKIE = 'session';
const SESSION_DAYS = 7;

// ---------- 密码 ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

// ---------- 会话 ----------
function createSession(userId, isGuest) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(`INSERT INTO sessions (token, user_id, is_guest, expires_at)
              VALUES (?, ?, ?, datetime('now', '+${SESSION_DAYS} days'))`)
    .run(token, userId, isGuest ? 1 : 0);
  return token;
}

function getSession(token) {
  if (!token || typeof token !== 'string') return null;
  const row = db.prepare(`
    SELECT s.token, s.user_id, s.is_guest, u.username
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at >= datetime('now')
  `).get(token);
  return row || null;
}

function deleteSession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_DAYS * 86400}; SameSite=Lax`;
}

function clearCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > 0) out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  });
  return out;
}

// ---------- 中间件 ----------
function requireAuth(req, res, next) {
  const token = parseCookies(req)[SESSION_COOKIE];
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: '未登录或会话已过期' });
  req.auth = { token: session.token, userId: session.user_id, isGuest: !!session.is_guest, username: session.username };
  next();
}

function requireWrite(req, res, next) {
  if (req.auth && req.auth.isGuest) return res.status(403).json({ error: '游客模式为只读，请登录账号后再操作' });
  next();
}

/** 仅真实登录的 admin 账号（游客挂在 admin 下，必须排除） */
function requireAdmin(req, res, next) {
  if (!req.auth || req.auth.isGuest || req.auth.username !== 'admin') {
    return res.status(403).json({ error: '仅管理员可操作' });
  }
  next();
}

// ---------- 初始化：admin 账号 + 旧数据归属 + 过期会话清理 ----------
function ensureAdmin() {
  let admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!admin) {
    const r = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
      .run('admin', hashPassword('admin123'));
    admin = { id: r.lastInsertRowid };
    console.log('已创建 admin 账号，默认密码 admin123，请尽快修改');
  }
  return admin.id;
}

const adminId = ensureAdmin();
db.prepare('UPDATE cities SET user_id = ? WHERE user_id IS NULL').run(adminId);
db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  getSession,
  deleteSession,
  sessionCookie,
  clearCookie,
  requireAuth,
  requireWrite,
  requireAdmin,
};
