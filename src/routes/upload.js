'use strict';
/* Upload gambar (dipakai form berita admin). Admin only.
   POST /api/upload  (multipart, field "file") -> { ok:true, file:"<nama>" }
   File disajikan di /api/uploads/<nama>. */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { requireAdmin } = require('../auth');

const DB_PATH = process.env.NBA_DB_PATH || path.join('data', 'nba.sqlite');
const UPLOADS_DIR = process.env.NBA_UPLOADS_PATH || path.join(path.dirname(DB_PATH), 'uploads');

function createUploadRoutes() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
      const safe = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
      cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + safe);
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, f, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(f.mimetype)),
  });

  const r = express.Router();
  r.post('/', requireAdmin, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'File gambar tidak valid (jpg/png/webp, maks 5MB)' });
    res.json({ ok: true, file: req.file.filename });
  });
  return { router: r, dir: UPLOADS_DIR };
}

module.exports = { createUploadRoutes };
