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

  /* Admin: ubah data nasabah — nama, tel, status aktif, dan/atau reset password. */
  r.put('/:id', requireAdmin, (req, res) => {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!u) return res.status(404).json({ error: 'user tidak ditemukan' });
    const { nama, tel, aktif, password } = req.body || {};
    if (req.params.id === req.session.userId && aktif === false) {
      return res.status(400).json({ error: 'tidak bisa menonaktifkan akun sendiri' });
    }
    const updates = [];
    const params = [];
    if (nama !== undefined) {
      if (!String(nama).trim()) return res.status(400).json({ error: 'nama wajib' });
      updates.push('nama = ?'); params.push(String(nama).trim());
    }
    if (tel !== undefined) { updates.push('tel = ?'); params.push(String(tel).replace(/\D/g, '')); }
    if (aktif !== undefined) { updates.push('aktif = ?'); params.push(aktif ? 1 : 0); }
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'password minimal 6 karakter' });
      updates.push('password_hash = ?'); params.push(bcrypt.hashSync(password, 10));
    }
    if (!updates.length) return res.status(400).json({ error: 'tidak ada perubahan' });
    params.push(req.params.id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json({ ok: true, user: rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)) });
  });

  return r;
};
