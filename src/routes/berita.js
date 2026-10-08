'use strict';
const express = require('express');
const { requireAdmin } = require('../auth');

module.exports = function beritaRoutes(db) {
  const r = express.Router();

  r.get('/', (req, res) => {
    res.json({ berita: db.prepare('SELECT * FROM berita ORDER BY id DESC').all() });
  });

  r.post('/', requireAdmin, (req, res) => {
    const { tgl, judul, isi, warna, icon, gambar } = req.body || {};
    if (!judul) return res.status(400).json({ error: 'judul wajib' });
    const info = db.prepare('INSERT INTO berita(tgl, judul, isi, warna, icon, gambar) VALUES (?,?,?,?,?,?)')
      .run(tgl || '', judul, isi || '', warna || '', icon || '', gambar || null);
    res.status(201).json({ ok: true, berita: db.prepare('SELECT * FROM berita WHERE id = ?').get(info.lastInsertRowid) });
  });

  r.put('/:id', requireAdmin, (req, res) => {
    const cur = db.prepare('SELECT * FROM berita WHERE id = ?').get(req.params.id);
    if (!cur) return res.status(404).json({ error: 'berita tidak ditemukan' });
    const b = req.body || {};
    db.prepare('UPDATE berita SET tgl=?, judul=?, isi=?, warna=?, icon=?, gambar=? WHERE id=?')
      .run(b.tgl ?? cur.tgl, b.judul ?? cur.judul, b.isi ?? cur.isi, b.warna ?? cur.warna, b.icon ?? cur.icon, b.gambar ?? cur.gambar, req.params.id);
    res.json({ ok: true, berita: db.prepare('SELECT * FROM berita WHERE id = ?').get(req.params.id) });
  });

  r.delete('/:id', requireAdmin, (req, res) => {
    const info = db.prepare('DELETE FROM berita WHERE id = ?').run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'berita tidak ditemukan' });
    res.json({ ok: true });
  });

  return r;
};
