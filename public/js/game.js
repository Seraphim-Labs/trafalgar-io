import * as THREE from 'three';

// ── Scene ──────────────────────────────────────────────────────────
const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 15000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(500, 1000, 500);
scene.add(sun);
scene.fog = new THREE.FogExp2(0x8899aa, 0.00008);

// Ocean
const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshStandardMaterial({ color: 0x1a4060, roughness: 0.8 })
);
ocean.rotation.x = -Math.PI / 2;
scene.add(ocean);

// Fire light pool
const fireLights = [];
for (let i = 0; i < 6; i++) {
    const fl = new THREE.PointLight(0xffaa44, 0, 120);
    scene.add(fl);
    fireLights.push(fl);
}
let nextFl = 0;

const voxelGeo = new THREE.BoxGeometry(1, 1, 1);

// ── State ──────────────────────────────────────────────────────────
const params     = new URLSearchParams(location.search);
const shipMeshes = new Map();
const ballMeshes = new Map();
let myShipId     = null;
let gameState    = null;
let orbitY       = Math.PI;
let camDist      = 200;
let screenShake  = 0;
const keys       = {};
let showScoreboard = false;

// ── Socket ─────────────────────────────────────────────────────────
const socket = io(window.TRAFALGAR_SERVER, { transports: ['websocket'] });
window._gameSocket = socket;

socket.on('connect', () => {
    socket.emit('join', {
        name:       params.get('name')       || 'Captain',
        title:      params.get('title')      || 'Captain',
        clanTag:    params.get('clanTag')    || '',
        shipType:   params.get('shipType')   || 'frigate',
        sailColour: params.get('sailColour') || '#f5f0e0',
        hullColour: params.get('hullColour') || '#5D4037',
        mode:       params.get('mode')       || 'dm',
        duration:   params.get('duration')   || '5m',
        roomId:     params.get('roomId')     || undefined,
    });
});

socket.on('joined', ({ shipId }) => {
    myShipId = shipId;
    initCannons();
    initAimDivs();
});

socket.on('state', (state) => {
    gameState = state;
    applyState(state);
});

socket.on('chat', (msg) => Chat.receive(msg));
socket.on('chatHistory', (msgs) => msgs.forEach(m => Chat.receive(m)));

socket.on('gameOver', ({ winner }) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:50;background:rgba(5,12,25,0.95);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:"Courier New",monospace;text-align:center;pointer-events:auto;';
    overlay.innerHTML =
        '<div style="font-family:\'Press Start 2P\',monospace;color:#ffd700;font-size:2em;margin-bottom:16px;text-shadow:3px 3px 0 #b8860b;">BATTLE OVER</div>' +
        '<div style="color:#8899aa;margin-bottom:32px;font-size:0.9em;">' + winner + '</div>' +
        '<button onclick="window.location.href=\'index.html\'" style="font-family:\'Courier New\',monospace;color:#ffd700;background:transparent;border:1px solid rgba(255,200,50,0.6);padding:14px 36px;font-size:1em;cursor:pointer;letter-spacing:0.2em;">RETURN TO PORT</button>';
    document.body.appendChild(overlay);
});

// ── Apply state to Three.js ────────────────────────────────────────
function applyState(state) {
    const activeIds = new Set();

    for (const sd of state.ships) {
        activeIds.add(sd.id);
        if (sd.isDead) { const m = shipMeshes.get(sd.id); if (m) m.visible = false; continue; }
        let group = shipMeshes.get(sd.id);
        if (!group) {
            group = window.ShipModels.buildMesh(scene, THREE, voxelGeo, sd);
            shipMeshes.set(sd.id, group);
        }
        group.visible = true;
        group.position.set(sd.x, sd.y, sd.z);
        group.rotation.y = sd.ry;
        group.rotation.z = Math.sin(Date.now() * 0.001 + sd.x * 0.01) * 0.015;
    }

    for (const [id, mesh] of shipMeshes) {
        if (!activeIds.has(id)) { scene.remove(mesh); shipMeshes.delete(id); }
    }

    const ballIds = new Set();
    for (const bd of state.cannonballs) {
        ballIds.add(bd.id);
        let ball = ballMeshes.get(bd.id);
        if (!ball) {
            ball = new THREE.Mesh(
                new THREE.SphereGeometry(0.3, 6, 6),
                new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 })
            );
            scene.add(ball);
            ballMeshes.set(bd.id, ball);
        }
        ball.position.set(bd.x, bd.y, bd.z);
    }
    for (const [id, mesh] of ballMeshes) {
        if (!ballIds.has(id)) { scene.remove(mesh); ballMeshes.delete(id); }
    }

    for (const ev of (state.events || [])) {
        if (ev.type === 'hit' && ev.shipId === myShipId) {
            screenShake = 6;
            const hf = document.getElementById('hit-flash');
            if (hf) { hf.style.opacity = '1'; setTimeout(() => hf.style.opacity = '0', 80); }
        }
        if (ev.type === 'fire') {
            const sh = state.ships.find(s => s.id === ev.shipId);
            if (sh) {
                const fl = fireLights[nextFl++ % fireLights.length];
                fl.position.set(sh.x, 4, sh.z);
                fl.intensity = 120;
            }
        }
        if (ev.type === 'sank') {
            const nm = state.ships.find(s => s.id === ev.shipId);
            addBattleLog((nm ? nm.name : 'A ship') + ' has been sunk!');
        }
        if (ev.type === 'capture') addBattleLog(ev.player + ' captured the flag!');
        if (ev.type === 'flagReturn') addBattleLog(ev.team + ' flag returned!');
    }

    fireLights.forEach(fl => { if (fl.intensity > 0) fl.intensity *= 0.85; });

    window.updateHUD(state, myShipId);
    updateCTFHud(state);
    updateAimAssist(state);
    if (showScoreboard) updateScoreboard(state);

    const dv = document.getElementById('damage-vignette');
    if (dv) {
        const me = state.ships.find(s => s.id === myShipId);
        if (me) dv.style.opacity = Math.max(0, (1 - me.hp / me.maxHp) * 0.8);
    }
}

