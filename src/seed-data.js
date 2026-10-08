'use strict';
/* Data seed — disalin dari prototipe web NBA (nba-proto-standalone.html)
   agar backend dan frontend bicara soal data yang sama. */

const STASIUN = [
  { id: 'ST-01', nama: 'Bank Sampah Gukub Rukun', lokasi: 'Kadipiro',     status: 'Online',      alamat: 'Jl. Kadipiro Raya No. 12',  jam: '07.00–16.00', lat: -7.5580, lng: 110.8005, trxHari: 38 },
  { id: 'ST-02', nama: 'BSU Mojosongo',           lokasi: 'Mojosongo',    status: 'Online',      alamat: 'Jl. Mojosongo No. 45',      jam: '07.00–16.00', lat: -7.5515, lng: 110.8455, trxHari: 24 },
  { id: 'ST-03', nama: 'BSU Jebres',              lokasi: 'Jebres',       status: 'Online',      alamat: 'Jl. Ki Hajar Dewantara No. 8', jam: '08.00–15.00', lat: -7.5595, lng: 110.8610, trxHari: 31 },
  { id: 'ST-04', nama: 'BSU Laweyan',             lokasi: 'Laweyan',      status: 'Online',      alamat: 'Jl. Dr. Rajiman No. 21',    jam: '07.00–16.00', lat: -7.5710, lng: 110.7890, trxHari: 19 },
  { id: 'ST-05', nama: 'BSU Serengan',            lokasi: 'Serengan',     status: 'Offline',     alamat: 'Jl. Veteran No. 88',        jam: '08.00–15.00', lat: -7.5835, lng: 110.8245, trxHari: 0 },
  { id: 'ST-06', nama: 'BSU Pasar Kliwon',        lokasi: 'Pasar Kliwon', status: 'Maintenance', alamat: 'Jl. Kapten Mulyadi No. 3',  jam: '07.00–16.00', lat: -7.5765, lng: 110.8310, trxHari: 0 },
  { id: 'ST-07', nama: 'BSU Nusukan',             lokasi: 'Nusukan',      status: 'Online',      alamat: 'Jl. Letjen Sutoyo No. 64',  jam: '07.00–16.00', lat: -7.5525, lng: 110.8125, trxHari: 15 },
  { id: 'ST-08', nama: 'BSU Pajang',              lokasi: 'Pajang',       status: 'Online',      alamat: 'Jl. Pajang No. 27',         jam: '07.00–16.00', lat: -7.5780, lng: 110.7950, trxHari: 11 },
  { id: 'ST-09', nama: 'BSU Danukusuman',         lokasi: 'Danukusuman',  status: 'Online',      alamat: 'Jl. Honggowongso No. 52',   jam: '08.00–15.00', lat: -7.5880, lng: 110.8200, trxHari: 9 },
  { id: 'ST-10', nama: 'BSU Semanggi',            lokasi: 'Semanggi',     status: 'Online',      alamat: 'Jl. Semanggi No. 19',       jam: '07.00–16.00', lat: -7.5720, lng: 110.8450, trxHari: 13 },
  { id: 'ST-11', nama: 'BSU Tegalharjo',          lokasi: 'Tegalharjo',   status: 'Maintenance', alamat: 'Jl. Tegalharjo No. 33',      jam: '08.00–15.00', lat: -7.5660, lng: 110.8500, trxHari: 0 },
  { id: 'ST-12', nama: 'BSU Sumber',              lokasi: 'Sumber',       status: 'Offline',     alamat: 'Jl. Sumber No. 41',         jam: '07.00–16.00', lat: -7.5480, lng: 110.8050, trxHari: 0 },
];

const HARGA = {
  Plastik: [
    ['Bodongan Kotor', 2500, 'Kg'], ['Bodongan Bersih Mix', 3000, 'Kg'], ['Bodongan Bersih BM', 3250, 'Kg'],
    ['Bodongan Bersih BN', 3500, 'Kg'], ['Bodongan KW', 1000, 'Kg'], ['Galon PVC 19L', 2750, 'buah'],
    ['Galon PET 15L', 1000, 'buah'], ['PET Kecil', 3000, 'Kg'], ['Gelasan Bening Kotor', 2000, 'Kg'],
    ['Gelasan Bening Bersih', 2750, 'Kg'], ['Gelasan Sablon', 1200, 'Kg'], ['Gelasan Ale/Warna PK', 1000, 'Kg'],
    ['Tutup Air Mineral', 2500, 'Kg'], ['Tutup Galon Isi Ulang', 3000, 'Kg'], ['Tutup Galon Aqua/VIT', 3500, 'Kg'],
    ['Plastik Daun Bening', 1400, 'Kg'], ['Plastik Daun Warna', 1200, 'Kg'], ['Plastik Daun Hitam', 800, 'Kg'],
    ['Emberan', 1350, 'Kg'], ['Karung Tidak Robek', 1300, 'Kg'], ['Karung Robek', 800, 'Kg'],
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
