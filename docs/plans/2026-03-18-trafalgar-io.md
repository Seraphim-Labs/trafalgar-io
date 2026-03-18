# Trafalgar.io — Full Multiplayer IO Game Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build trafalgar.io — a browser-based multiplayer naval battle IO game with 3 game modes, ship/captain customisation, chat, clans, and convincing AI bots that fill empty slots, deployable for free on Render + Netlify.

**Architecture:** Server-authoritative Node.js + Socket.io backend runs the game loop at 20 Hz and broadcasts full game state to all clients; the Three.js frontend renders received state and sends only player input events to the server. AI bots run server-side using ported physics identical to the solo game. The single-player Trafalgar project is untouched — this is a brand-new repo at `trafalgar-io/`.

**Tech Stack:** Node.js 18+, Express 4, Socket.io 4, Three.js 0.160 (CDN), Render.com (free backend), Netlify (free frontend), no database (localStorage for preferences, in-memory for match state).

---

## Design Decisions (all made here — no input needed)

| Topic | Decision |
|---|---|
| Networking | Full state broadcast every tick (50 ms), no delta compression yet |
| Auth | No auth — players enter a name, get a UUID session |
| Persistence | Clan tag + captain name stored in localStorage only |
| Ship types | 3: Sloop (fast/light), Frigate (balanced), Ship-of-the-Line (slow/heavy) |
| Sail colours | 8 presets stored as flag colour on ship object |
| Team assignment | Auto-balance on join |
| AI bots | Fill room to minimum 4 combatants; named after historical captains |
| Map | Flat ocean, 2000×2000 world units, fog at edges |
| Game modes | Deathmatch, Capture the Flag, Sink the Capital Ship |
| Match durations | 3 / 5 / 10 minutes selectable in lobby |
| Capital ship | Controlled by AI, 3× HP, 12 cannons |
| Chat | Global per room, Enter to focus, Esc to blur |
| Enable multiplayer | Set env var `PORT` on Render — frontend auto-detects server URL |

---

## File Structure

```
trafalgar-io/
├── package.json
├── server.js                  # Express + Socket.io entry point
├── .env.example               # PORT=3001 SERVER_URL=http://localhost:3001
├── render.yaml                # Render.com deploy config (one click deploy)
├── game/
│   ├── constants.js           # Physics, map, tick rate — shared truth
│   ├── Ship.js                # Server-side ship entity + physics
│   ├── Cannonball.js          # Projectile entity + physics
│   ├── AIBot.js               # State-machine AI (ported from solo game)
│   ├── GameMode.js            # DM / CTF / Capital Ship rules + win condition
│   └── Room.js                # Match container: loop, state, bots, broadcast
├── public/
│   ├── index.html             # Lobby: name, ship pick, mode select, join
│   ├── game.html              # In-game Three.js canvas + HUD overlays
│   ├── css/
│   │   └── style.css          # Shared dark naval theme
│   ├── js/
│   │   ├── config.js          # SERVER_URL (edit once to point at backend)
│   │   ├── lobby.js           # Lobby UI, room list, customisation
│   │   ├── shipModels.js      # 3 voxel ship datasets + colour helpers
│   │   ├── game.js            # Three.js scene, rendering, input capture
│   │   ├── multiplayer.js     # Socket.io client, state apply, event emit
│   │   ├── hud.js             # Scoreboard, timer, kill feed, mode UI
│   │   ├── customisation.js   # Captain + ship UI (sail/hull colour picker)
│   │   ├── chat.js            # Chat overlay (Enter / Esc)
│   │   └── clans.js           # Clan tag: create/join/leave via localStorage
│   └── music/                 # Copied from solo project
│       ├── InStormAndSunshine.mp3
│       ├── FlorentinerMarch.mp3
│       ├── Zacatecas.mp3
│       └── UnderTheDoubleEagle.mp3
└── docs/
    └── plans/
        └── 2026-03-18-trafalgar-io.md
```

---

## Task 1: Project Bootstrap

**Files:**
- Create: `trafalgar-io/package.json`
- Create: `trafalgar-io/.env.example`
- Create: `trafalgar-io/render.yaml`
- Create: `trafalgar-io/public/js/config.js`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "trafalgar-io",
  "version": "1.0.0",
  "type": "commonjs",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.2",
    "uuid": "^9.0.0"
  }
}
```

- [ ] **Step 2: Create `.env.example`**

```
PORT=3001
```

- [ ] **Step 3: Create `render.yaml`** (one-click Render deploy)

```yaml
services:
  - type: web
    name: trafalgar-io
    runtime: node
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: PORT
        value: 10000
    plan: free
```

- [ ] **Step 4: Create `public/js/config.js`**

```js
// Edit SERVER_URL to point at your Render backend.
// Leave as empty string to use same-origin (if serving frontend from Node).
window.TRAFALGAR_SERVER = 'http://localhost:3001';
```

- [ ] **Step 5: Install dependencies**

```bash
cd trafalgar-io
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Copy music files**

```bash
cp -r "../Trafalgar/music" "public/music"
```

---

## Task 2: Shared Constants

**Files:**
- Create: `trafalgar-io/game/constants.js`

- [ ] **Step 1: Create `game/constants.js`**

```js
'use strict';

module.exports = {
    // Server
    TICK_MS:        50,        // 20 Hz
    MAX_PLAYERS:    8,
    MIN_COMBATANTS: 4,         // fill with bots below this

    // Map
    MAP_SIZE:       2000,

    // Physics (per tick, ~60fps equivalent at 20Hz scaled)
    GRAVITY:        0.014 * 2.5,   // scaled for 20Hz
    BALL_SPEED:     7.5 * 2.5,
    BALL_Y0:        0.18 * 2.5,
    HIT_RADIUS:     10,

    // Ship types
    SHIP_TYPES: {
        sloop: {
            maxSpeed:    0.30 * 2.5,
            turnRate:    0.0012 * 2.5,
            maxHp:       4,
            cannonCount: 3,    // 1 port, 1 starboard, 1 bow
            scale:       0.45,
            label:       'Sloop',
            desc:        'Fast, light. Best for capture missions.',
        },
        frigate: {
            maxSpeed:    0.22 * 2.5,
            turnRate:    0.0008 * 2.5,
            maxHp:       7,
            cannonCount: 7,
            scale:       0.6,
            label:       'Frigate',
            desc:        'Balanced. The classic broadside warship.',
        },
        sotl: {
            maxSpeed:    0.14 * 2.5,
            turnRate:    0.0005 * 2.5,
            maxHp:       12,
            cannonCount: 12,
            scale:       0.8,
            label:       'Ship of the Line',
            desc:        'Slow but devastating. Heavy broadside firepower.',
        },
        capital: {
            maxSpeed:    0.08 * 2.5,
            turnRate:    0.0003 * 2.5,
            maxHp:       25,
            cannonCount: 14,
            scale:       1.0,
            label:       'Capital Ship',
            desc:        'The flagship. Sink her to win.',
        },
    },

    // Sail colour presets [name, hex]
    SAIL_COLOURS: [
        ['Ivory',   '#f5f0e0'],
        ['Crimson', '#cc2222'],
        ['Ocean',   '#2255aa'],
        ['Midnight','#1a1a3a'],
        ['Gold',    '#d4a017'],
        ['Forest',  '#2a5e2a'],
        ['Obsidian','#222222'],
        ['Blood',   '#8b0000'],
    ],

    // Hull colour presets
    HULL_COLOURS: [
        ['Oak',    '#5D4037'],
        ['Ebony',  '#2c1a0e'],
        ['Coral',  '#a05020'],
        ['Slate',  '#445566'],
    ],

    // Game modes
    MODES: {
        dm:      { label: 'Deathmatch',          scoreLabel: 'Kills' },
        ctf:     { label: 'Capture the Flag',    scoreLabel: 'Captures' },
        capital: { label: 'Sink the Capital Ship', scoreLabel: 'Damage' },
    },

    DURATIONS: { '3m': 180, '5m': 300, '10m': 600 },

    // CTF
    CTF_FLAG_CAPTURE_R: 18,
    CTF_BASE_R:         30,

    // Captain titles
    TITLES: ['Captain','Admiral','Commodore','Commander','Rear-Admiral','Vice-Admiral','Ensign','Boatswain'],
};
```

---

## Task 3: Server-Side Ship Entity

**Files:**
- Create: `trafalgar-io/game/Ship.js`
- Create: `trafalgar-io/game/Cannonball.js`

- [ ] **Step 1: Create `game/Ship.js`**

```js
'use strict';
const { v4: uuidv4 } = require('uuid');
const C = require('./constants');

class Ship {
    constructor({ socketId = null, name, title = 'Captain', clanTag = '',
                  shipType = 'frigate', sailColour = '#f5f0e0',
                  hullColour = '#5D4037', team, x = 0, z = 0, ry = 0,
                  isBot = false, isCapital = false }) {

        this.id          = socketId || uuidv4();
        this.socketId    = socketId;
        this.name        = name;
        this.title       = title;
        this.clanTag     = clanTag;
        this.displayName = (clanTag ? `[${clanTag}] ` : '') + name;
        this.shipType    = isCapital ? 'capital' : shipType;
        this.sailColour  = sailColour;
        this.hullColour  = hullColour;
        this.team        = team;
        this.isBot       = isBot;
        this.isCapital   = isCapital;

        const spec       = C.SHIP_TYPES[this.shipType];
        this.maxHp       = spec.maxHp;
        this.hp          = spec.maxHp;
        this.maxSpeed    = spec.maxSpeed;
        this.turnRate    = spec.turnRate;

        this.x           = x;
        this.y           = 0;
        this.z           = z;
        this.ry          = ry;
        this.vel         = 0;
        this.turnVel     = 0;

        this.isSinking   = false;
        this.isDead      = false;
        this.killCount   = 0;
        this.score       = 0;          // mode-specific
        this.hasFlag     = false;      // CTF

        this.reloadTimes = new Array(14).fill(0);   // ms timestamps
        this.lastBroadsideTime = 0;
        this.aiState     = 'APPROACH';
        this.aiTarget    = null;
        this.aiStateTimer = 0;
        this.aiAggression = 0.5 + Math.random() * 0.5;
        this.aiSkill     = 0.6 + Math.random() * 0.4;
    }

    tick(dt) {
        if (this.isDead || this.isSinking) {
            if (this.isSinking) {
                this.y -= 0.06 * dt;
                if (this.y < -30) this.isDead = true;
            }
            return;
        }

        this.vel     *= Math.pow(0.985, dt);
        this.turnVel *= Math.pow(0.93,  dt);
        this.ry      += this.turnVel * dt;

        const fwdX = Math.cos(this.ry - Math.PI / 2);
        const fwdZ = Math.sin(this.ry - Math.PI / 2);
        this.x += fwdX * this.vel * dt;
        this.z += fwdZ * this.vel * dt;

        // Soft world boundary
        const half = C.MAP_SIZE / 2 - 50;
        if (Math.abs(this.x) > half) { this.x = Math.sign(this.x) * half; this.vel *= -0.3; }
        if (Math.abs(this.z) > half) { this.z = Math.sign(this.z) * half; this.vel *= -0.3; }
    }

    applyInput({ w, s, a, d }) {
        if (this.isDead || this.isSinking) return;
        const spec = C.SHIP_TYPES[this.shipType];
        if (w) this.vel = Math.min(this.vel + 0.004 * 2.5, spec.maxSpeed);
        if (s) this.vel = Math.max(this.vel - 0.004 * 2.5, -spec.maxSpeed * 0.5);
        if (a) this.turnVel += 0.0005 * 2.5;
        if (d) this.turnVel -= 0.0005 * 2.5;
    }

    takeDamage(dmg, attackerId) {
        if (this.isDead || this.isSinking) return false;
        this.hp -= dmg;
        if (this.hp <= 0 && !this.isSinking) {
            this.hp = 0;
            this.isSinking = true;
            this.hasFlag = false;
            return true;   // just sank
        }
        return false;
    }

    canFireCannon(idx) {
        const now = Date.now();
        const cooldown = 2500;
        return (now - (this.reloadTimes[idx] || 0)) >= cooldown;
    }

    fireCannonDir(idx) {
        // Returns world-space direction vector for this cannon
        // Cannon layout: 0 = bow, 1-3 = port, 4-6 = starboard (frigate/SotL)
        // Sloop: 0 = bow, 1 = port, 2 = starboard
        const isPort = idx >= 1 && idx <= Math.floor(C.SHIP_TYPES[this.shipType].cannonCount / 2);
        const isStbd = !isPort && idx > 0;

        let localX = 1, localZ = 0;
        if (isPort) { localX = 0; localZ = -1; }
        else if (isStbd) { localX = 0; localZ = 1; }

        // Rotate by ship heading
        const cos = Math.cos(this.ry);
        const sin = Math.sin(this.ry);
        return {
            x: localX * cos - localZ * sin,
            z: localX * sin + localZ * cos,
        };
    }

    serialize() {
        return {
            id:          this.id,
            name:        this.displayName,
            shipType:    this.shipType,
            sailColour:  this.sailColour,
            hullColour:  this.hullColour,
            team:        this.team,
            isBot:       this.isBot,
            isCapital:   this.isCapital,
            x: this.x, y: this.y, z: this.z, ry: this.ry,
            vel:         this.vel,
            hp:          this.hp,
            maxHp:       this.maxHp,
            isSinking:   this.isSinking,
            isDead:      this.isDead,
            killCount:   this.killCount,
            score:       this.score,
            hasFlag:     this.hasFlag,
        };
    }
}

module.exports = Ship;
```