// ── CTF hud ────────────────────────────────────────────────────────
function updateCTFHud(state) {
    const el = document.getElementById('ctf-hud');
    if (!el) return;
    if (state.mode !== 'ctf' || !state.flags) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    const rf = state.flags.red, bf = state.flags.blue;
    document.getElementById('ctf-red').textContent  = '\uD83D\uDEA9 Red: '  + (rf.atBase ? 'HOME' : rf.carrier ? 'CARRIED' : 'DROPPED');
    document.getElementById('ctf-blue').textContent = '\uD83D\uDEA9 Blue: ' + (bf.atBase ? 'HOME' : bf.carrier ? 'CARRIED' : 'DROPPED');
}

// ── Battle log ─────────────────────────────────────────────────────
const battleLog = [];
function addBattleLog(msg) {
    battleLog.unshift(msg);
    if (battleLog.length > 5) battleLog.pop();
    const el = document.getElementById('battle-log');
    if (el) el.innerHTML = battleLog.map(l => '<div>' + l + '</div>').join('');
}

// ── Scoreboard ─────────────────────────────────────────────────────
function updateScoreboard(state) {
    const el = document.getElementById('scoreboard-body');
    if (!el) return;
    const sorted = [...state.ships].sort((a, b) => b.score - a.score);
    el.innerHTML = sorted.map(s =>
        '<div style="display:flex;justify-content:space-between;padding:2px 0;color:' +
        (s.team === 'red' ? '#ff7777' : '#7799ff') +
        (s.id === myShipId ? ';font-weight:bold' : '') + '">' +
        '<span>' + s.name + (s.isBot ? ' <span style="color:#445">[AI]</span>' : '') + '</span>' +
        '<span>' + s.score + ' pts &nbsp; ' + s.killCount + ' kills &nbsp; ' + Math.ceil(s.hp / s.maxHp * 100) + '% HP</span>' +
        '</div>'
    ).join('');
}

// ── Cannon circles ─────────────────────────────────────────────────
function initCannons() {
    const c = document.getElementById('hud-cannon-circles');
    if (!c) return;
    c.innerHTML = '';
    for (let i = 0; i < 7; i++) {
        const el = document.createElement('span');
        el.className = 'cannon-circle';
        el.id = 'cannon-circle-' + i;
        c.appendChild(el);
    }
    // Show all green (server manages reload, client can't know without reloadTimes)
    for (let i = 0; i < 7; i++) {
        const el = document.getElementById('cannon-circle-' + i);
        if (el) el.style.background = '#52ff52';
    }
}

// ── Aim assist ─────────────────────────────────────────────────────
let aimDivs = [];
const MAX_CANNON_RANGE = 250;

function initAimDivs() {
    aimDivs.forEach(d => { if (d.div && d.div.parentNode) d.div.parentNode.removeChild(d.div); });
    aimDivs = [];
    const svg = '<svg width="52" height="52" viewBox="0 0 52 52" style="display:block"><circle cx="26" cy="26" r="20" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="26" y1="4" x2="26" y2="14" stroke="currentColor" stroke-width="1.5"/><line x1="26" y1="38" x2="26" y2="48" stroke="currentColor" stroke-width="1.5"/><line x1="4" y1="26" x2="14" y2="26" stroke="currentColor" stroke-width="1.5"/><line x1="38" y1="26" x2="48" y2="26" stroke="currentColor" stroke-width="1.5"/></svg>';
    for (let i = 0; i < 16; i++) {
        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;pointer-events:none;z-index:15;display:none;transform:translate(-50%,-50%);font-family:"Courier New",monospace;';
        div.innerHTML = svg + '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:11px;font-weight:bold;"></div>';
        document.body.appendChild(div);
        aimDivs.push({ div, lbl: div.querySelector('div') });
    }
}

