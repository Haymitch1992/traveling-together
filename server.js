const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const db = require('./db');
const auth = require('./auth');
const mail = require('./mail');
const { nearestRegion } = require('./region');
const tripsRouter = require('./trips');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', auth.requireAuth, express.static(path.join(__dirname, 'data', 'uploads')));
app.use('/api', tripsRouter);

// ---------- 配置 ----------
const config = require('./config');

// ---------- 内置城市库 ----------
const cityLibPath = path.join(__dirname, 'data', 'cities.json');
let cityLib = [];
try {
  cityLib = JSON.parse(fs.readFileSync(cityLibPath, 'utf8'));
} catch (e) {
  console.error('data/cities.json 加载失败:', e.message);
}

// ---------- 工具 ----------
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function bad(res, msg) { return res.status(400).json({ error: msg }); }
function notFound(res, msg = '资源不存在') { return res.status(404).json({ error: msg }); }

function cityWithStats(city, year) {
  const visits = year
    ? db.prepare('SELECT id, visited_at, note FROM visits WHERE city_id = ? AND substr(visited_at, 1, 4) = ? ORDER BY visited_at DESC, id DESC').all(city.id, year)
    : db.prepare('SELECT id, visited_at, note FROM visits WHERE city_id = ? ORDER BY visited_at DESC, id DESC').all(city.id);
  return {
    id: city.id,
    name: city.name,
    name_en: city.name_en,
    country: city.country,
    region: city.region || null,
    lat: city.lat,
    lng: city.lng,
    created_at: city.created_at,
    visitCount: visits.length,
    lastVisit: visits.length ? visits[0].visited_at : null,
    visits
  };
}

function findOwnCity(cityId, userId) {
  return db.prepare('SELECT * FROM cities WHERE id = ? AND user_id = ?').get(cityId, userId);
}

// ---------- 认证 API ----------
const USERNAME_RE = /^[\w一-龥-]{2,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/auth/send-code', async (req, res) => {
  const { email } = req.body || {};
  if (!email || !EMAIL_RE.test(email)) return bad(res, '邮箱格式不正确');
  const registered = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (registered) return res.status(409).json({ error: '该邮箱已注册，可直接登录' });
  const recent = db.prepare("SELECT id FROM email_codes WHERE email = ? AND created_at > datetime('now', '-60 seconds')").get(email);
  if (recent) return res.status(429).json({ error: '发送太频繁，请 60 秒后再试' });
  const code = String(crypto.randomInt(100000, 1000000));
  db.prepare("INSERT INTO email_codes (email, code, expires_at) VALUES (?, ?, datetime('now', '+10 minutes'))")
    .run(email, code);
  if (!mail.smtpReady()) {
    console.log(`[dev] ${email} 的验证码: ${code}（SMTP 未配置，仅控制台输出）`);
    return res.json({ ok: true, devMode: true });
  }
  try {
    await mail.sendVerifyCode(email, code);
    res.json({ ok: true });
  } catch (e) {
    console.error('邮件发送失败:', e.message);
    res.status(502).json({ error: '邮件发送失败，请检查 SMTP 配置' });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { username, email, password, code } = req.body || {};
  if (!username || !USERNAME_RE.test(username)) return bad(res, '用户名需为 2-20 位字母、数字、下划线或中文');
  if (!email || !EMAIL_RE.test(email)) return bad(res, '邮箱格式不正确');
  if (!password || password.length < 6) return bad(res, '密码至少 6 位');
  if (!code || !/^\d{6}$/.test(code)) return bad(res, '请输入 6 位邮箱验证码');
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: '用户名已被注册' });
  const emailUsed = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (emailUsed) return res.status(409).json({ error: '该邮箱已注册，可直接登录' });
  const codeRow = db.prepare("SELECT * FROM email_codes WHERE email = ? AND used = 0 AND expires_at >= datetime('now') ORDER BY id DESC").get(email);
  if (!codeRow || codeRow.code !== code) return bad(res, '验证码错误或已过期');
  db.prepare('UPDATE email_codes SET used = 1 WHERE id = ?').run(codeRow.id);
  const r = db.prepare('INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)')
    .run(username, auth.hashPassword(password), email);
  const token = auth.createSession(r.lastInsertRowid, false);
  res.setHeader('Set-Cookie', auth.sessionCookie(token));
  res.status(201).json({ username, isGuest: false });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return bad(res, '用户名和密码必填');
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !auth.verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const token = auth.createSession(user.id, false);
  res.setHeader('Set-Cookie', auth.sessionCookie(token));
  res.json({ username: user.username, isGuest: false });
});

app.post('/api/auth/guest', (req, res) => {
  const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!admin) return res.status(500).json({ error: 'admin 账号不存在' });
  const token = auth.createSession(admin.id, true);
  res.setHeader('Set-Cookie', auth.sessionCookie(token));
  res.json({ username: 'admin', isGuest: true });
});

app.post('/api/auth/logout', (req, res) => {
  const token = (req.headers.cookie || '').split(';').map((s) => s.trim())
    .find((s) => s.startsWith('session='));
  if (token) auth.deleteSession(token.slice('session='.length));
  res.setHeader('Set-Cookie', auth.clearCookie());
  res.json({ ok: true });
});

