'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { requireAdmin } = require('../auth');
const { rowToUser } = require('../db');

module.exports = function userRoutes(db) {
  const r = express.Router();

  r.get('/', requireAdmin, (req, res) => {
    const rows = db.prepare('SELECT * FROM users ORDER BY sejak').all().map(rowToUser);
    res.json({ users: rows });
  });

  r.post('/', requireAdmin, (req, res) => {
    const { id, username, nama, password, role, tel, nfc } = req.body || {};
    if (!id || !username || !nama || !password) {
      return res.status(400).json({ error: 'id, username, nama, password wajib' });
    }
    if (!['admin', 'nasabah'].includes(role || 'nasabah')) {
      return res.status(400).json({ error: 'role tidak valid' });
    }
    try {
      db.prepare(`INSERT INTO users(id, username, nama, password_hash, role, tel, nfc, sejak)
                  VALUES (?,?,?,?,?,?,?,?)`)
        .run(id, username, nama, bcrypt.hashSync(password, 10), role || 'nasabah', tel || '', nfc || null,
          new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }));
    } catch (e) {
      return res.status(409).json({ error: 'id/username/nfc sudah dipakai' });
    }
    res.status(201).json({ ok: true, user: rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
  });

  return r;
};