- [ ] **Step 2: Create `game/Cannonball.js`**

```js
'use strict';
const { v4: uuidv4 } = require('uuid');
const C = require('./constants');

class Cannonball {
    constructor({ ownerId, ownerTeam, startX, startY, startZ, dirX, dirZ }) {
        this.id        = uuidv4();
        this.ownerId   = ownerId;
        this.ownerTeam = ownerTeam;
        this.x         = startX;
        this.y         = startY || 3;
        this.z         = startZ;
        this.vx        = dirX * C.BALL_SPEED;
        this.vy        = C.BALL_Y0;
        this.vz        = dirZ * C.BALL_SPEED;
        this.age       = 0;
        this.dead      = false;
    }

    tick(dt) {
        this.vy -= C.GRAVITY * dt;
        this.x  += this.vx * dt;
        this.y  += this.vy * dt;
        this.z  += this.vz * dt;
        this.age += dt;
        if (this.y < 0.5 || this.age > 180) this.dead = true;
    }

    serialize() {
        return { id: this.id, x: this.x, y: this.y, z: this.z };
    }
}

module.exports = Cannonball;
```

---

## Task 4: AI Bot Logic

**Files:**
- Create: `trafalgar-io/game/AIBot.js`

- [ ] **Step 1: Create `game/AIBot.js`**

The AI is a port of the solo game's state machine, adapted for server-side tick.

```js
'use strict';
const C = require('./constants');

// Historical captain names for immersion
const BOT_NAMES = [
    'Lord Collingwood','Cuthbert Nelson','James Hardy','Thomas Fremantle',
    'Charles Bullen','Henry Blackwood','Edward Berry','Israel Pellew',
    'George Duff','William Hargood','John Conn','Richard King',
    'Robert Moorsom','John Cooke','Charles Tyler','William Rutherford',
];
const BOT_TITLES = ['Captain','Commodore','Admiral','Commander','Rear-Admiral'];

let _botIdx = 0;
function newBotName() {
    const n = BOT_NAMES[_botIdx % BOT_NAMES.length];
    _botIdx++;
    return n;
}
function newBotTitle() {
    return BOT_TITLES[Math.floor(Math.random() * BOT_TITLES.length)];
}

function dist2d(a, b) {
    const dx = a.x - b.x, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
}

function angleDiff(a, b) {
    let d = a - b;
    while (d < -Math.PI) d += Math.PI * 2;
    while (d >  Math.PI) d -= Math.PI * 2;
    return d;
}

function pickTarget(ship, allShips) {
    let best = null, bestScore = -Infinity;
    for (const o of allShips) {
        if (o.team === ship.team || o.isSinking || o.isDead) continue;
        const d = dist2d(ship, o);
        let score = 1000 - d + (1 - o.hp / o.maxHp) * 500;
        if (score > bestScore) { bestScore = score; best = o; }
    }
    return best;
}

function updateAI(ship, allShips, room, dt) {
    if (ship.isDead || ship.isSinking) return;

    ship.aiStateTimer += dt;

    // Re-pick target every 8 ticks or if current target gone
    if (!ship.aiTarget || ship.aiTarget.isSinking || ship.aiTarget.isDead ||
        ship.aiStateTimer > 8) {
        ship.aiTarget = pickTarget(ship, allShips);
        if (ship.aiStateTimer > 8) ship.aiStateTimer = 0;
    }

    const target = ship.aiTarget;
    if (!target) {
        ship.vel *= 0.98;
        return;
    }

    const dx = target.x - ship.x;
    const dz = target.z - ship.z;
    const d  = Math.sqrt(dx * dx + dz * dz);
    const toTargetAngle = Math.atan2(dx, dz) - Math.PI / 2;

    // Dot products in ship local frame
    const fwdX = Math.cos(ship.ry - Math.PI / 2);
    const fwdZ = Math.sin(ship.ry - Math.PI / 2);
    const rtX  = Math.cos(ship.ry);
    const rtZ  = Math.sin(ship.ry);
    const dotFwd  = fwdX * dx / d + fwdZ * dz / d;
    const dotSide = rtX  * dx / d + rtZ  * dz / d;
    const broadsideAlign = Math.abs(dotSide);
    const side = dotSide > 0 ? 'starboard' : 'port';

    const spec    = C.SHIP_TYPES[ship.shipType];
    const hpFact  = ship.hp / ship.maxHp;
    const maxSpd  = spec.maxSpeed * (0.5 + hpFact * 0.5);

    if (hpFact < 0.25 && d < 150) ship.aiState = 'DISENGAGE';
    else if (d > 350) ship.aiState = 'APPROACH';
    else if (d < 250 && broadsideAlign > 0.7) ship.aiState = 'BROADSIDE';
    else ship.aiState = 'MANEUVER';

    if (ship.aiState === 'APPROACH') {
        const diff = angleDiff(toTargetAngle, ship.ry);
        ship.ry += diff * 0.025 * ship.aiSkill;
        ship.vel += (maxSpd - ship.vel) * 0.008;
    } else if (ship.aiState === 'BROADSIDE') {
        const perp = { x: -dz / d, z: dx / d };
        const perpAngle = Math.atan2(perp.x, perp.z) - Math.PI / 2;
        const diff = angleDiff(perpAngle, ship.ry);
        ship.ry += diff * 0.02;
        ship.vel += (maxSpd * 0.7 - ship.vel) * 0.01;
        // Fire
        fireAIBroadside(ship, side, room);
    } else if (ship.aiState === 'DISENGAGE') {
        const awayAngle = toTargetAngle + Math.PI;
        const diff = angleDiff(awayAngle, ship.ry);
        ship.ry += diff * 0.03;
        ship.vel += (maxSpd - ship.vel) * 0.01;
    } else {
        const diff = angleDiff(toTargetAngle, ship.ry);
        ship.ry += diff * 0.02;
        ship.vel += (maxSpd * 0.8 - ship.vel) * 0.008;
    }
}

function fireAIBroadside(ship, side, room) {
    const spec = C.SHIP_TYPES[ship.shipType];
    const total = spec.cannonCount;
    const half = Math.floor(total / 2);
    const start = side === 'port' ? 1 : half + 1;
    const end   = side === 'port' ? half : total - 1;
    for (let i = start; i <= Math.min(end, total - 1); i++) {
        if (ship.canFireCannon(i)) {
            room.fireCannonFromShip(ship, i);
        }
    }
}

module.exports = { updateAI, newBotName, newBotTitle };
```

---

## Task 5: Game Mode Rules

**Files:**
- Create: `trafalgar-io/game/GameMode.js`

- [ ] **Step 1: Create `game/GameMode.js`**

