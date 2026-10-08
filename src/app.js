'use strict';
/* Factory aplikasi Express — dipisah dari server.js agar bisa dipakai test tanpa listen. */
const express = require('express');
const session = require('express-session');
const { openDb } = require('./db');
const { attachUser } = require('./auth');

function createApp(dbPath) {
  const db = openDb(dbPath);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  /* CATATAN PRODUKSI: MemoryStore bawaan TIDAK cocok untuk multi-proses/prod.
     Ganti dengan session store persisten (mis. connect-sqlite3) sebelum go-live. */
  app.use(session({
    name: 'nba.sid',
    secret: process.env.SESSION_SECRET || 'ganti-di-produksi',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 12 * 60 * 60 * 1000 },
  }));
  app.use(attachUser(db));

  app.get('/api/kesehatan', (req, res) => res.json({ ok: true, app: 'nba-backend', waktu: new Date().toISOString() }));
  app.use('/api/auth', require('./routes/auth')(db));
  app.use('/api/stasiun', require('./routes/stasiun')(db));
  app.use('/api/harga', require('./routes/harga')(db));
  app.use('/api/berita', require('./routes/berita')(db));
  app.use('/api/transaksi', require('./routes/transaksi')(db));
  app.use('/api/users', require('./routes/users')(db));
  app.use('/api/kas', require('./routes/kas')(db));

  app.use('/api', (req, res) => res.status(404).json({ error: 'endpoint tidak dikenal' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'kesalahan server' });
  });

  return { app, db };
}

module.exports = { createApp };
