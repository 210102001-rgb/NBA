'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { rowToUser } = require('../db');

module.exports = function authRoutes(db) {
  const r = express.Router();

  r.post('/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username & password wajib' });
    const row = db.prepare('SELECT * FROM users WHERE username = ? AND aktif = 1').get(username);
    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      return res.status(401).json({ error: 'username/password salah' });
    }
    req.session.userId = row.id;
    req.session.role = row.role;
    res.json({ ok: true, user: rowToUser(row) });
  });

  r.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  /* Pendaftaran nasabah baru (publik). Langsung login setelah daftar. */
  r.post('/register', (req, res) => {
    const { nama, tel, alamat, password } = req.body || {};
    const telBersih = String(tel || '').replace(/\D/g, '');
    if (!nama || !nama.trim()) return res.status(400).json({ error: 'nama wajib' });
    if (telBersih.length < 10) return res.status(400).json({ error: 'no. HP minimal 10 digit' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'password minimal 6 karakter' });
    const last = db.prepare("SELECT id FROM users WHERE id LIKE 'NBA-2026-%' ORDER BY id DESC LIMIT 1").get();
    let n = 43;
    if (last) { const m = last.id.match(/(\d+)$/); if (m) n = parseInt(m[1], 10) + 1; }
    const pad = String(n).padStart(4, '0');
    const id = 'NBA-2026-' + pad;
    const sejak = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    try {
      db.prepare(`INSERT INTO users(id, username, nama, password_hash, role, tel, nfc, sejak)
                  VALUES (?,?,?,?, 'nasabah',?,?,?)`)
        .run(id, id, nama.trim(), bcrypt.hashSync(password, 10), telBersih, 'NFC-2026-' + pad, sejak);
    } catch (e) {
      return res.status(409).json({ error: 'pendaftaran gagal, coba lagi' });
    }
    req.session.userId = id;
    req.session.role = 'nasabah';
    res.status(201).json({ ok: true, user: rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
  });

  r.get('/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'belum login' });
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    res.json({ user: rowToUser(row) });
  });

  return r;
};