```js
'use strict';
const C = require('./constants');

class GameMode {
    constructor(modeName) {
        this.mode = modeName;
        this.flags = null;   // CTF only
        this.capitalShipId = null; // Capital Ship mode only
    }

    initCTF() {
        this.flags = {
            red:  { x:  600, z: 0, carrier: null, atBase: true },
            blue: { x: -600, z: 0, carrier: null, atBase: true },
        };
    }

    // Called each tick
    update(ships, events) {
        if (this.mode === 'ctf') this._tickCTF(ships, events);
    }

    _tickCTF(ships, events) {
        for (const flag of Object.values(this.flags)) {
            if (flag.carrier) {
                const carrier = ships.find(s => s.id === flag.carrier);
                if (!carrier || carrier.isSinking || carrier.isDead) {
                    // Drop flag where carrier was
                    if (carrier) { flag.x = carrier.x; flag.z = carrier.z; }
                    flag.carrier = null;
                    flag.atBase = false;
                    events.push({ type: 'flagDropped' });
                } else {
                    flag.x = carrier.x;
                    flag.z = carrier.z;
                }
            }
        }

        for (const ship of ships) {
            if (ship.isSinking || ship.isDead) continue;
            const enemyTeam = ship.team === 'red' ? 'blue' : 'red';
            const enemyFlag = this.flags[enemyTeam];
            const ownFlag   = this.flags[ship.team];
            const ownBase   = ship.team === 'red' ? { x: 600, z: 0 } : { x: -600, z: 0 };

            // Pick up enemy flag
            if (!enemyFlag.carrier && !ship.hasFlag) {
                const dx = ship.x - enemyFlag.x, dz = ship.z - enemyFlag.z;
                if (Math.sqrt(dx*dx+dz*dz) < C.CTF_FLAG_CAPTURE_R) {
                    enemyFlag.carrier = ship.id;
                    ship.hasFlag = true;
                    events.push({ type: 'flagPickup', player: ship.displayName, team: ship.team });
                }
            }

            // Capture: reach own base with enemy flag while own flag is home
            if (ship.hasFlag && ownFlag.atBase) {
                const dx = ship.x - ownBase.x, dz = ship.z - ownBase.z;
                if (Math.sqrt(dx*dx+dz*dz) < C.CTF_BASE_R) {
                    ship.score++;
                    ship.hasFlag = false;
                    // Reset enemy flag
                    const fl = this.flags[enemyTeam];
                    fl.carrier = null;
                    fl.atBase  = true;
                    fl.x = enemyTeam === 'red' ? 600 : -600;
                    fl.z = 0;
                    events.push({ type: 'capture', player: ship.displayName, team: ship.team });
                }
            }

            // Return own flag if stepped on
            if (!ownFlag.atBase && !ownFlag.carrier) {
                const dx = ship.x - ownFlag.x, dz = ship.z - ownFlag.z;
                if (Math.sqrt(dx*dx+dz*dz) < C.CTF_FLAG_CAPTURE_R && ship.team === ownFlag.team) {
                    ownFlag.atBase = true;
                    ownFlag.x = ship.team === 'red' ? 600 : -600;
                    ownFlag.z = 0;
                    events.push({ type: 'flagReturn', team: ship.team });
                }
            }
        }
    }

    checkWin(ships, timeLeft) {
        if (timeLeft <= 0) return true;
        if (this.mode === 'capital') {
            const cap = ships.find(s => s.isCapital);
            if (cap && cap.isDead) return true;
        }
        return false;
    }

    getWinner(ships) {
        if (this.mode === 'dm') {
            // Most kills
            let best = null;
            for (const s of ships) {
                if (!best || s.killCount > best.killCount) best = s;
            }
            return best ? best.displayName : 'No winner';
        }
        if (this.mode === 'ctf') {
            const redScore  = ships.filter(s=>s.team==='red').reduce((a,s)=>a+s.score,0);
            const blueScore = ships.filter(s=>s.team==='blue').reduce((a,s)=>a+s.score,0);
            if (redScore > blueScore) return 'Red Fleet';
            if (blueScore > redScore) return 'Blue Fleet';
            return 'Draw';
        }
        if (this.mode === 'capital') {
            const cap = ships.find(s=>s.isCapital);
            if (!cap || cap.isDead) return 'Attacking fleet wins!';
            return 'Capital Ship survived!';
        }
        return 'Draw';
    }

    serializeFlags() {
        if (!this.flags) return null;
        return {
            red:  { x: this.flags.red.x,  z: this.flags.red.z,  carrier: this.flags.red.carrier,  atBase: this.flags.red.atBase  },
            blue: { x: this.flags.blue.x, z: this.flags.blue.z, carrier: this.flags.blue.carrier, atBase: this.flags.blue.atBase },
        };
    }
}

module.exports = GameMode;
```

---

## Task 6: Room (Match Container + Game Loop)

**Files:**
- Create: `trafalgar-io/game/Room.js`

- [ ] **Step 1: Create `game/Room.js`**

```js
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

        this.ships      = [];
        this.cannonballs = [];
        this.events     = [];    // cleared each tick after broadcast
        this.chatLog    = [];

        this.gameMode   = new GameMode(mode);
        if (mode === 'ctf')     this.gameMode.initCTF();

        this._spawnIdx  = 0;
        this._interval  = null;
        this._lastTick  = Date.now();
    }

    // ── Player management ──────────────────────────────────────────

    addPlayer(socketId, { name, title, clanTag, shipType, sailColour, hullColour }) {
        const team = this._balanceTeam();
        const sp   = this._nextSpawn();
        const ship = new Ship({ socketId, name, title, clanTag,
                                shipType, sailColour, hullColour,
                                team, ...sp });
        this.ships.push(ship);
        this._ensureBots();
        if (!this.started) this.start();
        return ship;
    }

    removePlayer(socketId) {
        const idx = this.ships.findIndex(s => s.socketId === socketId);
        if (idx !== -1) {
            this.ships.splice(idx, 1);
            this._ensureBots();
        }
    }

    applyInput(socketId, input) {
        const ship = this.ships.find(s => s.socketId === socketId);
        if (ship) ship.applyInput(input);
    }

    fireCannon(socketId, cannonIdx) {
        const ship = this.ships.find(s => s.socketId === socketId);
        if (ship) this.fireCannonFromShip(ship, cannonIdx);
    }

    fireCannonFromShip(ship, idx) {
        if (!ship.canFireCannon(idx)) return;
        ship.reloadTimes[idx] = Date.now();
        const dir = ship.fireCannonDir(idx);
        const spread = ship.isBot ? (0.06 - ship.aiSkill * 0.04) : 0.02;
        const sx = dir.x + (Math.random()-0.5)*spread;
        const sz = dir.z + (Math.random()-0.5)*spread;
        const mag = Math.sqrt(sx*sx+sz*sz);
        const ball = new Cannonball({
            ownerId:   ship.id,
            ownerTeam: ship.team,
            startX: ship.x, startY: 3, startZ: ship.z,
            dirX: sx/mag, dirZ: sz/mag,
        });
        this.cannonballs.push(ball);
        this.events.push({ type: 'fire', shipId: ship.id, cannonIdx: idx });
    }

    addChat(socketId, text) {
        const ship = this.ships.find(s => s.socketId === socketId);
        const name = ship ? ship.displayName : 'Unknown';
        const msg = { name, text: text.slice(0, 200), ts: Date.now() };
        this.chatLog.push(msg);
        if (this.chatLog.length > 50) this.chatLog.shift();
        this.io.to(this.id).emit('chat', msg);
    }

    // ── Game loop ──────────────────────────────────────────────────

    start() {
        this.started = true;
        // Add capital ship for that mode
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

        // AI
        for (const ship of this.ships) {
            if (ship.isBot) AIBot.updateAI(ship, this.ships, this, dt);
        }

        // Ship physics
        for (const ship of this.ships) ship.tick(dt);

        // Cannonball physics + hit detection
        for (let i = this.cannonballs.length - 1; i >= 0; i--) {
            const b = this.cannonballs[i];
            b.tick(dt);
            if (b.dead) { this.cannonballs.splice(i, 1); continue; }

            for (const ship of this.ships) {
                if (ship.id === b.ownerId || ship.isDead) continue;
                const dx = b.x - ship.x, dz = b.z - ship.z;
                if (Math.sqrt(dx*dx + dz*dz) < C.HIT_RADIUS) {
                    const dmg = 0.12 + Math.random() * 0.08;
                    const sank = ship.takeDamage(dmg, b.ownerId);
                    this.events.push({ type: 'hit', shipId: ship.id, dmg });
                    if (sank) {
                        const attacker = this.ships.find(s => s.id === b.ownerId);
                        if (attacker) {
                            attacker.killCount++;
                            attacker.score++;
                        }
                        this.events.push({ type: 'sank', shipId: ship.id, by: b.ownerId });
                    }
                    b.dead = true;
                    break;
                }
            }
        }

        // Game mode logic (CTF flag tick etc.)
        this.gameMode.update(this.ships, this.events);

        // Remove fully dead ships and respawn bots after 8 s
        this._handleDeaths();

        // Win check
        if (this.gameMode.checkWin(this.ships, this.timeLeft)) {
            this.over = true;
            this.winner = this.gameMode.getWinner(this.ships);
            this.io.to(this.id).emit('gameOver', { winner: this.winner });
            this.stop();
        }

        // Broadcast
        this.io.to(this.id).emit('state', this._serialize());
        this.events = [];
    }

    _serialize() {
        return {
            timeLeft:     Math.max(0, this.timeLeft),
            ships:        this.ships.map(s => s.serialize()),
            cannonballs:  this.cannonballs.map(b => b.serialize()),
            events:       this.events,
            flags:        this.gameMode.serializeFlags(),
            mode:         this.mode,
        };
    }

    // ── Helpers ────────────────────────────────────────────────────

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
        const humanCount = this.ships.filter(s => !s.isBot).length;
        const botCount   = this.ships.filter(s => s.isBot && !s.isCapital).length;
        const total      = humanCount + botCount;
        const need       = Math.max(0, C.MIN_COMBATANTS - total);
        for (let i = 0; i < need; i++) {
            const team = this._balanceTeam();
            const sp   = this._nextSpawn();
            const shipTypes = ['sloop','frigate','frigate','sotl'];
            const bot = new Ship({
                name:        AIBot.newBotName(),
                title:       AIBot.newBotTitle(),
                shipType:    shipTypes[Math.floor(Math.random()*shipTypes.length)],
                sailColour:  C.SAIL_COLOURS[Math.floor(Math.random()*C.SAIL_COLOURS.length)][1],
                hullColour:  C.HULL_COLOURS[Math.floor(Math.random()*C.HULL_COLOURS.length)][1],
                team, isBot: true, ...sp,
            });
            bot.aiAggression = 0.4 + Math.random() * 0.6;
            bot.aiSkill      = 0.5 + Math.random() * 0.5;
            this.ships.push(bot);
        }
    }

    _spawnCapital() {
        const team = 'red';
        const cap = new Ship({
            name: 'HMS Sovereign',
            title: 'Admiral',
            shipType: 'capital',
            sailColour: '#f5f0e0',
            hullColour: '#5D4037',
            team, isBot: true, isCapital: true,
            x: 0, z: 0, ry: 0,
        });
        cap.aiAggression = 0.3;
        cap.aiSkill = 0.5;
        this.ships.push(cap);
        this.gameMode.capitalShipId = cap.id;
    }

    _handleDeaths() {
        for (let i = this.ships.length - 1; i >= 0; i--) {
            const s = this.ships[i];
            if (s.isDead && s.isBot && !s.isCapital) {
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
```

---

## Task 7: Express + Socket.io Server

**Files:**
- Create: `trafalgar-io/server.js`

- [ ] **Step 1: Create `server.js`**

```js
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

// ── Room registry ──────────────────────────────────────────────────

const rooms = new Map();   // roomId -> Room

function getOrCreateRoom(mode, duration) {
    // Find an open room matching mode+duration with < MAX_PLAYERS humans
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

// Clean up finished rooms every minute
setInterval(() => {
    for (const [id, room] of rooms.entries()) {
        if (room.over) rooms.delete(id);
    }
}, 60_000);

// ── Socket.io ──────────────────────────────────────────────────────

io.on('connection', (socket) => {
    let currentRoom = null;
    let currentShip = null;

    socket.on('join', ({ name, title, clanTag, shipType,
                         sailColour, hullColour, mode, duration }) => {
        if (currentRoom) {
            currentRoom.removePlayer(socket.id);
            socket.leave(currentRoom.id);
        }

        const dur  = C.DURATIONS[duration] || 300;
        const room = getOrCreateRoom(mode || 'dm', dur);
        currentRoom = room;

        socket.join(room.id);
        currentShip = room.addPlayer(socket.id, {
            name: (name || 'Anonymous').slice(0, 24),
            title: title || 'Captain',
            clanTag: (clanTag || '').slice(0, 4).toUpperCase(),
            shipType: shipType || 'frigate',
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

        // Send recent chat
        socket.emit('chatHistory', room.chatLog.slice(-20));
    });

    socket.on('input', (input) => {
        if (currentRoom) currentRoom.applyInput(socket.id, input);
    });

    socket.on('fire', ({ cannonIdx }) => {
        if (currentRoom) currentRoom.fireCannon(socket.id, cannonIdx);
    });

    socket.on('broadside', ({ side }) => {
        if (!currentRoom || !currentShip) return;
        const spec  = C.SHIP_TYPES[currentShip.shipType];
        const total = spec.cannonCount;
        const half  = Math.floor(total / 2);
        const start = side === 'port' ? 1 : half + 1;
        const end   = side === 'port' ? half : total - 1;
        for (let i = start; i <= end; i++) {
            setTimeout(() => currentRoom?.fireCannon(socket.id, i), (i - start) * 120);
        }
    });

    socket.on('chat', ({ text }) => {
        if (currentRoom && text) currentRoom.addChat(socket.id, text);
    });

    socket.on('disconnect', () => {
        if (currentRoom) {
            currentRoom.removePlayer(socket.id);
            if (currentRoom.playerCount === 0 && !currentRoom.started) {
                currentRoom.stop();
                rooms.delete(currentRoom.id);
            }
        }
    });
});

// ── REST: room list for lobby ──────────────────────────────────────
app.get('/api/rooms', (_req, res) => {
    const list = [];
    for (const room of rooms.values()) {
        if (!room.over) {
            list.push({
                id:       room.id,
                mode:     room.mode,
                duration: room.duration,
                players:  room.playerCount,
                max:      C.MAX_PLAYERS,
                timeLeft: room.timeLeft,
            });
        }
    }
    res.json(list);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`trafalgar.io server running on :${PORT}`));
```

