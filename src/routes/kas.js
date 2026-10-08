'use strict';
const express = require('express');
const { requireAdmin } = require('../auth');

module.exports = function kasRoutes(db) {
  const r = express.Router();

  r.get('/', requireAdmin, (req, res) => {
    const kas = db.prepare('SELECT tunai FROM kas WHERE id = 1').get();
    const utang = db.prepare('SELECT COALESCE(SUM(saldo),0) AS total FROM users WHERE role = ?').get('nasabah').total;
    res.json({ kas: { tunai: kas.tunai, utang_nasabah: utang } });
  });

  /* Penyesuaian manual kas tunai (mis. terima uang dari pengepul). */
  r.post('/tambah', requireAdmin, (req, res) => {
    const { jumlah, keterangan } = req.body || {};
    if (!Number.isInteger(jumlah) || jumlah <= 0) {
      return res.status(400).json({ error: 'jumlah harus bilangan bulat > 0' });
    }
    db.prepare('UPDATE kas SET tunai = tunai + ? WHERE id = 1').run(jumlah);
    res.json({ ok: true, tunai: db.prepare('SELECT tunai FROM kas WHERE id = 1').get().tunai, keterangan: keterangan || '' });
  });

  return r;
};
