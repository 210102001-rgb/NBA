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

  r.get('/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'belum login' });
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    res.json({ user: rowToUser(row) });
  });

  return r;
};