- [ ] **Step 2: Test server starts**

```bash
cd trafalgar-io
node server.js
```

Expected output: `trafalgar.io server running on :3001`

---

## Task 8: Ship Models (3 Types + Colour Helpers)

**Files:**
- Create: `trafalgar-io/public/js/shipModels.js`

- [ ] **Step 1: Create `public/js/shipModels.js`**

This reuses the existing voxel data at different scales with recolour support.

```js
// Ship voxel model definitions for Three.js rendering.
// Uses the voxel data from the solo game, recoloured per ship customisation.

window.ShipModels = (function() {
    // Base voxel data (same as solo game)
    const BASE_VOXELS = /* paste full voxelData.voxels array from trafalgar.html here */
        [/* VOXEL_DATA_PLACEHOLDER */];

    function buildMesh(scene, THREE, voxelGeo, shipData) {
        const group = new THREE.Group();
        const { sailColour, hullColour, shipType } = shipData;
        const spec = window.SHIP_CONSTANTS[shipType] || { scale: 0.6 };

        // Colour mapping: original hull colours -> custom hull colour
        const hullBase = ['#5D4037','#4E342E','#A1887F','#3E2723','#FFD700'];
        const sailBase = ['#F5F5F5','#FFFFFF'];
        const customHull = hullColour || '#5D4037';
        const customSail = sailColour  || '#F5F5F5';

        const matCache = {};
        function getMat(hex) {
            if (!matCache[hex]) {
                matCache[hex] = new THREE.MeshStandardMaterial({ color: hex });
            }
            return matCache[hex];
        }

        function recolour(origHex) {
            if (sailBase.includes(origHex.toUpperCase()) ||
                origHex.toLowerCase() === '#f5f5f5') {
                return customSail;
            }
            if (hullBase.some(h => h.toLowerCase() === origHex.toLowerCase())) {
                // Tint original towards custom hull colour
                return customHull;
            }
            return origHex;
        }

        const voxels = BASE_VOXELS.length ? BASE_VOXELS : [];
        let minX=Infinity, minY=Infinity, minZ=Infinity;
        let maxX=-Infinity, maxY=-Infinity, maxZ=-Infinity;
        voxels.forEach(v => {
            minX=Math.min(minX,v.x); minY=Math.min(minY,v.y); minZ=Math.min(minZ,v.z);
            maxX=Math.max(maxX,v.x); maxY=Math.max(maxY,v.y); maxZ=Math.max(maxZ,v.z);
        });
        const offX = (minX+maxX)/2, offZ = (minZ+maxZ)/2;

        voxels.forEach(v => {
            const mesh = new THREE.Mesh(voxelGeo, getMat(recolour(v.c)));
            mesh.position.set(v.x - offX, v.y - (minY+1.2), v.z - offZ);
            group.add(mesh);
        });

        // Flag
        const flagPole = new THREE.Mesh(
            new THREE.BoxGeometry(0.2,12,0.2),
            new THREE.MeshStandardMaterial({color:'#333333'})
        );
        flagPole.position.set(-2,10,0);
        group.add(flagPole);
        const flagColour = shipData.team === 'red' ? 0xff2222 : 0x0077ff;
        const flagCloth = new THREE.Mesh(
            new THREE.PlaneGeometry(6,4),
            new THREE.MeshStandardMaterial({color:flagColour, side:THREE.DoubleSide})
        );
        flagCloth.position.set(-5,13,0);
        group.add(flagCloth);

        group.scale.setScalar(spec.scale);
        scene.add(group);
        return group;
    }

    return { buildMesh, BASE_VOXELS };
})();
```

> **Implementation note for the subagent executing this task:**
> Open `C:\Users\LCADMIN\Downloads\Trafalgar\trafalgar.html`, extract the full `voxelData.voxels` array (the large JSON array at the top of the script, line ~53), and paste it in place of `/* VOXEL_DATA_PLACEHOLDER */` above.

---

## Task 9: Lobby UI

**Files:**
- Create: `trafalgar-io/public/index.html`

- [ ] **Step 1: Create `public/index.html`** (the full lobby + customisation screen)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Trafalgar.io</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
<div id="lobby">

  <!-- Header -->
  <div class="lobby-title">
    <div class="title-voxel">TRAFALGAR.IO</div>
    <div class="title-sub">Naval Combat · Age of Sail</div>
  </div>

  <!-- Captain & Clan -->
  <div class="lobby-row">
    <div class="lobby-card">
      <div class="card-title">CAPTAIN</div>
      <label>Name</label>
      <input id="captainName" type="text" maxlength="24" placeholder="Your name" value="">
      <label>Title</label>
      <select id="captainTitle">
        <option>Captain</option><option>Admiral</option><option>Commodore</option>
        <option>Commander</option><option>Rear-Admiral</option><option>Vice-Admiral</option>
        <option>Ensign</option><option>Boatswain</option>
      </select>
      <label>Clan Tag <span style="color:#555;font-size:0.8em;">(4 letters)</span></label>
      <div style="display:flex;gap:8px;align-items:center;">
        <input id="clanTagInput" type="text" maxlength="4" placeholder="TAG" style="width:80px;text-transform:uppercase;">
        <button class="btn-small" onclick="Clans.apply()">Apply</button>
        <button class="btn-small" onclick="Clans.leave()" style="color:#ff5555;">Leave</button>
      </div>
      <div id="clanStatus" style="color:#555;font-size:0.75em;margin-top:4px;"></div>
    </div>

    <!-- Ship selection -->
    <div class="lobby-card">
      <div class="card-title">YOUR SHIP</div>
      <div id="shipTypeGrid" class="ship-grid">
        <div class="ship-option selected" data-type="frigate">
          <div class="ship-opt-name">Frigate</div>
          <div class="ship-opt-desc">Balanced broadside warship</div>
          <div class="ship-opt-stats">HP ████░  SPD ███░░  GUNS ████░</div>
        </div>
        <div class="ship-option" data-type="sloop">
          <div class="ship-opt-name">Sloop</div>
          <div class="ship-opt-desc">Fast raider · best for CTF</div>
          <div class="ship-opt-stats">HP ██░░░  SPD █████  GUNS ██░░░</div>
        </div>
        <div class="ship-option" data-type="sotl">
          <div class="ship-opt-name">Ship of the Line</div>
          <div class="ship-opt-desc">Slow, devastating broadsides</div>
          <div class="ship-opt-stats">HP █████  SPD █░░░░  GUNS █████</div>
        </div>
      </div>

      <!-- Colour customisation -->
      <div class="colour-row">
        <div>
          <label>Sails</label>
          <div id="sailColours" class="colour-swatches"></div>
        </div>
        <div>
          <label>Hull</label>
          <div id="hullColours" class="colour-swatches"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Match settings -->
  <div class="lobby-card full-width">
    <div class="card-title">MATCH</div>
    <div class="match-row">
      <div>
        <label>Game Mode</label>
        <div id="modeGrid" class="mode-grid">
          <div class="mode-option selected" data-mode="dm">
            <div class="mode-name">⚔ Deathmatch</div>
            <div class="mode-desc">Most kills wins</div>
          </div>
          <div class="mode-option" data-mode="ctf">
            <div class="mode-name">🚩 Capture the Flag</div>
            <div class="mode-desc">Steal the enemy flag, return to base</div>
          </div>
          <div class="mode-option" data-mode="capital">
            <div class="mode-name">💀 Sink the Capital Ship</div>
            <div class="mode-desc">Destroy the enemy flagship</div>
          </div>
        </div>
      </div>
      <div>
        <label>Duration</label>
        <div id="durationGrid" class="duration-grid">
          <div class="dur-option" data-dur="3m">3 min</div>
          <div class="dur-option selected" data-dur="5m">5 min</div>
          <div class="dur-option" data-dur="10m">10 min</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Room list -->
  <div class="lobby-card full-width">
    <div class="card-title">OPEN MATCHES <button class="btn-small" onclick="refreshRooms()">↻ Refresh</button></div>
    <div id="roomList" class="room-list">
      <div style="color:#445;font-size:0.8em;">Loading...</div>
    </div>
  </div>

  <!-- Battle button -->
  <button id="battleBtn" class="battle-btn" onclick="joinGame()">⚓ SET SAIL</button>
  <div id="lobbyError" style="color:#ff5555;text-align:center;font-size:0.8em;margin-top:8px;"></div>
</div>

<script src="js/config.js"></script>
<script src="js/clans.js"></script>
<script src="js/lobby.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `public/js/lobby.js`**

