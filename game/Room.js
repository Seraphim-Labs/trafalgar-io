'use strict';
const { v4: uuidv4 } = require('uuid');
const Ship       = require('./Ship');
const Cannonball = require('./Cannonball');
const GameMode   = require('./GameMode');
const AIBot      = require('./AIBot');
const C          = require('./constants');

const SPAWN_POSITIONS = [
    { x:  400, z:  200, ry: Math.PI },
    { x: -400, z:  200, ry: 0 },
    { x:  400, z: -200, ry: Math.PI },
    { x: -400, z: -200, ry: 0 },
    { x:  600, z:    0, ry: Math.PI },
    { x: -600, z:    0, ry: 0 },
    { x:  300, z:  400, ry: Math.PI * 0.75 },
    { x: -300, z:  400, ry: Math.PI * 0.25 },
];

class Room {
    constructor({ io, mode = 'dm', duration = 300, roomId = uuidv4() }) {
        this.io       = io;
        this.id       = roomId;
        this.mode     = mode;
        this.duration = duration;
        this.timeLeft = duration;
        this.started  = false;
        this.over     = false;
        this.winner   = null;
        this.ships       = [];
        this.cannonballs = [];
        this.events      = [];
        this.chatLog     = [];
        this.gameMode    = new GameMode(mode);
        if (mode === 'ctf') this.gameMode.initCTF();
        this._spawnIdx = 0;
        this._interval = null;
        this._lastTick = Date.now();
    }

    addPlayer(socketId, { name, title, clanTag, shipType, sailColour, hullColour }) {
        const team = this._balanceTeam();
        const sp   = this._nextSpawn();
        const ship = new Ship({ socketId, name, title, clanTag, shipType, sailColour, hullColour, team, ...sp });
        this.ships.push(ship);
        this._ensureBots();
        if (!this.started) this.start();
        return ship;
    }

    removePlayer(socketId) {
        const idx = this.ships.findIndex(s => s.socketId === socketId);
        if (idx !== -1) this.ships.splice(idx, 1);
        this._ensureBots();
    }

    applyInput(socketId, input) {
        if (!input || typeof input !== 'object') return;
        const ship = this.ships.find(s => s.socketId === socketId);
        if (ship) ship.applyInput(input);
    }

    fireCannon(socketId, cannonIdx) {
        if (typeof cannonIdx !== 'number' || !Number.isInteger(cannonIdx) || cannonIdx < 0 || cannonIdx > 13) return;
        const ship = this.ships.find(s => s.socketId === socketId);
        if (ship) this.fireCannonFromShip(ship, cannonIdx);
    }

    fireCannonFromShip(ship, idx) {
        if (!ship.canFireCannon(idx)) return;
        ship.reloadTimes[idx] = Date.now();
        const dir    = ship.fireCannonDir(idx);
        const spread = ship.isBot ? (0.06 - ship.aiSkill * 0.04) : 0.02;
        const sx = dir.x + (Math.random() - 0.5) * spread;
        const sz = dir.z + (Math.random() - 0.5) * spread;
        const mag = Math.sqrt(sx*sx + sz*sz) || 1;
        this.cannonballs.push(new Cannonball({
            ownerId: ship.id, ownerTeam: ship.team,
            startX: ship.x, startY: 3, startZ: ship.z,
            dirX: sx/mag, dirZ: sz/mag,
        }));
        this.events.push({ type: 'fire', shipId: ship.id, cannonIdx: idx });
    }

    addChat(socketId, text) {
        const ship = this.ships.find(s => s.socketId === socketId);
        const name = ship ? ship.displayName : 'Unknown';
        const msg  = { name, text: String(text).slice(0, 200), ts: Date.now() };
        this.chatLog.push(msg);
        if (this.chatLog.length > 50) this.chatLog.shift();
        this.io.to(this.id).emit('chat', msg);
    }

    start() {
        this.started = true;
        if (this.mode === 'capital') this._spawnCapital();
        this._interval = setInterval(() => this._tick(), C.TICK_MS);
    }

    stop() {
        if (this._interval) { clearInterval(this._interval); this._interval = null; }
    }