function updateAimAssist(state) {
    if (!gameState || !myShipId) { aimDivs.forEach(a => a.div.style.display = 'none'); return; }
    const me = state.ships.find(s => s.id === myShipId);
    if (!me || me.isSinking || me.isDead) { aimDivs.forEach(a => a.div.style.display = 'none'); return; }

    const enemies = state.ships.filter(s => s.team !== me.team && !s.isSinking && !s.isDead);
    const cosR = Math.cos(-me.ry), sinR = Math.sin(-me.ry);
    let di = 0;

    for (const en of enemies) {
        if (di >= aimDivs.length) break;
        const dx = en.x - me.x, dz = en.z - me.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const lx =  dx * cosR - dz * sinR;
        const lz =  dx * sinR + dz * cosR;

        const portW = dist <= MAX_CANNON_RANGE && lz < -2 && Math.abs(lx) < 20;
        const stbdW = dist <= MAX_CANNON_RANGE && lz >  2 && Math.abs(lx) < 20;
        const bowA  = dist <= MAX_CANNON_RANGE && lx > 0 && Math.atan2(Math.abs(lz), lx) < Math.PI / 8 && Math.abs(lz) < lx;

        const wp = new THREE.Vector3(en.x, 8, en.z).project(camera);
        if (wp.z > 1) continue;
        const sx = (wp.x * 0.5 + 0.5) * innerWidth;
        const sy = (-wp.y * 0.5 + 0.5) * innerHeight;

        const a = aimDivs[di++];
        a.div.style.display = 'block';
        a.div.style.left = sx + 'px';
        a.div.style.top  = sy + 'px';

        if (portW || stbdW || bowA) {
            a.div.style.color = '#ffee00';
            a.lbl.textContent = portW ? 'R' : stbdW ? 'T' : 'B';
        } else if (dist <= MAX_CANNON_RANGE) {
            a.div.style.color = lz < 0 ? 'rgba(255,80,0,0.4)' : 'rgba(0,200,255,0.4)';
            a.lbl.textContent = lz < 0 ? 'R' : 'T';
        } else {
            a.div.style.color = 'rgba(160,0,0,0.22)';
            a.lbl.textContent = '\u00d7';
        }
    }
    for (let j = di; j < aimDivs.length; j++) aimDivs[j].div.style.display = 'none';
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
    if (n >= 1 && n <= 7) socket.emit('fire', { cannonIdx: n - 1 });
    if (e.key === 'Tab') {
        e.preventDefault();
        showScoreboard = !showScoreboard;
        document.getElementById('scoreboard').style.display = showScoreboard ? 'block' : 'none';
    }
    if (e.key === 'Enter') Chat.focus();
    if (e.key === 'Escape') Chat.blur();
});
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

setInterval(() => {
    if (!myShipId) return;
    socket.emit('input', { w: !!keys['w'], s: !!keys['s'], a: !!keys['a'], d: !!keys['d'] });
}, 50);

// ── Music ──────────────────────────────────────────────────────────
const PLAYLIST = [
    'music/InStormAndSunshine.mp3', 'music/FlorentinerMarch.mp3',
    'music/Zacatecas.mp3', 'music/UnderTheDoubleEagle.mp3'
];
let musicIdx = 0, musicMuted = false, musicStarted = false;
function playTrack() {
    if (musicMuted) return;
    const a = document.getElementById('bgMusic');
    a.src = PLAYLIST[musicIdx]; a.volume = 0;
    a.play().catch(() => {});
    let v = 0;
    const fi = setInterval(() => { v = Math.min(v + 0.005, 0.12); a.volume = v; if (v >= 0.12) clearInterval(fi); }, 100);
    a.onended = () => { musicIdx = (musicIdx + 1) % PLAYLIST.length; playTrack(); };
}
function startMusic() { if (musicStarted) return; musicStarted = true; playTrack(); }
window.toggleMusic = function() {
    musicMuted = !musicMuted;
    const a = document.getElementById('bgMusic');
    const b = document.getElementById('music-toggle');
    if (musicMuted) { a.pause(); if (b) b.textContent = '\u266a OFF'; }
    else { if (!musicStarted) startMusic(); else a.play().catch(() => {}); if (b) b.textContent = '\u266a ON'; }
};
document.addEventListener('click', startMusic, { once: true });
document.addEventListener('keydown', startMusic, { once: true });

// ── Render loop ────────────────────────────────────────────────────
window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    if (!gameState) { renderer.render(scene, camera); return; }

    const me = gameState.ships.find(s => s.id === myShipId);
    if (me && !me.isDead && !me.isSinking) {
        const ang = me.ry + orbitY;
        let cx = me.x + Math.cos(ang) * camDist;
        let cy = camDist * 0.6;
        let cz = me.z - Math.sin(ang) * camDist;
        if (screenShake > 0.1) {
            cx += (Math.random() - 0.5) * screenShake;
            cy += (Math.random() - 0.5) * screenShake * 0.5;
            cz += (Math.random() - 0.5) * screenShake;
            screenShake *= 0.85;
        }
        camera.position.set(cx, cy, cz);
        camera.lookAt(me.x, 0, me.z);
    }

    renderer.render(scene, camera);
}
animate();