```js
(function() {
    // Restore saved preferences
    const saved = JSON.parse(localStorage.getItem('tio_prefs') || '{}');
    document.getElementById('captainName').value  = saved.name  || '';
    document.getElementById('captainTitle').value = saved.title || 'Captain';

    let selectedShip     = saved.shipType    || 'frigate';
    let selectedSail     = saved.sailColour  || '#f5f0e0';
    let selectedHull     = saved.hullColour  || '#5D4037';
    let selectedMode     = saved.mode        || 'dm';
    let selectedDuration = saved.duration    || '5m';

    // Ship type selection
    document.querySelectorAll('.ship-option').forEach(el => {
        if (el.dataset.type === selectedShip) el.classList.add('selected');
        el.addEventListener('click', () => {
            document.querySelectorAll('.ship-option').forEach(e => e.classList.remove('selected'));
            el.classList.add('selected');
            selectedShip = el.dataset.type;
        });
    });

    // Sail colours
    const SAIL_COLOURS = [['Ivory','#f5f0e0'],['Crimson','#cc2222'],['Ocean','#2255aa'],
        ['Midnight','#1a1a3a'],['Gold','#d4a017'],['Forest','#2a5e2a'],
        ['Obsidian','#222222'],['Blood','#8b0000']];
    const sailEl = document.getElementById('sailColours');
    SAIL_COLOURS.forEach(([name, hex]) => {
        const sw = document.createElement('div');
        sw.className = 'swatch' + (hex === selectedSail ? ' selected' : '');
        sw.style.background = hex;
        sw.title = name;
        sw.addEventListener('click', () => {
            document.querySelectorAll('#sailColours .swatch').forEach(s=>s.classList.remove('selected'));
            sw.classList.add('selected'); selectedSail = hex;
        });
        sailEl.appendChild(sw);
    });

    // Hull colours
    const HULL_COLOURS = [['Oak','#5D4037'],['Ebony','#2c1a0e'],['Coral','#a05020'],['Slate','#445566']];
    const hullEl = document.getElementById('hullColours');
    HULL_COLOURS.forEach(([name, hex]) => {
        const sw = document.createElement('div');
        sw.className = 'swatch' + (hex === selectedHull ? ' selected' : '');
        sw.style.background = hex;
        sw.title = name;
        sw.addEventListener('click', () => {
            document.querySelectorAll('#hullColours .swatch').forEach(s=>s.classList.remove('selected'));
            sw.classList.add('selected'); selectedHull = hex;
        });
        hullEl.appendChild(sw);
    });

    // Mode selection
    document.querySelectorAll('.mode-option').forEach(el => {
        if (el.dataset.mode === selectedMode) el.classList.add('selected');
        el.addEventListener('click', () => {
            document.querySelectorAll('.mode-option').forEach(e => e.classList.remove('selected'));
            el.classList.add('selected'); selectedMode = el.dataset.mode;
        });
    });

    // Duration selection
    document.querySelectorAll('.dur-option').forEach(el => {
        if (el.dataset.dur === selectedDuration) el.classList.add('selected');
        el.addEventListener('click', () => {
            document.querySelectorAll('.dur-option').forEach(e => e.classList.remove('selected'));
            el.classList.add('selected'); selectedDuration = el.dataset.dur;
        });
    });

    // Room list
    window.refreshRooms = function() {
        fetch(window.TRAFALGAR_SERVER + '/api/rooms')
            .then(r => r.json())
            .then(rooms => {
                const el = document.getElementById('roomList');
                if (!rooms.length) { el.innerHTML = '<div style="color:#445">No open matches — you\'ll start a new one</div>'; return; }
                el.innerHTML = rooms.map(r =>
                    `<div class="room-row">
                      <span style="color:#ffd700">${r.mode.toUpperCase()}</span>
                      <span>${r.players}/${r.max} players</span>
                      <span>${Math.floor(r.timeLeft/60)}m left</span>
                      <button class="btn-small" onclick="joinSpecific('${r.id}')">JOIN</button>
                    </div>`
                ).join('');
            }).catch(() => {
                document.getElementById('roomList').innerHTML =
                    '<div style="color:#554">Could not reach server — check config.js</div>';
            });
    };
    refreshRooms();
    setInterval(refreshRooms, 10000);

    window.joinGame = function(specificRoomId) {
        const name = document.getElementById('captainName').value.trim();
        if (!name) { document.getElementById('lobbyError').textContent = 'Enter your captain name first.'; return; }
        const prefs = {
            name, title: document.getElementById('captainTitle').value,
            shipType: selectedShip, sailColour: selectedSail, hullColour: selectedHull,
            mode: selectedMode, duration: selectedDuration,
            clanTag: Clans.getTag(),
        };
        localStorage.setItem('tio_prefs', JSON.stringify(prefs));
        const params = new URLSearchParams(prefs);
        if (specificRoomId) params.set('roomId', specificRoomId);
        window.location.href = 'game.html?' + params.toString();
    };

    window.joinSpecific = function(roomId) { window.joinGame(roomId); };
})();
```

---

## Task 10: In-Game HTML Shell

**Files:**
- Create: `trafalgar-io/public/game.html`

- [ ] **Step 1: Create `public/game.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Trafalgar.io — Battle</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
  <style>
    body { margin:0; overflow:hidden; background:#000; }
    canvas { display:block; }
  </style>
</head>
<body>
<div id="damage-vignette"></div>
<div id="hit-flash"></div>

<!-- ── HUD ── -->
<div id="hud-ship" class="hud-panel" style="top:10px;left:10px;min-width:300px;">
  <div id="ship-name-display" style="color:#ffd700;font-size:1em;font-weight:bold;margin-bottom:4px;"></div>
  <div id="hud-hp-bar-wrap" style="background:#1a2a1a;border:1px solid #2a3a2a;height:12px;margin-bottom:4px;">
    <div id="hud-hp-bar" style="height:100%;width:100%;transition:width 0.3s,background-color 0.5s;"></div>
  </div>
  <div id="ship-status" style="font-size:0.78em;line-height:1.5;"></div>
</div>

<div id="hud-battle" class="hud-panel" style="top:10px;right:10px;min-width:280px;text-align:right;">
  <div id="hud-mode-label" style="color:#ffd700;font-size:0.8em;letter-spacing:0.1em;margin-bottom:4px;"></div>
  <div id="hud-timer" style="color:#fff;font-size:1.2em;margin-bottom:4px;"></div>
  <div id="ai-status" style="font-size:0.78em;"></div>
</div>

<div id="hud-cannons" class="hud-panel" style="bottom:100px;left:10px;">
  <div style="color:#888;font-size:0.72em;letter-spacing:0.1em;margin-bottom:6px;">CANNONS</div>
  <div id="hud-cannon-circles" style="display:flex;gap:8px;margin-bottom:6px;"></div>
  <div style="color:#444;font-size:0.68em;">R: PORT · T: STBD · TAB: AIM</div>
</div>

<div id="hud-nav" class="hud-panel" style="bottom:100px;right:10px;min-width:240px;">
  <div id="hud-heading" style="font-size:0.82em;margin-bottom:2px;"></div>
  <div id="hud-wind"    style="font-size:0.82em;margin-bottom:6px;"></div>
  <div id="hud-target"  style="font-size:0.78em;border-top:1px solid #1a2a3a;padding-top:6px;"></div>
</div>

<div id="battle-log" class="hud-panel" style="bottom:100px;left:50%;transform:translateX(-50%);max-width:380px;font-size:0.8em;color:#aaa;max-height:80px;overflow:hidden;text-align:center;"></div>

<!-- Scoreboard (Tab to toggle) -->
<div id="scoreboard" class="hud-panel" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);min-width:420px;z-index:20;pointer-events:none;">
  <div style="color:#ffd700;font-size:0.85em;letter-spacing:0.15em;margin-bottom:8px;text-align:center;">SCOREBOARD</div>
  <div id="scoreboard-body" style="font-size:0.78em;"></div>
</div>

<!-- CTF flags HUD -->
<div id="ctf-hud" style="display:none;position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:12;font-family:'Courier New',monospace;text-align:center;color:#fff;pointer-events:none;">
  <span id="ctf-red"  style="color:#ff5555;margin-right:16px;"></span>
  <span id="ctf-blue" style="color:#5599ff;"></span>
</div>

<!-- ── Chat ── -->
<div id="chat-area" style="position:fixed;bottom:10px;left:50%;transform:translateX(-50%);width:380px;z-index:15;">
  <div id="chat-messages" class="hud-panel" style="height:72px;overflow:hidden;font-size:0.78em;color:#aaa;margin-bottom:4px;pointer-events:none;"></div>
  <div id="chat-input-row" style="display:none;align-items:center;gap:6px;">
    <input id="chat-input" type="text" maxlength="200" placeholder="Say something..."
      style="flex:1;font-family:'Courier New',monospace;background:rgba(0,8,20,0.9);
             border:1px solid rgba(255,200,50,0.4);color:#fff;padding:6px 10px;font-size:0.82em;outline:none;">
    <button onclick="Chat.send()" style="font-family:'Courier New',monospace;color:#ffd700;background:transparent;border:1px solid rgba(255,200,50,0.4);padding:6px 10px;cursor:pointer;">SEND</button>
  </div>
</div>

<!-- Return to lobby -->
<button onclick="window.location.href='index.html'"
  style="position:fixed;bottom:10px;right:10px;z-index:15;font-family:'Courier New',monospace;
         color:#445;background:transparent;border:1px solid #223;padding:6px 12px;
         font-size:0.72em;cursor:pointer;">⚓ LOBBY</button>

<!-- Music toggle -->
<button id="music-toggle" onclick="window.toggleMusic()"
  style="position:fixed;bottom:10px;right:90px;z-index:15;font-family:'Courier New',monospace;
         color:#445;background:transparent;border:1px solid #223;padding:6px 10px;font-size:0.72em;cursor:pointer;">♪ ON</button>

<audio id="bgMusic" preload="none"></audio>

<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"}}</script>
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
<script src="js/config.js"></script>
<script src="js/shipModels.js"></script>
<script type="module" src="js/game.js"></script>
</body>
</html>
```

---

## Task 11: Game Client (Three.js + Multiplayer Sync)

**Files:**
- Create: `trafalgar-io/public/js/game.js`
- Create: `trafalgar-io/public/js/hud.js`

- [ ] **Step 1: Create `public/js/game.js`**

This is the main game client. It connects via Socket.io and renders the server's state.

