const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- DATABASE SEDERHANA DI MEMORI SERVER ---
let rooms = {};        // Menyimpan data siswa di tiap meja
let messageLog = [];   // Menyimpan riwayat chat agar tidak hilang saat refresh

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('User Terkoneksi:', socket.id);

    // --- LOGIKA SISWA BERGABUNG ---
    socket.on('join_room', (data) => {
        const { nama, roomCode } = data;
        socket.join(roomCode);
        
        if (!rooms[roomCode]) rooms[roomCode] = [];
        
        // Cek jika siswa sudah ada
        const existingSiswa = rooms[roomCode].find(s => s.nama === nama);
        if (!existingSiswa) {
            rooms[roomCode].push({
                id: socket.id,
                nama: nama,
                isAnswering: false
            });
        }

        // Update tampilan di meja siswa & dashboard admin
        io.to(roomCode).emit('update_meja', rooms[roomCode]);
        io.emit('update_semua_meja', rooms);
    });

    // --- LOGIKA ADMIN/GURU BERGABUNG ---
    socket.on('join_admin', () => {
        socket.join('admin_room');
        // Kirim data meja yang sudah ada
        socket.emit('update_semua_meja', rooms);
        // Kirim riwayat pesan agar tidak kosong saat refresh
        messageLog.forEach(msg => {
            socket.emit('notif_admin_khusus', msg);
        });
    });

    // --- GURU MENGIRIM SOAL ---
    socket.on('admin_kirim_soal', (data) => {
        let teksSoal = data.teks;
        if (data.tipe === 'otomatis') {
            const bankSoal = [
                "Sebutkan Ibukota Indonesia!",
                "Berapakah hasil dari 15 x 4?",
                "Apa lambang sila ke-3 Pancasila?",
                "Sebutkan planet terdekat dari Matahari!"
            ];
            teksSoal = bankSoal[Math.floor(Math.random() * bankSoal.length)];
        }
        // Kirim ke semua siswa
        io.emit('terima_soal_online', { pertanyaan: teksSoal });
        io.emit('meja_terbuka'); // Reset status kunci
    });

    // --- SISWA MENEKAN TOMBOL JAWAB ---
    socket.on('siswa_menjawab', (data) => {
        const { roomCode } = data;
        const siswa = rooms[roomCode]?.find(s => s.id === socket.id);
        
        if (siswa) {
            // Lock meja agar siswa lain tidak bisa klik dulu
            io.emit('meja_terkunci', { 
                pemenang: siswa.nama, 
                idPemenang: socket.id 
            });
            siswa.isAnswering = true;
            io.emit('update_semua_meja', rooms);
        }
    });

    // --- SISWA MENGIRIM JAWABAN ATAU PESAN BANTUAN ---
    socket.on('kirim_jawaban_ke_guru', (data) => {
        const payload = {
            socketId: socket.id,
            nama: data.nama,
            roomCode: data.roomCode,
            teks: data.teks,
            waktu: new Date().toLocaleTimeString()
        };
        
        // Simpan ke log server agar tidak hilang saat refresh
        messageLog.push(payload);
        if (messageLog.length > 50) messageLog.shift(); // Batasi 50 pesan terakhir

        io.emit('notif_admin_khusus', payload);
    });

    socket.on('panggil_guru', (data) => {
        const payload = {
            socketId: socket.id,
            nama: data.nama,
            roomCode: data.roomCode,
            teks: "🚨 MEMBUTUHKAN BANTUAN!",
            waktu: new Date().toLocaleTimeString()
        };
        messageLog.push(payload);
        io.emit('notif_admin_khusus', payload);
    });

    // --- GURU MEMBALAS PESAN (DUA ARAH) ---
    socket.on('guru_beri_izin', (data) => {
        // data.targetId adalah socket.id siswa
        // data.pesan adalah teks dari admin
        io.to(data.targetId).emit('notif_dari_guru', { 
            pesan: data.pesan 
        });
    });

    // --- LOGIKA DISCONNECT ---
    socket.on('disconnect', () => {
        for (let roomCode in rooms) {
            rooms[roomCode] = rooms[roomCode].filter(s => s.id !== socket.id);
            if (rooms[roomCode].length === 0) delete rooms[roomCode];
            else io.to(roomCode).emit('update_meja', rooms[roomCode]);
        }
        io.emit('update_semua_meja', rooms);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server jalan di http://localhost:${PORT}`);
});