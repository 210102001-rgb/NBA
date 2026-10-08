'use strict';
const express = require('express');
const { requireAdmin } = require('../auth');

module.exports = function hargaRoutes(db) {
  const r = express.Router();

  r.get('/', (req, res) => {
    const rows = db.prepare('SELECT kategori, item, harga, satuan FROM harga ORDER BY kategori, item').all();
    const out = {};
    for (const x of rows) {
      (out[x.kategori] = out[x.kategori] || []).push({ item: x.item, harga: x.harga, satuan: x.satuan });
    }
    res.json({ harga: out });
  });

  r.get('/riwayat', (req, res) => {
    const rows = db.prepare('SELECT * FROM harga_riwayat ORDER BY id DESC LIMIT 100').all();
    res.json({ riwayat: rows });
  });

  /* Admin: tambah item harga baru. */
  r.post('/', requireAdmin, (req, res) => {
    const { kategori, item, harga, satuan } = req.body || {};
    if (!kategori || !item || harga === undefined) {
      return res.status(400).json({ error: 'kategori, item, harga wajib' });
    }
    if (!Number.isInteger(harga) || harga <= 0) {
      return res.status(400).json({ error: 'harga harus bilangan bulat > 0' });
    }
    try {
      db.prepare('INSERT INTO harga(kategori, item, harga, satuan) VALUES (?,?,?,?)')
        .run(kategori, item, harga, satuan || 'Kg');
    } catch (e) {
      return res.status(409).json({ error: 'item sudah ada di kategori ini' });
    }
    const tgl = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    db.prepare(`INSERT INTO harga_riwayat(tgl, kategori, item, harga_lama, harga_baru, alasan)
                VALUES (?,?,?,?,?,?)`).run(tgl, kategori, item, 0, harga, 'Item baru ditambahkan');
    res.status(201).json({ ok: true });
  });

  /* Admin: hapus item harga. */
  r.delete('/', requireAdmin, (req, res) => {
    const { kategori, item } = req.query;
    if (!kategori || !item) return res.status(400).json({ error: 'kategori & item wajib' });
    const info = db.prepare('DELETE FROM harga WHERE kategori = ? AND item = ?').run(kategori, item);
    if (info.changes === 0) return res.status(404).json({ error: 'item tidak ditemukan' });
    res.json({ ok: true });
  });
  /* Admin: ubah harga satu item; harga lama otomatis masuk riwayat. */
  r.put('/', requireAdmin, (req, res) => {
    const { kategori, item, harga_baru, alasan } = req.body || {};
    if (!kategori || !item || harga_baru === undefined) {
      return res.status(400).json({ error: 'kategori, item, harga_baru wajib' });
    }
    if (!Number.isInteger(harga_baru) || harga_baru < 0) {
      return res.status(400).json({ error: 'harga_baru harus bilangan bulat ≥ 0' });
    }
    const cur = db.prepare('SELECT * FROM harga WHERE kategori = ? AND item = ?').get(kategori, item);
    if (!cur) return res.status(404).json({ error: 'item harga tidak ditemukan' });
    const tgl = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    db.prepare('UPDATE harga SET harga = ? WHERE kategori = ? AND item = ?').run(harga_baru, kategori, item);
    db.prepare(`INSERT INTO harga_riwayat(tgl, kategori, item, harga_lama, harga_baru, alasan)
                VALUES (?,?,?,?,?,?)`).run(tgl, kategori, item, cur.harga, harga_baru, alasan || '');
    res.json({ ok: true, harga_lama: cur.harga, harga_baru });
  });

  return r;
};