```js
import * as THREE from 'three';

// ── Scene setup ────────────────────────────────────────────────────
const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 15000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(500,1000,500); scene.add(sun);
scene.fog = new THREE.FogExp2(0x8899aa, 0.00008);

// Ocean plane
const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000, 64, 64),
    new THREE.MeshStandardMaterial({ color: 0x1a4060, roughness: 0.8 })
);
ocean.rotation.x = -Math.PI / 2;
scene.add(ocean);

// CTF flag markers
const flagGeo  = new THREE.BoxGeometry(1.5,12,1.5);
const flagMats = {
    red:  new THREE.MeshBasicMaterial({color:0xff2222}),
    blue: new THREE.MeshBasicMaterial({color:0x2244ff}),
};

// ── State ──────────────────────────────────────────────────────────
const params    = new URLSearchParams(location.search);
const shipMeshes  = new Map();   // id -> THREE.Group
const ballMeshes  = new Map();   // id -> THREE.Mesh
const flagMeshes  = {};
const voxelGeo    = new THREE.BoxGeometry(1,1,1);
let   myShipId    = null;
let   gameState   = null;
let   orbitY      = Math.PI;
let   camDist     = 200;
const keys        = {};
let   lastInputSent = 0;
let   screenShake = 0;
let   lastFireLight = Date.now();

// Fire lights pool
const fireLights = [];
for (let i=0;i<6;i++){const fl=new THREE.PointLight(0xffaa44,0,120);scene.add(fl);fireLights.push(fl);}
let nextFl = 0;

// ── Socket.io ──────────────────────────────────────────────────────
const socket = io(window.TRAFALGAR_SERVER, { transports: ['websocket'] });

socket.on('connect', () => {
    socket.emit('join', {
        name:        params.get('name')        || 'Captain',
        title:       params.get('title')       || 'Captain',
        clanTag:     params.get('clanTag')     || '',
        shipType:    params.get('shipType')    || 'frigate',
        sailColour:  params.get('sailColour')  || '#f5f0e0',
        hullColour:  params.get('hullColour')  || '#5D4037',
        mode:        params.get('mode')        || 'dm',
        duration:    params.get('duration')    || '5m',
    });
});

socket.on('joined', ({ shipId }) => {
    myShipId = shipId;
    initCannons();
    initRangeArcs();
    initAimDivs();
    initMusic();
});

socket.on('state', (state) => {
    gameState = state;
    applyState(state);
});

socket.on('gameOver', ({ winner }) => {
    // Show big overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:50;background:rgba(5,12,25,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:"Courier New",monospace;text-align:center;';
    overlay.innerHTML = `<div style="color:#ffd700;font-size:2em;margin-bottom:12px;">BATTLE OVER</div>
      <div style="color:#8899aa;margin-bottom:32px;">${winner}</div>
      <button onclick="window.location.href='index.html'" style="font-family:'Courier New',monospace;color:#ffd700;background:transparent;border:1px solid rgba(255,200,50,0.5);padding:12px 32px;font-size:1em;cursor:pointer;">RETURN TO PORT</button>`;
    document.body.appendChild(overlay);
});

socket.on('chatHistory', (msgs) => { msgs.forEach(m => Chat.receive(m)); });

// ── Apply server state to Three.js scene ──────────────────────────
function applyState(state) {
    const activeIds = new Set();

    for (const sd of state.ships) {
        activeIds.add(sd.id);
        let group = shipMeshes.get(sd.id);
        if (!group) {
            group = ShipModels.buildMesh(scene, THREE, voxelGeo, sd);
            shipMeshes.set(sd.id, group);
        }
        // Apply transform
        group.position.set(sd.x, sd.y, sd.z);
        group.rotation.y = sd.ry;
        group.visible = !sd.isDead;
        // Gentle rocking
        group.rotation.z = Math.sin(Date.now()*0.001 + sd.x*0.01) * 0.015;
    }

    // Remove stale ships
    for (const [id, mesh] of shipMeshes) {
        if (!activeIds.has(id)) { scene.remove(mesh); shipMeshes.delete(id); }
    }

    // Cannonballs
    const ballIds = new Set();
    for (const bd of state.cannonballs) {
        ballIds.add(bd.id);
        let ball = ballMeshes.get(bd.id);
        if (!ball) {
            ball = new THREE.Mesh(
                new THREE.SphereGeometry(0.3,6,6),
                new THREE.MeshStandardMaterial({color:0x111111,roughness:0.1})
            );
            scene.add(ball); ballMeshes.set(bd.id, ball);
        }
        ball.position.set(bd.x, bd.y, bd.z);
    }
    for (const [id, mesh] of ballMeshes) {
        if (!ballIds.has(id)) { scene.remove(mesh); ballMeshes.delete(id); }
    }

    // Events (hit = screen shake, fire = flash)
    for (const ev of (state.events || [])) {
        if (ev.type === 'hit' && ev.shipId === myShipId) {
            screenShake = 6;
            document.getElementById('hit-flash').style.opacity = '1';
            setTimeout(() => document.getElementById('hit-flash').style.opacity = '0', 80);
        }
        if (ev.type === 'fire') {
            const fl = fireLights[nextFl % fireLights.length];
            const sh = state.ships.find(s => s.id === ev.shipId);
            if (sh) { fl.position.set(sh.x, 4, sh.z); fl.intensity = 120; }
            nextFl++;
        }
        if (ev.type === 'sank') {
            const name = state.ships.find(s=>s.id===ev.shipId)?.name || 'A ship';
            addBattleLog(name + ' has been sunk!');
        }
        if (ev.type === 'capture') {
            addBattleLog(ev.player + ' captured the flag!');
        }
    }

    // Update HUD
    updateHUD(state, myShipId);
    updateCTFHud(state);

    // Fire lights decay
    fireLights.forEach(fl => { if (fl.intensity > 0) fl.intensity *= 0.85; });
}

// ── Input ──────────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'q') orbitY += 0.05;
    if (e.key.toLowerCase() === 'e') orbitY -= 0.05;
    if (e.key.toLowerCase() === 'z') camDist = Math.max(40, camDist - 15);
    if (e.key.toLowerCase() === 'x') camDist = Math.min(700, camDist + 15);

    if (e.key.toLowerCase() === 'r') socket.emit('broadside', { side: 'port' });
    if (e.key.toLowerCase() === 't') socket.emit('broadside', { side: 'starboard' });

    const n = parseInt(e.key);
    if (n >= 1 && n <= 7) {
        playerActiveCannon = n - 1;
        socket.emit('fire', { cannonIdx: n - 1 });
    }

    if (e.key === 'Tab') {
        e.preventDefault();
        showRangeDisplay = !showRangeDisplay;
        document.getElementById('scoreboard').style.display =
            showRangeDisplay ? 'block' : 'none';
    }

    // Chat
    if (e.key === 'Enter') Chat.focus();
    if (e.key === 'Escape') Chat.blur();
});
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// Send input at 20Hz (matches server tick)
setInterval(() => {
    if (!myShipId) return;
    socket.emit('input', {
        w: !!keys['w'], s: !!keys['s'],
        a: !!keys['a'], d: !!keys['d'],
    });
}, 50);

// ── Battle log ─────────────────────────────────────────────────────
const battleLog = [];
function addBattleLog(msg) {
    battleLog.unshift(msg);
    if (battleLog.length > 5) battleLog.pop();
    document.getElementById('battle-log').innerHTML = battleLog.map(l=>`<div>${l}</div>`).join('');
}

// ── Aim assist / range arcs (same as solo game) ────────────────────
// Simplified: use showRangeDisplay toggle from TAB
let showRangeDisplay = false;
let playerActiveCannon = 0;
let aimDivs = [];
const _portBuf = new Float32Array(90*3), _stbdBuf = new Float32Array(90*3), _bowBuf = new Float32Array(90*3);
const MAX_CANNON_RANGE = 250;
let rangeGroup = null;

function initRangeArcs() { /* same as solo — simplified, uses local ship position from state */ }
function initAimDivs() {
    aimDivs.forEach(d => d.div?.remove());
    aimDivs = [];
    const svg = '<svg width="52" height="52" viewBox="0 0 52 52" style="display:block"><circle cx="26" cy="26" r="20" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="26" y1="4" x2="26" y2="14" stroke="currentColor" stroke-width="1.5"/><line x1="26" y1="38" x2="26" y2="48" stroke="currentColor" stroke-width="1.5"/><line x1="4" y1="26" x2="14" y2="26" stroke="currentColor" stroke-width="1.5"/><line x1="38" y1="26" x2="48" y2="26" stroke="currentColor" stroke-width="1.5"/></svg>';
    for (let i=0;i<16;i++){
        const d=document.createElement('div');
        d.style.cssText='position:fixed;pointer-events:none;z-index:15;display:none;transform:translate(-50%,-50%);font-family:"Courier New",monospace;';
        d.innerHTML=svg+'<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:11px;font-weight:bold;"></div>';
        document.body.appendChild(d);
        aimDivs.push({div:d,lbl:d.querySelector('div')});
    }
}

function updateAimAssist(state) {
    if (!showRangeDisplay || !myShipId) { aimDivs.forEach(a=>a.div.style.display='none'); return; }
    const me = state.ships.find(s=>s.id===myShipId);
    if (!me || me.isSinking || me.isDead) { aimDivs.forEach(a=>a.div.style.display='none'); return; }

    const enemies = state.ships.filter(s=>s.team!==me.team&&!s.isSinking&&!s.isDead);
    const invRy = -me.ry;
    const cosR=Math.cos(invRy), sinR=Math.sin(invRy);
    let di=0;

    for (const en of enemies) {
        if (di>=aimDivs.length) break;
        const dx=en.x-me.x, dz=en.z-me.z;
        const dist=Math.sqrt(dx*dx+dz*dz);
        const lx=dx*cosR-dz*sinR, lz=dx*sinR+dz*cosR;
        const portW = dist<=MAX_CANNON_RANGE&&lz<-2&&Math.abs(lx)<20;
        const stbdW = dist<=MAX_CANNON_RANGE&&lz>2&&Math.abs(lx)<20;
        const bowA  = dist<=MAX_CANNON_RANGE&&lx>0&&Math.atan2(Math.abs(lz),lx)<Math.PI/8&&Math.abs(lz)<lx;

        const wp=en.x; const wz_v=en.z;
        const v3=new THREE.Vector3(wp,8,wz_v);
        v3.project(camera);
        if(v3.z>1){continue;}
        const sx=(v3.x*.5+.5)*innerWidth, sy=(-v3.y*.5+.5)*innerHeight;
        const a=aimDivs[di++];
        a.div.style.display='block';
        a.div.style.left=sx+'px'; a.div.style.top=sy+'px';
        if(portW||stbdW||bowA){
            a.div.style.color='#ffee00';
            a.lbl.textContent=portW?'R':stbdW?'T':'B';
        } else if(dist<=MAX_CANNON_RANGE){
            a.div.style.color=lz<0?'rgba(255,80,0,.4)':'rgba(0,200,255,.4)';
            a.lbl.textContent=lz<0?'R':'T';
        } else {
            a.div.style.color='rgba(160,0,0,.22)'; a.lbl.textContent='×';
        }
    }
    for(let j=di;j<aimDivs.length;j++) aimDivs[j].div.style.display='none';
}

// ── Scoreboard ─────────────────────────────────────────────────────
function updateScoreboard(state) {
    const el = document.getElementById('scoreboard-body');
    if (!el) return;
    const sorted = [...(state.ships||[])].sort((a,b)=>b.score-a.score);
    el.innerHTML = sorted.map(s =>
        `<div style="display:flex;justify-content:space-between;padding:2px 0;color:${s.team==='red'?'#ff7777':'#7799ff'}${s.id===myShipId?';font-weight:bold':''}">
           <span>${s.name}</span>
           <span>${s.score} pts · ${s.killCount} kills · ${Math.ceil(s.hp/s.maxHp*100)}% HP</span>
         </div>`
    ).join('');
}

// ── Cannon circles ─────────────────────────────────────────────────
function initCannons() {
    const c = document.getElementById('hud-cannon-circles');
    if (!c) return;
    c.innerHTML = '';
    for (let i=0;i<7;i++){
        const el=document.createElement('span');
        el.className='cannon-circle'; el.id='cannon-circle-'+i;
        c.appendChild(el);
    }
}

// ── CTF HUD ────────────────────────────────────────────────────────
function updateCTFHud(state) {
    const el = document.getElementById('ctf-hud');
    if (!el) return;
    if (state.mode !== 'ctf' || !state.flags) { el.style.display='none'; return; }
    el.style.display='block';
    const rf=state.flags.red,  bf=state.flags.blue;
    document.getElementById('ctf-red').textContent  = '🚩 Red: '  +(rf.atBase?'HOME':rf.carrier?'CARRIED':'DROPPED');
    document.getElementById('ctf-blue').textContent = '🚩 Blue: '+(bf.atBase?'HOME':bf.carrier?'CARRIED':'DROPPED');
}

// ── Music (same as solo) ────────────────────────────────────────────
const PLAYLIST=['music/InStormAndSunshine.mp3','music/FlorentinerMarch.mp3','music/Zacatecas.mp3','music/UnderTheDoubleEagle.mp3'];
let musicIdx=0, musicStarted=false, musicMuted=false;
function initMusic() {
    document.addEventListener('keydown',()=>{ if(!musicStarted){musicStarted=true;playTrack();} },{once:true});
    document.addEventListener('click',()=>{ if(!musicStarted){musicStarted=true;playTrack();} },{once:true});
}
function playTrack(){
    if(musicMuted)return;
    const a=document.getElementById('bgMusic');
    a.src=PLAYLIST[musicIdx]; a.volume=0;
    a.play().catch(()=>{});
    let v=0; const fi=setInterval(()=>{v=Math.min(v+0.005,0.12);a.volume=v;if(v>=0.12)clearInterval(fi);},100);
    a.onended=()=>{musicIdx=(musicIdx+1)%PLAYLIST.length;playTrack();};
}
window.toggleMusic=function(){
    musicMuted=!musicMuted;
    const a=document.getElementById('bgMusic'),b=document.getElementById('music-toggle');
    if(musicMuted){a.pause();if(b)b.textContent='♪ OFF';}
    else{if(!musicStarted){musicStarted=true;playTrack();}else a.play().catch(()=>{});if(b)b.textContent='♪ ON';}
};

// ── Render loop ────────────────────────────────────────────────────
window.addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    if (!gameState) { renderer.render(scene,camera); return; }

    const me = gameState.ships.find(s=>s.id===myShipId);

    // Camera
    if (me && !me.isDead) {
        const ang = me.ry + orbitY;
        let cx=me.x+Math.cos(ang)*camDist, cy=camDist*0.6, cz=me.z-Math.sin(ang)*camDist;
        if (screenShake>0.1){cx+=(Math.random()-.5)*screenShake;cy+=(Math.random()-.5)*screenShake*.5;cz+=(Math.random()-.5)*screenShake;screenShake*=0.85;}
        camera.position.set(cx,cy,cz);
        camera.lookAt(me.x, 0, me.z);
    }

    updateAimAssist(gameState);
    if (document.getElementById('scoreboard').style.display!=='none') updateScoreboard(gameState);

    renderer.render(scene,camera);
}
animate();
```

