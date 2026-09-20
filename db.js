const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(path.join(dataDir, 'travel.db'));

db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_guest INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  country TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  visited_at TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  origin_name TEXT, origin_lat REAL, origin_lng REAL,
  dest_name TEXT NOT NULL, dest_lat REAL NOT NULL, dest_lng REAL NOT NULL,
  depart_date TEXT NOT NULL,
  days INTEGER NOT NULL,
  transport TEXT NOT NULL,
  distance_km REAL,
  budget REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trip_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trip_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  payer TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT,
  note TEXT,
  spent_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trip_itinerary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_no INTEGER NOT NULL,
  content TEXT NOT NULL,
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS trip_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trip_destinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  country TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS guestbook (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact TEXT,
  content TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ip TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trip_shares (
  token TEXT PRIMARY KEY,
  trip_id INTEGER NOT NULL UNIQUE REFERENCES trips(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// 旧库迁移：cities 表补 user_id 列（归属由 auth.js 初始化时完成）
const cityCols = db.prepare('PRAGMA table_info(cities)').all();
if (!cityCols.some((c) => c.name === 'user_id')) {
  db.exec('ALTER TABLE cities ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
}
// 旧库迁移：cities 表补所属城市（省市归并分组）列
if (!cityCols.some((c) => c.name === 'region')) {
  db.exec('ALTER TABLE cities ADD COLUMN region TEXT');
}
// 旧库迁移：users 表补固定出发城市列
const userCols = db.prepare('PRAGMA table_info(users)').all();
if (!userCols.some((c) => c.name === 'home_name')) {
  db.exec('ALTER TABLE users ADD COLUMN home_name TEXT');
  db.exec('ALTER TABLE users ADD COLUMN home_lat REAL');
  db.exec('ALTER TABLE users ADD COLUMN home_lng REAL');
}
// 旧库迁移：users 表补邮箱列
if (!userCols.some((c) => c.name === 'email')) {
  db.exec('ALTER TABLE users ADD COLUMN email TEXT');
}
// 旧库迁移：users 表补头像文件名列
if (!userCols.some((c) => c.name === 'avatar')) {
  db.exec('ALTER TABLE users ADD COLUMN avatar TEXT');
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL');
db.exec('CREATE INDEX IF NOT EXISTS idx_cities_user ON cities(user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_visits_city ON visits(city_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_trips_user ON trips(user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_trip_members ON trip_members(trip_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_trip_expenses ON trip_expenses(trip_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_trip_itinerary ON trip_itinerary(trip_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_trip_photos ON trip_photos(trip_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_trip_destinations ON trip_destinations(trip_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_guestbook_created ON guestbook(created_at)');
db.exec('CREATE INDEX IF NOT EXISTS idx_trip_shares_trip ON trip_shares(trip_id)');

// 旧库迁移：尚无 trip_destinations 行的旅行，写入单目的地
const orphanTrips = db.prepare(`
  SELECT t.id, t.dest_name, t.dest_lat, t.dest_lng FROM trips t
  WHERE NOT EXISTS (SELECT 1 FROM trip_destinations d WHERE d.trip_id = t.id)
`).all();
if (orphanTrips.length) {
  const insDest = db.prepare(
    'INSERT INTO trip_destinations (trip_id, name, lat, lng, country, sort_order) VALUES (?, ?, ?, ?, ?, 0)'
  );
  for (const t of orphanTrips) {
    if (t.dest_name) insDest.run(t.id, t.dest_name, t.dest_lat, t.dest_lng, null);
  }
}

module.exports = db;
