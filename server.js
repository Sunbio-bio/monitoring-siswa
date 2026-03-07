const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const path = require('path');

// Route untuk halaman Siswa (Utama)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route khusus untuk halaman Guru/Admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Mengizinkan akses file lain (seperti sekolah.jpg)
app.use(express.static(__dirname));

let daftarSiswa = [];

io.on('connection', (socket) => {
    socket.on('join_room', (data) => {
        const siswaBaru = { id: socket.id, nama: data.nama, roomCode: data.roomCode, isAnswering: false };
        daftarSiswa.push(siswaBaru);
        io.emit('update_meja', daftarSiswa);
    });

    socket.on('siswa_menjawab', (data) => {
        const siswa = daftarSiswa.find(s => s.id === socket.id);
        if (siswa) {
            siswa.isAnswering = true;
            io.emit('meja_terkunci', { pemenang: siswa.nama, idPemenang: socket.id });
            io.emit('update_meja', daftarSiswa);
        }
    });

    socket.on('disconnect', () => {
        daftarSiswa = daftarSiswa.filter(s => s.id !== socket.id);
        io.emit('update_meja', daftarSiswa);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Server Aktif!'));