- [ ] **Step 2: Create `public/js/hud.js`** (imported by game.js via module or tag)

```js
// HUD update function — called each frame from game.js
// Must be loaded BEFORE game.js or called from game.js directly.
// Here it is inlined in game.js for simplicity.
// This file is a reference stub — actual logic lives in game.js updateHUD().

window.updateHUD = function(state, myShipId) {
    const me = state.ships.find(s => s.id === myShipId);
    if (!me) return;

    // HP bar
    const bar = document.getElementById('hud-hp-bar');
    if (bar) {
        const r = Math.max(0, me.hp / me.maxHp);
        bar.style.width = (r * 100) + '%';
        bar.style.backgroundColor = r > 0.5 ? '#52ff52' : r > 0.25 ? '#ffaa00' : '#ff3333';
    }

    // Ship name
    const nameEl = document.getElementById('ship-name-display');
    if (nameEl) nameEl.textContent = me.name;

    // Status
    const st = document.getElementById('ship-status');
    if (st) {
        const r = me.hp / me.maxHp;
        const col = r > 0.5 ? '#52ff52' : r > 0.25 ? '#ffaa00' : '#ff3333';
        st.innerHTML = `<span style="color:${col}">HULL: ${Math.ceil(r*100)}%</span>` +
            (me.isSinking ? ' <span style="color:#ff3333">SINKING</span>' : '') +
            ` | <span style="color:#888">KILLS: ${me.killCount}</span>` +
            ` | <span style="color:${me.team==='red'?'#ff7777':'#7799ff'}">${me.team.toUpperCase()}</span>`;
    }

    // Cannon circles
    for (let i=0;i<7;i++) {
        const c = document.getElementById('cannon-circle-'+i);
        if (!c) continue;
        // Server doesn't expose reloadTimes, so use a simple visual
        c.style.background = '#52ff52'; // always show green (server manages reload)
    }

    // Timer
    const timerEl = document.getElementById('hud-timer');
    if (timerEl) {
        const t = Math.max(0, state.timeLeft);
        const m = Math.floor(t/60), s = Math.floor(t%60);
        timerEl.textContent = m + ':' + String(s).padStart(2,'0');
    }

    // Mode label
    const modeEl = document.getElementById('hud-mode-label');
    if (modeEl) {
        const labels = { dm: 'DEATHMATCH', ctf: 'CAPTURE THE FLAG', capital: 'SINK THE CAPITAL SHIP' };
        modeEl.textContent = labels[state.mode] || state.mode.toUpperCase();
    }

    // Fleet counts for ai-status
    const red  = state.ships.filter(s=>s.team==='red'&&!s.isSinking&&!s.isDead).length;
    const blue = state.ships.filter(s=>s.team==='blue'&&!s.isSinking&&!s.isDead).length;
    const ais = document.getElementById('ai-status');
    if (ais) ais.innerHTML = `<span style="color:#ff7777">RED: ${red}</span> | <span style="color:#7799ff">BLUE: ${blue}</span>`;

    // Heading
    const hdg = document.getElementById('hud-heading');
    if (hdg && me.ry !== undefined) {
        const deg = Math.round(((-me.ry*180/Math.PI)%360+360)%360);
        const cards=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
        const card = cards[Math.round(deg/22.5)%16];
        hdg.innerHTML = `<span style="color:#888">HDG</span> <span style="color:#ffd700">${String(deg).padStart(3,'0')}°</span> ${card}`;
    }

    // Target
    const tgtEl = document.getElementById('hud-target');
    if (tgtEl) {
        const enemies = state.ships.filter(s=>s.team!==me.team&&!s.isSinking&&!s.isDead);
        if (!enemies.length) { tgtEl.innerHTML='<span style="color:#334">NO CONTACTS</span>'; return; }
        enemies.sort((a,b)=>{
            const da=(a.x-me.x)**2+(a.z-me.z)**2, db=(b.x-me.x)**2+(b.z-me.z)**2;
            return da-db;
        });
        const t=enemies[0];
        const dist=Math.round(Math.sqrt((t.x-me.x)**2+(t.z-me.z)**2));
        const tr=Math.max(0,t.hp/t.maxHp);
        const tb=Math.round(tr*10);
        tgtEl.innerHTML=`<span style="color:#ff7777">${t.name}</span><br><span style="color:#666">RANGE</span> ${dist}m<br><span style="color:#ff5252">${'█'.repeat(tb)}</span><span style="color:#333">${'█'.repeat(10-tb)}</span>`;
    }
};
```

---

## Task 12: Chat System

**Files:**
- Create: `trafalgar-io/public/js/chat.js`

- [ ] **Step 1: Create `public/js/chat.js`**

```js
// Load this before game.js via <script> tag (non-module)
window.Chat = (function() {
    const messages = [];

    function receive(msg) {
        messages.push(msg);
        if (messages.length > 30) messages.shift();
        render();
    }

    function render() {
        const el = document.getElementById('chat-messages');
        if (!el) return;
        el.innerHTML = messages.slice(-8).map(m =>
            `<div><span style="color:#aabbcc">${escHtml(m.name)}:</span> <span>${escHtml(m.text)}</span></div>`
        ).join('');
        el.scrollTop = el.scrollHeight;
    }

    function escHtml(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function focus() {
        const row = document.getElementById('chat-input-row');
        const input = document.getElementById('chat-input');
        if (!row || !input) return;
        row.style.display = 'flex';
        input.focus();
        input.addEventListener('keydown', function handler(e) {
            if (e.key === 'Enter') { send(); input.removeEventListener('keydown', handler); }
            if (e.key === 'Escape') { blur(); input.removeEventListener('keydown', handler); }
        });
    }

    function blur() {
        const row = document.getElementById('chat-input-row');
        if (row) row.style.display = 'none';
        const input = document.getElementById('chat-input');
        if (input) { input.blur(); input.value = ''; }
    }

    function send() {
        const input = document.getElementById('chat-input');
        if (!input || !input.value.trim()) { blur(); return; }
        // socket is declared in game.js module scope — access via window
        if (window._gameSocket) window._gameSocket.emit('chat', { text: input.value.trim() });
        blur();
    }

    return { receive, render, focus, blur, send };
})();
```

> **Note:** In `game.js`, after `socket` is created, add: `window._gameSocket = socket;` so Chat can emit.

---

## Task 13: Clan System

**Files:**
- Create: `trafalgar-io/public/js/clans.js`

- [ ] **Step 1: Create `public/js/clans.js`**

```js
window.Clans = (function() {
    const KEY = 'tio_clan';

    function getTag() {
        return (localStorage.getItem(KEY) || '').slice(0,4).toUpperCase();
    }

    function apply() {
        const input = document.getElementById('clanTagInput');
        if (!input) return;
        const tag = input.value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);
        if (tag.length < 2) { setStatus('Tag must be 2–4 letters/numbers'); return; }
        localStorage.setItem(KEY, tag);
        setStatus('[' + tag + '] clan tag applied');
    }

    function leave() {
        localStorage.removeItem(KEY);
        const input = document.getElementById('clanTagInput');
        if (input) input.value = '';
        setStatus('Left clan');
    }

    function setStatus(msg) {
        const el = document.getElementById('clanStatus');
        if (el) el.textContent = msg;
    }

    // Restore on load
    (function init() {
        const tag = getTag();
        const input = document.getElementById('clanTagInput');
        if (input && tag) input.value = tag;
        if (tag) setStatus('[' + tag + '] active');
    })();

    return { getTag, apply, leave };
})();
```

---

## Task 14: Shared CSS

**Files:**
- Create: `trafalgar-io/public/css/style.css`