app.get('/api/auth/me', auth.requireAuth, (req, res) => {
  res.json({ username: req.auth.username, isGuest: req.auth.isGuest });
});

// ---------- 业务 API（均需登录，写操作游客禁止） ----------
app.get('/api/config', (req, res) => {
  res.json({ amapKey: config.amapKey || '', amapSecurityCode: config.amapSecurityCode || '' });
});

app.get('/api/cities', auth.requireAuth, (req, res) => {
  const year = /^\d{4}$/.test(req.query.year || '') ? req.query.year : null;
  const cities = db.prepare('SELECT * FROM cities WHERE user_id = ?').all(req.auth.userId);
  let result = cities.map((c) => cityWithStats(c, year));
  if (year) result = result.filter((c) => c.visitCount > 0);
  result.sort((a, b) => b.visitCount - a.visitCount || a.name.localeCompare(b.name, 'zh'));
  res.json(result);
});

app.get('/api/cities/search', auth.requireAuth, (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q) return res.json([]);
  const matched = cityLib.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.name_en && c.name_en.toLowerCase().includes(q)) ||
    (c.country && c.country.toLowerCase().includes(q))
  );
  res.json(matched.slice(0, 10).map(({ name, name_en, country, lat, lng }) => ({ name, name_en, country, lat, lng })));
});

app.post('/api/cities', auth.requireAuth, auth.requireWrite, (req, res) => {
  const { name, name_en, country, lat, lng, visited_at, note } = req.body || {};
  if (!name || typeof name !== 'string') return bad(res, 'name 必填');
  if (!country || typeof country !== 'string') return bad(res, 'country 必填');
  if (typeof lat !== 'number' || typeof lng !== 'number' || !isFinite(lat) || !isFinite(lng)) return bad(res, 'lat/lng 必须为数字');
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return bad(res, 'lat/lng 超出范围');
  if (!visited_at || !DATE_RE.test(visited_at)) return bad(res, 'visited_at 必填，格式 YYYY-MM-DD');

  let city = db.prepare('SELECT * FROM cities WHERE name = ? AND country = ? AND user_id = ?')
    .get(name, country, req.auth.userId);
  if (!city) {
    const r = db.prepare('INSERT INTO cities (user_id, name, name_en, country, lat, lng, region) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(req.auth.userId, name, name_en || null, country, lat, lng, nearestRegion(lat, lng, country));
    city = db.prepare('SELECT * FROM cities WHERE id = ?').get(r.lastInsertRowid);
  }
  db.prepare('INSERT INTO visits (city_id, visited_at, note) VALUES (?, ?, ?)')
    .run(city.id, visited_at, note || null);
  res.status(201).json(cityWithStats(city));
});

app.post('/api/cities/:id/visits', auth.requireAuth, auth.requireWrite, (req, res) => {
  const cityId = Number(req.params.id);
  const { visited_at, note } = req.body || {};
  if (!Number.isInteger(cityId)) return bad(res, '城市 id 无效');
  if (!visited_at || !DATE_RE.test(visited_at)) return bad(res, 'visited_at 必填，格式 YYYY-MM-DD');
  const city = findOwnCity(cityId, req.auth.userId);
  if (!city) return notFound(res, '城市不存在');
  const r = db.prepare('INSERT INTO visits (city_id, visited_at, note) VALUES (?, ?, ?)')
    .run(cityId, visited_at, note || null);
  res.status(201).json(db.prepare('SELECT id, city_id, visited_at, note FROM visits WHERE id = ?').get(r.lastInsertRowid));
});

// 校验 visit 归属当前用户（visit → city → user_id）
function findOwnVisit(visitId, userId) {
  return db.prepare(`
    SELECT v.* FROM visits v JOIN cities c ON c.id = v.city_id
    WHERE v.id = ? AND c.user_id = ?
  `).get(visitId, userId);
}

app.put('/api/visits/:id', auth.requireAuth, auth.requireWrite, (req, res) => {
  const id = Number(req.params.id);
  const { visited_at, note } = req.body || {};
  if (!Number.isInteger(id)) return bad(res, 'id 无效');
  if (!visited_at || !DATE_RE.test(visited_at)) return bad(res, 'visited_at 必填，格式 YYYY-MM-DD');
  const visit = findOwnVisit(id, req.auth.userId);
  if (!visit) return notFound(res, '到访记录不存在');
  db.prepare('UPDATE visits SET visited_at = ?, note = ? WHERE id = ?').run(visited_at, note || null, id);
  res.json(db.prepare('SELECT id, city_id, visited_at, note FROM visits WHERE id = ?').get(id));
});

app.delete('/api/visits/:id', auth.requireAuth, auth.requireWrite, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return bad(res, 'id 无效');
  const visit = findOwnVisit(id, req.auth.userId);
  if (!visit) return notFound(res, '到访记录不存在');
  db.prepare('DELETE FROM visits WHERE id = ?').run(id);
  res.json({ ok: true });
});