    _tick() {
        const now = Date.now();
        const dt  = (now - this._lastTick) / C.TICK_MS;
        this._lastTick = now;
        if (this.over) return;

        this.timeLeft -= C.TICK_MS / 1000;

        for (const ship of this.ships) {
            if (ship.isBot) AIBot.updateAI(ship, this.ships, this, dt);
        }
        for (const ship of this.ships) ship.tick(dt);

        for (let i = this.cannonballs.length - 1; i >= 0; i--) {
            const b = this.cannonballs[i];
            b.tick(dt);
            if (b.dead) { this.cannonballs.splice(i, 1); continue; }
            for (const ship of this.ships) {
                if (ship.id === b.ownerId || ship.isDead) continue;
                const dx = b.x - ship.x, dz = b.z - ship.z;
                if (Math.sqrt(dx*dx + dz*dz) < C.HIT_RADIUS) {
                    const dmg  = 0.12 + Math.random() * 0.08;
                    const sank = ship.takeDamage(dmg);
                    this.events.push({ type: 'hit', shipId: ship.id, dmg });
                    if (sank) {
                        const attacker = this.ships.find(s => s.id === b.ownerId);
                        if (attacker) { attacker.killCount++; attacker.score++; }
                        this.events.push({ type: 'sank', shipId: ship.id, by: b.ownerId });
                    }
                    b.dead = true;
                    break;
                }
            }
        }

        this.gameMode.update(this.ships, this.events);

        if (this.gameMode.checkWin(this.ships, this.timeLeft)) {
            this.over   = true;
            this.winner = this.gameMode.getWinner(this.ships);
            this.io.to(this.id).emit('gameOver', { winner: this.winner });
            this.stop();
            return;
        }

        this._handleDeaths();

        this.io.to(this.id).emit('state', this._serialize());
        this.events = [];
    }

    _serialize() {
        return {
            timeLeft:    Math.max(0, this.timeLeft),
            ships:       this.ships.map(s => s.serialize()),
            cannonballs: this.cannonballs.map(b => b.serialize()),
            events:      this.events,
            flags:       this.gameMode.serializeFlags(),
            mode:        this.mode,
        };
    }

    _balanceTeam() {
        const reds  = this.ships.filter(s => s.team === 'red').length;
        const blues = this.ships.filter(s => s.team === 'blue').length;
        return reds <= blues ? 'red' : 'blue';
    }

    _nextSpawn() {
        const sp = SPAWN_POSITIONS[this._spawnIdx % SPAWN_POSITIONS.length];
        this._spawnIdx++;
        return { x: sp.x + (Math.random()-0.5)*40, z: sp.z + (Math.random()-0.5)*40, ry: sp.ry };
    }

    _ensureBots() {
        const humanCount   = this.ships.filter(s => !s.isBot).length;
        const botCount     = this.ships.filter(s => s.isBot).length;  // include capital
        const need = Math.max(0, C.MIN_COMBATANTS - humanCount - botCount);
        for (let i = 0; i < need; i++) {
            const team = this._balanceTeam();
            const sp   = this._nextSpawn();
            const types = ['sloop','frigate','frigate','sotl'];
            const bot  = new Ship({
                name: AIBot.newBotName(), title: AIBot.newBotTitle(),
                shipType:   types[Math.floor(Math.random()*types.length)],
                sailColour: C.SAIL_COLOURS[Math.floor(Math.random()*C.SAIL_COLOURS.length)][1],
                hullColour: C.HULL_COLOURS[Math.floor(Math.random()*C.HULL_COLOURS.length)][1],
                team, isBot: true, ...sp,
            });
            bot.aiAggression = 0.4 + Math.random() * 0.6;
            bot.aiSkill      = 0.5 + Math.random() * 0.5;
            this.ships.push(bot);
        }
    }

    _spawnCapital() {
        const cap = new Ship({
            name: 'HMS Sovereign', title: 'Admiral',
            shipType: 'capital', sailColour: '#f5f0e0', hullColour: '#5D4037',
            team: 'red', isBot: true, isCapital: true,
            x: 0, z: 0, ry: 0,
        });
        cap.aiAggression = 0.3; cap.aiSkill = 0.5;
        this.ships.push(cap);
        this.gameMode.capitalShipId = cap.id;
    }

    _handleDeaths() {
        for (let i = this.ships.length - 1; i >= 0; i--) {
            if (this.ships[i].isDead && this.ships[i].isBot && !this.ships[i].isCapital) {
                this.ships.splice(i, 1);
            }
        }
        this._ensureBots();
    }

    get playerCount() {
        return this.ships.filter(s => !s.isBot).length;
    }
}

module.exports = Room;