- [ ] **Step 1: Create `public/css/style.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

*, *::before, *::after { box-sizing: border-box; }

body {
    margin: 0;
    background: #050d1a;
    color: #fff;
    font-family: 'Courier New', Courier, monospace;
    min-height: 100vh;
}

/* ── Lobby ── */
#lobby {
    max-width: 900px;
    margin: 0 auto;
    padding: 24px 16px 60px;
}

.lobby-title {
    text-align: center;
    margin-bottom: 32px;
    padding: 24px 0;
}
.title-voxel {
    font-family: 'Press Start 2P', monospace;
    font-size: clamp(1.4rem, 4vw, 2.8rem);
    color: #ffd700;
    letter-spacing: 0.04em;
    text-shadow: 3px 3px 0 #b8860b, 6px 6px 0 #8b6409, 0 0 40px rgba(255,200,0,0.5);
    margin-bottom: 10px;
}
.title-sub {
    color: #6688aa;
    font-size: 0.85em;
    letter-spacing: 0.2em;
}

.lobby-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
}
@media (max-width: 600px) { .lobby-row { grid-template-columns: 1fr; } }

.lobby-card {
    background: rgba(5,15,30,0.85);
    border: 1px solid rgba(255,200,50,0.25);
    padding: 16px 18px;
    position: relative;
}
.lobby-card.full-width { margin-bottom: 16px; }
.lobby-card::before, .lobby-card::after {
    content: ''; position: absolute;
    width: 8px; height: 8px;
    border-color: rgba(255,200,50,0.5); border-style: solid;
}
.lobby-card::before { top:-1px; left:-1px; border-width: 1px 0 0 1px; }
.lobby-card::after  { bottom:-1px; right:-1px; border-width: 0 1px 1px 0; }

.card-title {
    color: #ffd700;
    font-size: 0.72em;
    letter-spacing: 0.2em;
    margin-bottom: 12px;
    border-bottom: 1px solid rgba(255,200,50,0.15);
    padding-bottom: 6px;
}

label { display: block; color: #556677; font-size: 0.72em; letter-spacing: 0.1em; margin: 10px 0 4px; }

input[type="text"], select {
    width: 100%;
    background: rgba(0,8,20,0.8);
    border: 1px solid rgba(255,200,50,0.3);
    color: #fff;
    font-family: 'Courier New', monospace;
    font-size: 0.88em;
    padding: 7px 10px;
    outline: none;
}
input[type="text"]:focus, select:focus {
    border-color: rgba(255,200,50,0.7);
    box-shadow: 0 0 8px rgba(255,200,0,0.2);
}
select { cursor: pointer; }

/* Ship grid */
.ship-grid { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.ship-option {
    padding: 8px 10px;
    border: 1px solid #1a2a3a;
    cursor: pointer;
    transition: border-color 0.15s;
}
.ship-option:hover { border-color: rgba(255,200,50,0.4); }
.ship-option.selected { border-color: #ffd700; background: rgba(255,200,0,0.05); }
.ship-opt-name { color: #ffd700; font-size: 0.82em; margin-bottom: 2px; }
.ship-opt-desc { color: #6688aa; font-size: 0.72em; margin-bottom: 3px; }
.ship-opt-stats { color: #334455; font-size: 0.68em; }

/* Colour swatches */
.colour-row { display: flex; gap: 20px; margin-top: 10px; }
.colour-swatches { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 4px; }
.swatch {
    width: 22px; height: 22px;
    border: 2px solid transparent;
    cursor: pointer;
    border-radius: 2px;
    transition: border-color 0.1s;
}
.swatch:hover { border-color: rgba(255,255,255,0.5); }
.swatch.selected { border-color: #ffd700; }

/* Mode grid */
.match-row { display: grid; grid-template-columns: 1fr auto; gap: 20px; }
.mode-grid { display: flex; flex-direction: column; gap: 6px; }
.mode-option {
    padding: 8px 12px;
    border: 1px solid #1a2a3a;
    cursor: pointer;
    transition: border-color 0.15s;
}
.mode-option:hover { border-color: rgba(255,200,50,0.4); }
.mode-option.selected { border-color: #ffd700; background: rgba(255,200,0,0.05); }
.mode-name { color: #ffd700; font-size: 0.82em; }
.mode-desc { color: #6688aa; font-size: 0.72em; margin-top: 2px; }

/* Duration */
.duration-grid { display: flex; flex-direction: column; gap: 6px; }
.dur-option {
    padding: 8px 20px;
    border: 1px solid #1a2a3a;
    text-align: center;
    cursor: pointer;
    color: #6688aa;
    font-size: 0.85em;
}
.dur-option:hover { border-color: rgba(255,200,50,0.4); color: #fff; }
.dur-option.selected { border-color: #ffd700; color: #ffd700; }

/* Room list */
.room-list { display: flex; flex-direction: column; gap: 4px; }
.room-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 8px;
    background: rgba(0,8,20,0.5);
    font-size: 0.78em;
    color: #889aaa;
}

/* Buttons */
.btn-small {
    font-family: 'Courier New', monospace;
    color: #ffd700;
    background: transparent;
    border: 1px solid rgba(255,200,50,0.4);
    padding: 4px 10px;
    font-size: 0.75em;
    cursor: pointer;
}
.btn-small:hover { border-color: rgba(255,200,50,0.8); }

.battle-btn {
    display: block;
    width: 100%;
    margin-top: 20px;
    font-family: 'Courier New', monospace;
    font-size: 1.1em;
    letter-spacing: 0.25em;
    color: #ffd700;
    background: transparent;
    border: 1px solid rgba(255,200,50,0.6);
    padding: 16px;
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s;
}
.battle-btn:hover {
    border-color: rgba(255,200,50,1);
    box-shadow: 0 0 20px rgba(255,200,0,0.3);
}

/* ── In-game HUD ── */
#damage-vignette {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 5; opacity: 0;
    background: radial-gradient(ellipse at center, transparent 50%, rgba(180,0,0,0.6) 100%);
    transition: opacity 0.3s;
}
#hit-flash {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 6; opacity: 0;
    background: rgba(255,200,100,0.3);
    transition: opacity 0.05s;
}

.hud-panel {
    position: absolute;
    background: rgba(5,15,30,0.85);
    border: 1px solid rgba(255,200,50,0.35);
    font-family: 'Courier New', Courier, monospace;
    color: #fff;
    pointer-events: none;
    padding: 12px 16px;
    font-size: 1em;
    line-height: 1.6;
    z-index: 10;
}
.hud-panel::before, .hud-panel::after {
    content: ''; position: absolute;
    width: 7px; height: 7px;
    border-color: rgba(255,200,50,0.6); border-style: solid;
}
.hud-panel::before { top:-1px; left:-1px; border-width:1px 0 0 1px; }
.hud-panel::after  { bottom:-1px; right:-1px; border-width:0 1px 1px 0; }

.cannon-circle {
    display: inline-block;
    width: 22px; height: 22px;
    border-radius: 50%;
    border: 1px solid #334;
    background: #222;
    transition: background 0.15s;
}
```

---

## Task 15: Deployment Config + Instructions

**Files:**
- Create: `trafalgar-io/README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# Trafalgar.io

Multiplayer naval battle IO game. 3 game modes, 3 ship types, chat, clans, captain customisation.

## Turn On Multiplayer (2 steps)

### Step 1: Deploy the backend to Render (free)

1. Push this repo to GitHub
2. Go to render.com → New → Web Service → Connect your repo
3. Build command: `npm install`
4. Start command: `node server.js`
5. Copy the URL Render gives you (e.g. `https://trafalgar-io.onrender.com`)

### Step 2: Point the frontend at your backend

Open `public/js/config.js` and change:
```js
window.TRAFALGAR_SERVER = 'https://trafalgar-io.onrender.com';
```
Then redeploy to Netlify.

That's it. Players visit your Netlify URL and the game connects to your Render backend automatically.

## Local Development

```bash
npm install
node server.js
# Open http://localhost:3001 in browser
```

## Getting Players

- Share your Netlify URL on Discord servers for browser games
- Post on r/WebGames and r/indiegaming
- Add to itch.io (free, upload as HTML game pointing to your Netlify URL)
- Share on X/Twitter with gameplay clips

## Game Modes

| Mode | Objective |
|---|---|
| Deathmatch | Most kills when time runs out wins |
| Capture the Flag | Steal enemy flag, return to your base |
| Sink the Capital Ship | Attackers destroy the giant flagship |

## Controls

| Key | Action |
|---|---|
| W/S | Accelerate / Brake |
| A/D | Turn |
| R | Full port broadside |
| T | Full starboard broadside |
| 1–7 | Individual cannons |
| TAB | Aim assist / scoreboard |
| Enter | Open chat |
| Q/E | Orbit camera |
| Z/X | Zoom |
```

---

## Task 16: Wire Up Chat + Fix Three Identified Bugs + Final Integration

**Files:**
- Modify: `trafalgar-io/public/game.js`

- [ ] **Step 1: Add `window._gameSocket = socket` after socket creation in `game.js`**

After the line `const socket = io(...)`, add:
```js
window._gameSocket = socket;
```

- [ ] **Step 2: Add script tags for `chat.js` AND `hud.js` to `game.html`**

Add BOTH lines before the `<script type="importmap">` tag in `game.html`:
```html
<script src="js/chat.js"></script>
<script src="js/hud.js"></script>
```
`hud.js` defines `window.updateHUD` which `game.js` calls on every state tick — it must load before `game.js`.

- [ ] **Step 3: Add `socket.on('chat', ...)` handler and expose socket globally in `game.js`**

```js
window._gameSocket = socket;   // needed by Chat.send()
socket.on('chat', (msg) => Chat.receive(msg));
```

- [ ] **Step 4: Fix CTF flag return — store team on flag object**

In `game/GameMode.js`, in `initCTF()`, add `team` to each flag:
```js
initCTF() {
    this.flags = {
        red:  { x:  600, z: 0, carrier: null, atBase: true, team: 'red'  },
        blue: { x: -600, z: 0, carrier: null, atBase: true, team: 'blue' },
    };
}
```
Then in `_tickCTF`, the friendly return branch already checks `ship.team === ownFlag.team` — this now works correctly.

- [ ] **Step 5: Fix `server.js` join handler to support joining a specific room by ID**

In `server.js`, change the `socket.on('join', ...)` handler to accept an optional `roomId`:
```js
socket.on('join', ({ name, title, clanTag, shipType,
                     sailColour, hullColour, mode, duration, roomId }) => {
    // ...existing leave logic...

    const dur  = C.DURATIONS[duration] || 300;
    // If a specific roomId was requested and that room exists and is open, use it
    const room = (roomId && rooms.has(roomId) && !rooms.get(roomId).over)
        ? rooms.get(roomId)
        : getOrCreateRoom(mode || 'dm', dur);
    // ...rest unchanged...
});
```

In `game.js`, pass `roomId` when emitting join:
```js
socket.emit('join', {
    name, title, clanTag, shipType, sailColour, hullColour, mode, duration,
    roomId: params.get('roomId') || undefined,
});
```

- [ ] **Step 6: Fix `shipModels.js` — inline scale constants instead of undefined global**

Replace the `window.SHIP_CONSTANTS[shipType]` reference in `shipModels.js` with an inline map:
```js
const SHIP_SCALES = { sloop: 0.45, frigate: 0.6, sotl: 0.8, capital: 1.0 };
const spec = { scale: SHIP_SCALES[shipType] || 0.6 };
```

- [ ] **Step 4: End-to-end manual test**

```
1. cd trafalgar-io && node server.js
2. Open http://localhost:3001 in two browser tabs
3. Tab 1: Enter name "Player 1", pick Frigate, click SET SAIL
4. Tab 2: Enter name "Player 2", pick Sloop, click SET SAIL
5. Verify: Both ships visible, W/S/A/D moves ship, R/T fires broadside
6. Verify: Cannonball hits cause HP drop
7. Verify: Press Enter, type message, it appears in both tabs
8. Verify: AI bots appear and fight
9. Verify: TAB shows scoreboard
10. Verify: Timer counts down, game over screen appears at 0
```

- [ ] **Step 5: Deploy to Netlify**

```bash
cd trafalgar-io
netlify deploy --prod --dir public --site <create-new-site>
```

Get the URL, update `public/js/config.js` with the Render backend URL, redeploy.
```

---

## Quick Reference: Key Design Constants

| Constant | Value | Where |
|---|---|---|
| Tick rate | 20 Hz (50ms) | `game/constants.js` |
| Max players | 8 per room | `game/constants.js` |
| Min combatants | 4 (bots fill gaps) | `game/constants.js` |
| Bot names | 16 historical captains | `game/AIBot.js` |
| Map size | 2000×2000 | `game/constants.js` |
| Ship types | sloop, frigate, sotl, capital | `game/constants.js` |
| Sail colours | 8 presets | `game/constants.js` |
| Hull colours | 4 presets | `game/constants.js` |
| Game modes | dm, ctf, capital | `game/constants.js` |
| Backend port | 3001 (local), 10000 (Render) | `server.js` |