app.delete('/api/cities/:id', auth.requireAuth, auth.requireWrite, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return bad(res, '城市 id 无效');
  const city = findOwnCity(id, req.auth.userId);
  if (!city) return notFound(res, '城市不存在');
  db.prepare('DELETE FROM cities WHERE id = ?').run(id);
  res.json({ ok: true });
});

app.get('/api/stats', auth.requireAuth, (req, res) => {
  const userId = req.auth.userId;
  const year = /^\d{4}$/.test(req.query.year || '') ? req.query.year : null;
  let cityCount, visitCount, countryCount;
  if (year) {
    cityCount = db.prepare('SELECT COUNT(DISTINCT v.city_id) AS n FROM visits v JOIN cities c ON c.id = v.city_id WHERE c.user_id = ? AND substr(v.visited_at, 1, 4) = ?').get(userId, year).n;
    visitCount = db.prepare('SELECT COUNT(*) AS n FROM visits v JOIN cities c ON c.id = v.city_id WHERE c.user_id = ? AND substr(v.visited_at, 1, 4) = ?').get(userId, year).n;
    countryCount = db.prepare('SELECT COUNT(DISTINCT c.country) AS n FROM visits v JOIN cities c ON c.id = v.city_id WHERE c.user_id = ? AND substr(v.visited_at, 1, 4) = ?').get(userId, year).n;
  } else {
    cityCount = db.prepare('SELECT COUNT(*) AS n FROM cities WHERE user_id = ?').get(userId).n;
    visitCount = db.prepare('SELECT COUNT(*) AS n FROM visits v JOIN cities c ON c.id = v.city_id WHERE c.user_id = ?').get(userId).n;
    countryCount = db.prepare('SELECT COUNT(DISTINCT country) AS n FROM cities WHERE user_id = ?').get(userId).n;
  }
  const topCities = db.prepare(`
    SELECT c.id, c.name, c.name_en, c.country, c.lat, c.lng, COUNT(v.id) AS visitCount
    FROM cities c LEFT JOIN visits v ON v.city_id = c.id
    WHERE c.user_id = ?
    GROUP BY c.id ORDER BY visitCount DESC, c.name LIMIT 5
  `).all(userId);
  res.json({ cityCount, visitCount, countryCount, topCities });
});

// 年度汇总：一年去了多少地方、走了多少公里（旅行项目单程 ×2 估算往返）；year=all 汇总全部年份
app.get('/api/summary/yearly', auth.requireAuth, (req, res) => {
  const userId = req.auth.userId;
  const years = [...new Set([
    ...db.prepare('SELECT DISTINCT substr(v.visited_at, 1, 4) AS y FROM visits v JOIN cities c ON c.id = v.city_id WHERE c.user_id = ?').all(userId),
    ...db.prepare('SELECT DISTINCT substr(depart_date, 1, 4) AS y FROM trips WHERE user_id = ?').all(userId),
  ].map((r) => r.y))].sort().reverse();

  const all = req.query.year === 'all';
  const year = all ? null
    : (/^\d{4}$/.test(req.query.year || '') ? req.query.year : (years[0] || String(new Date().getFullYear())));
  const vCond = year ? ' AND substr(v.visited_at, 1, 4) = ?' : '';
  const tCond = year ? ' AND substr(depart_date, 1, 4) = ?' : '';
  const p = year ? [userId, year] : [userId];

  const cityStats = db.prepare(`
    SELECT COUNT(DISTINCT c.id) AS cities, COUNT(v.id) AS visits
    FROM visits v JOIN cities c ON c.id = v.city_id
    WHERE c.user_id = ?${vCond}
  `).get(...p);
  const tripStats = db.prepare(`
    SELECT COUNT(*) AS trips, COALESCE(SUM(days), 0) AS days, COALESCE(SUM(distance_km), 0) AS km
    FROM trips WHERE user_id = ?${tCond}
  `).get(...p);
  const cityList = db.prepare(`
    SELECT c.name, c.country, COUNT(v.id) AS n
    FROM visits v JOIN cities c ON c.id = v.city_id
    WHERE c.user_id = ?${vCond}
    GROUP BY c.id ORDER BY n DESC, c.name
  `).all(...p);
  const tripList = db.prepare(`
    SELECT id, title, dest_name, depart_date, days, distance_km
    FROM trips WHERE user_id = ?${tCond}
    ORDER BY depart_date
  `).all(...p);

  const oneWayKm = Math.round(tripStats.km * 10) / 10;
  res.json({
    year: all ? 'all' : year, years,
    cityCount: cityStats.cities, visitCount: cityStats.visits,
    tripCount: tripStats.trips, tripDays: tripStats.days,
    oneWayKm, totalKm: Math.round(oneWayKm * 2 * 10) / 10,
    cities: cityList, trips: tripList,
  });
});

// 兜底错误处理
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') return bad(res, '请求体不是合法 JSON');
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`结伴出行已启动: http://localhost:${PORT}`);
  if (!config.amapKey) console.log('提示: 尚未在 config.json 中填写高德 Key');
});
