'use strict';
/* Data seed — disalin dari prototipe web NBA (nba-proto-standalone.html)
   agar backend dan frontend bicara soal data yang sama. */

const STASIUN = [
  { id: 'ST-01', nama: 'Bank Sampah Gukub Rukun', lokasi: 'Kadipiro',     status: 'Online',      alamat: 'Jl. Kadipiro Raya No. 12',  jam: '07.00–16.00', lat: -7.5580, lng: 110.8005, trxHari: 38 },
  { id: 'ST-03', nama: 'BSU Pucang Cuan',         lokasi: 'Jebres',       status: 'Online',      alamat: 'Pucang Sawit RW 13, Jebres', jam: '08.00–15.00', lat: -7.5595, lng: 110.8610, trxHari: 31 },
  { id: 'ST-04', nama: 'BSU Anggrek',             lokasi: 'Purwosari',    status: 'Online',      alamat: 'Jl. Anggrek RT 01/RW 08, Purwosari', jam: '07.00–16.00', lat: -7.5710, lng: 110.7890, trxHari: 19 },
  { id: 'ST-07', nama: 'BSU Garuda Sakti',        lokasi: 'Banjarsari',   status: 'Online',      alamat: 'Jl. Garuda Sakti No. 01 RT 05/RW 11, Banjarsari', jam: '07.00–16.00', lat: -7.5525, lng: 110.8125, trxHari: 15 },
];

const HARGA = {
  Plastik: [
    ['Bodong Bersih', 3000, 'Kg'], ['Bodong Kotor', 2500, 'Kg'], ['Bodong Mix', 2750, 'Kg'],
    ['Gelas Bersih', 2750, 'Kg'], ['Gelas Kotor', 2000, 'Kg'],
    ['Tutup Galon', 3250, 'Kg'], ['Tutup Botol', 2500, 'Kg'],
  ],
  Kertas: [
    ['Kardus', 1500, 'Kg'], ['HVS', 1200, 'Kg'], ['Koran', 3000, 'Kg'],
    ['Buku/Buram/Duplex', 800, 'Kg'], ['Zak Semen', 2000, 'Kg'],
  ],
  Logam: [['Aluminium', 12000, 'Kg'], ['Besi', 4500, 'Kg'], ['Tembaga', 85000, 'Kg']],
  Kaca: [['Botol Kaca', 500, 'Kg']],
  Organik: [['Sampah Organik', 300, 'Kg']],
};

const BERITA = [
  { tgl: '28 Sep 2026', judul: '12 Titik S-cale Resmi Beroperasi di Surakarta', isi: 'Serah terima perangkat tahap pertama selesai, 340 warga terdaftar sebagai nasabah.', warna: 'linear-gradient(135deg,#2E9E4F,#7CB342)', icon: '♻️' },
  { tgl: '15 Sep 2026', judul: 'Harga Kardus Naik, Cek Daftar Terbaru', isi: 'Penyesuaian harga beli sampah kertas mengikuti harga pasar pengepul bulan ini.', warna: 'linear-gradient(135deg,#1E88E5,#64B5F6)', icon: '📰' },
  { tgl: '02 Sep 2026', judul: 'Sosialisasi Pilah Sampah di 6 Kelurahan', isi: 'Tim NBA edukasi 500+ warga soal memilah plastik, kertas, dan organik dari rumah.', warna: 'linear-gradient(135deg,#F59E0B,#F9A825)', icon: '🎓' },
];

/* Akun demo. Password default ADA DI README — wajib diganti via env di produksi. */
const USERS = [
  { id: 'ADMIN-01',     username: 'admin',        nama: 'Super Admin', role: 'admin',   tel: '-',            nfc: null,            saldo: 0,      totalKg: 0,    trxCount: 0,  sejak: '01 Agu 2026' },
  { id: 'NBA-2026-0042', username: 'NBA-2026-0042', nama: 'Andi',      role: 'nasabah', tel: '081245214521', nfc: 'NFC-2026-0042', saldo: 125000, totalKg: 28.5, trxCount: 24, sejak: '14 Agu 2026' },
  { id: 'NBA-2026-0038', username: 'NBA-2026-0038', nama: 'Siti',      role: 'nasabah', tel: '081377001122', nfc: 'NFC-2026-0038', saldo: 86250,  totalKg: 19.2, trxCount: 17, sejak: '02 Agu 2026' },
  { id: 'NBA-2026-0031', username: 'NBA-2026-0031', nama: 'Budi',      role: 'nasabah', tel: '085233445566', nfc: 'NFC-2026-0031', saldo: 41200,  totalKg: 19.2, trxCount: 9,  sejak: '21 Jul 2026' },
];

const KAS_AWAL = 4850000;

module.exports = { STASIUN, HARGA, BERITA, USERS, KAS_AWAL };
