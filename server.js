'use strict';
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const Room       = require('./game/Room');
const C          = require('./game/constants');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
    cors: { origin: '*' },
    pingTimeout: 20000,
});

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

function getOrCreateRoom(mode, duration) {
    for (const room of rooms.values()) {
        if (room.mode === mode && room.duration === duration &&
            !room.over && room.playerCount < C.MAX_PLAYERS) {
            return room;
        }
    }
    const room = new Room({ io, mode, duration });
    rooms.set(room.id, room);
    return room;
}

setInterval(() => {
    for (const [id, room] of rooms.entries()) {
        if (room.over) rooms.delete(id);
    }
}, 60_000);

io.on('connection', (socket) => {
    let currentRoom = null;
    let currentShip = null;

    socket.on('join', ({ name, title, clanTag, shipType,
                         sailColour, hullColour, mode, duration, roomId }) => {
        if (currentRoom) {
            currentRoom.removePlayer(socket.id);
            socket.leave(currentRoom.id);
        }
        const dur  = C.DURATIONS[duration] || 300;
        // Join specific room if requested and available, else find/create one
        const room = (roomId && rooms.has(roomId) && !rooms.get(roomId).over)
            ? rooms.get(roomId)
            : getOrCreateRoom(mode || 'dm', dur);
        currentRoom = room;
        socket.join(room.id);
        currentShip = room.addPlayer(socket.id, {
            name:       (name  || 'Anonymous').slice(0, 24),
            title:      title  || 'Captain',
            clanTag:    (clanTag || '').slice(0, 4).toUpperCase(),
            shipType:   Object.prototype.hasOwnProperty.call(C.SHIP_TYPES, shipType) ? shipType : 'frigate',
            sailColour: sailColour || '#f5f0e0',
            hullColour: hullColour || '#5D4037',
        });
        socket.emit('joined', {
            roomId:   room.id,
            shipId:   currentShip.id,
            mode:     room.mode,
            duration: room.duration,
            timeLeft: room.timeLeft,
        });
        socket.emit('chatHistory', room.chatLog.slice(-20));
    });

    socket.on('input', (input) => {
        if (currentRoom) currentRoom.applyInput(socket.id, input);
    });

    socket.on('fire', ({ cannonIdx }) => {
        if (currentRoom) currentRoom.fireCannon(socket.id, cannonIdx);
    });

    socket.on('broadside', ({ side }) => {
        if (side !== 'port' && side !== 'starboard') return;
        if (!currentRoom || !currentShip) return;
        const spec  = C.SHIP_TYPES[currentShip.shipType];
        const total = spec.cannonCount;
        const half  = Math.floor(total / 2);
        const start = side === 'port' ? 1 : half + 1;
        const end   = side === 'port' ? half : total - 1;
        for (let i = start; i <= end; i++) {
            const delay = (i - start) * 120;
            const snapRoom = currentRoom;
            setTimeout(() => snapRoom?.fireCannon(socket.id, i), delay);
        }
    });

    socket.on('chat', ({ text }) => {
        if (currentRoom && text) currentRoom.addChat(socket.id, text);
    });

    socket.on('disconnect', () => {
        if (currentRoom) {
            currentRoom.removePlayer(socket.id);
            if (currentRoom.playerCount === 0) {
                currentRoom.stop();
                rooms.delete(currentRoom.id);
            }
        }
    });
});

app.get('/api/rooms', (_req, res) => {
    const list = [];
    for (const room of rooms.values()) {
        if (!room.over) list.push({
            id: room.id, mode: room.mode, duration: room.duration,
            players: room.playerCount, max: C.MAX_PLAYERS, timeLeft: room.timeLeft,
        });
    }
    res.json(list);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`trafalgar.io server running on :${PORT}`));
