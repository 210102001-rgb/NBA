'use strict';
/* Lapisan database: node:sqlite (built-in Node ≥22.5, tanpa native build).
   Lokasi file bisa diatur lewat env NBA_DB_PATH (default ./data/nba.sqlite). */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const { STASIUN, HARGA, BERITA, USERS, KAS_AWAL } = require('./seed-data');

const DB_PATH = process.env.NBA_DB_PATH || path.join(__dirname, '..', 'data', 'nba.sqlite');

function openDb(dbPath = DB_PATH) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  migrate(db);
  return db;
}

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS users(
     id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, nama TEXT NOT NULL,
     password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'nasabah',
     tel TEXT, nfc TEXT UNIQUE, saldo INTEGER NOT NULL DEFAULT 0,
     total_kg REAL NOT NULL DEFAULT 0, trx_count INTEGER NOT NULL DEFAULT 0,
     aktif INTEGER NOT NULL DEFAULT 1, sejak TEXT
   );
   CREATE TABLE IF NOT EXISTS stasiun(
     id TEXT PRIMARY KEY, nama TEXT NOT NULL, lokasi TEXT,
     status TEXT NOT NULL DEFAULT 'Online', alamat TEXT, jam TEXT,
     lat REAL, lng REAL, trx_hari INTEGER NOT NULL DEFAULT 0
   );
   CREATE TABLE IF NOT EXISTS harga(
     kategori TEXT NOT NULL, item TEXT NOT NULL, harga INTEGER NOT NULL,
     satuan TEXT NOT NULL DEFAULT 'Kg', PRIMARY KEY(kategori, item)
   );
   CREATE TABLE IF NOT EXISTS harga_riwayat(
     id INTEGER PRIMARY KEY AUTOINCREMENT, tgl TEXT NOT NULL,
     kategori TEXT, item TEXT, harga_lama INTEGER, harga_baru INTEGER, alasan TEXT
   );
   CREATE TABLE IF NOT EXISTS berita(
     id INTEGER PRIMARY KEY AUTOINCREMENT, tgl TEXT, judul TEXT NOT NULL,
     isi TEXT, warna TEXT, icon TEXT
   );
   CREATE TABLE IF NOT EXISTS transaksi(
     id TEXT PRIMARY KEY, tgl TEXT NOT NULL, user_id TEXT NOT NULL, nama TEXT,
     stasiun_id TEXT, kategori TEXT, item TEXT, berat REAL, harga INTEGER,
     satuan TEXT, total INTEGER, tipe TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'Selesai',
     FOREIGN KEY(user_id) REFERENCES users(id)
   );
   CREATE TABLE IF NOT EXISTS kas(
     id INTEGER PRIMARY KEY CHECK (id = 1), tunai INTEGER NOT NULL DEFAULT 0
   );`,
  `ALTER TABLE transaksi ADD COLUMN metode TEXT;`,
  `ALTER TABLE berita ADD COLUMN gambar TEXT;`,
];

function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrasi(v INTEGER PRIMARY KEY);`);
  const row = db.prepare('SELECT MAX(v) AS v FROM _migrasi').get();
  const current = row && row.v ? row.v : 0;
  MIGRATIONS.forEach((sql, i) => {
    const v = i + 1;
    if (v > current) {
      db.exec(sql);
      db.prepare('INSERT INTO _migrasi(v) VALUES (?)').run(v);
    }
  });
  seed(db);
}

function seed(db) {
  const n = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (n > 0) return; // sudah pernah di-seed
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  const nasabahPass = process.env.NASABAH_PASSWORD || 'nasabah123';
  const insUser = db.prepare(`INSERT INTO users
    (id, username, nama, password_hash, role, tel, nfc, saldo, total_kg, trx_count, sejak)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  for (const u of USERS) {
    const pw = u.role === 'admin' ? adminPass : nasabahPass;
    insUser.run(u.id, u.username, u.nama, bcrypt.hashSync(pw, 10), u.role,
      u.tel, u.nfc, u.saldo, u.totalKg, u.trxCount, u.sejak);
  }
  const insSt = db.prepare(`INSERT INTO stasiun
    (id, nama, lokasi, status, alamat, jam, lat, lng, trx_hari) VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const s of STASIUN) {
    insSt.run(s.id, s.nama, s.lokasi, s.status, s.alamat, s.jam, s.lat, s.lng, s.trxHari);
  }
  const insH = db.prepare('INSERT INTO harga(kategori, item, harga, satuan) VALUES (?,?,?,?)');
  for (const [kat, items] of Object.entries(HARGA)) {
    for (const [item, harga, satuan] of items) insH.run(kat, item, harga, satuan);
  }
  const insB = db.prepare('INSERT INTO berita(tgl, judul, isi, warna, icon) VALUES (?,?,?,?,?)');
  for (const b of BERITA) insB.run(b.tgl, b.judul, b.isi, b.warna, b.icon);
  db.prepare('INSERT INTO kas(id, tunai) VALUES (1, ?)').run(KAS_AWAL);
}

function rowToUser(r) {
  if (!r) return null;
  const { password_hash, ...pub } = r;
  return pub;
}

module.exports = { openDb, rowToUser };
