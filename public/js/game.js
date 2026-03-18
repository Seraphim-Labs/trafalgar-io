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
scene.fog = new THREE.FogExp2(0x8899aa, 0.00018);

// Ocean
const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400, 32, 32),
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

const voxelGeo  = new THREE.BoxGeometry(1, 1, 1);
const flashGeo  = new THREE.SphereGeometry(1, 8, 8);
const smokeGeo  = new THREE.SphereGeometry(2, 6, 6);
const splashGeo = new THREE.SphereGeometry(0.5, 6, 6);
const wind = new THREE.Vector3(0.04, 0, 0.015);

const fxParticles   = [];
const smokeParticles = [];
const waterSplashes  = [];
const MAX_FX = 400, MAX_SMOKE = 500, MAX_SPLASH = 120;

function spawnMuzzleFlash(pos, dir) {
    if (fxParticles.length >= MAX_FX) return;
    const core = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
    core.position.copy(pos).addScaledVector(dir, 1);
    core.scale.setScalar(3.5);
    core.userData = { life: 1.0, decay: 0.15, vel: dir.clone().multiplyScalar(0.1), type: 'flash' };
    scene.add(core); fxParticles.push(core);
    for (let i = 0; i < 4; i++) {
        if (fxParticles.length >= MAX_FX) break;
        const fb = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.06 + Math.random()*0.04, 1.0, 0.5 + Math.random()*0.2), transparent: true
        }));
        fb.position.copy(pos).addScaledVector(dir, 0.5 + Math.random());
        fb.position.add(new THREE.Vector3((Math.random()-0.5)*1.5, (Math.random()-0.5)*1.5, (Math.random()-0.5)*1.5));
        fb.userData = { life: 1.0, decay: 0.06 + Math.random()*0.03,
            vel: dir.clone().multiplyScalar(0.3 + Math.random()*0.2).add(new THREE.Vector3((Math.random()-0.5)*0.15, 0.05+Math.random()*0.1, (Math.random()-0.5)*0.15)),
            type: 'fireball' };
        fb.scale.setScalar(1.0 + Math.random()*0.5);
        scene.add(fb); fxParticles.push(fb);
    }
}

function spawnCannonSmoke(pos, dir) {
    for (let i = 0; i < 6; i++) {
        if (smokeParticles.length >= MAX_SMOKE) return;
        const p = new THREE.Mesh(smokeGeo, new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0, 0, 0.55 + Math.random()*0.35), transparent: true, opacity: 0.0, depthWrite: false
        }));
        const offset = dir.clone().multiplyScalar(1.0 + Math.random()*2).add(new THREE.Vector3((Math.random()-0.5)*2, Math.random()*0.5, (Math.random()-0.5)*2));
        p.position.copy(pos).add(offset);
        p.userData = { life: 1.0, decay: 0.003 + Math.random()*0.002,
            vel: dir.clone().multiplyScalar(0.3 + Math.random()*0.4).add(new THREE.Vector3((Math.random()-0.5)*0.15, 0.02+Math.random()*0.04, (Math.random()-0.5)*0.15)),
            startScale: 0.3 + Math.random()*0.3, maxScale: 3.0 + Math.random()*2.0, fadeIn: 0.9, drag: 0.985 };
        p.scale.setScalar(p.userData.startScale);
        scene.add(p); smokeParticles.push(p);
    }
}

function spawnImpactExplosion(pos) {
    const flash = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true }));
    flash.position.copy(pos); flash.scale.setScalar(4);
    flash.userData = { life: 1.0, decay: 0.12, vel: new THREE.Vector3(0, 0.05, 0), type: 'flash' };
    scene.add(flash); fxParticles.push(flash);
    for (let i = 0; i < 10; i++) {
        if (fxParticles.length >= MAX_FX) break;
        const isFire = i < 5;
        const color = isFire
            ? new THREE.Color().setHSL(0.04 + Math.random()*0.06, 0.9, 0.4 + Math.random()*0.3)
            : new THREE.Color().setHSL(0.08, 0.5, 0.15 + Math.random()*0.15);
        const p = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
        p.position.copy(pos).add(new THREE.Vector3((Math.random()-0.5)*3, Math.random()*2, (Math.random()-0.5)*3));
        p.userData = { life: 1.0, decay: isFire ? 0.025 + Math.random()*0.02 : 0.03 + Math.random()*0.03,
            vel: new THREE.Vector3((Math.random()-0.5)*0.6, 0.15+Math.random()*0.3, (Math.random()-0.5)*0.6),
            type: isFire ? 'fireball' : 'debris', gravity: !isFire };
        p.scale.setScalar(isFire ? 1.0 + Math.random() : 0.3 + Math.random()*0.3);
        scene.add(p); fxParticles.push(p);
    }
}

function spawnDamageSmokeAt(shipPos, hpRatio) {
    if (smokeParticles.length >= MAX_SMOKE) return;
    const p = new THREE.Mesh(smokeGeo, new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0, 0, 0.15 + Math.random()*0.2), transparent: true, opacity: 0.0, depthWrite: false
    }));
    p.position.set(shipPos.x + (Math.random()-0.5)*8, shipPos.y + 2 + Math.random()*5, shipPos.z + (Math.random()-0.5)*8);
    p.userData = { life: 1.0, decay: 0.003 + Math.random()*0.003,
        vel: new THREE.Vector3((Math.random()-0.5)*0.03, 0.08+Math.random()*0.06, (Math.random()-0.5)*0.03),
        startScale: 0.5 + Math.random()*0.5, maxScale: 3.0 + Math.random()*2.0 + (1-hpRatio)*2,
        fadeIn: 0.85, drag: 0.995 };
    p.scale.setScalar(p.userData.startScale);
    scene.add(p); smokeParticles.push(p);
}

function updateParticles(dt) {
    for (let i = fxParticles.length - 1; i >= 0; i--) {
        const p = fxParticles[i]; const ud = p.userData;
        ud.life -= ud.decay * dt;
        if (ud.vel) { p.position.addScaledVector(ud.vel, dt); if (ud.gravity) ud.vel.y -= 0.02*dt; }
        p.position.addScaledVector(wind, dt*0.3);
        if (ud.type === 'flash')   { p.scale.setScalar(Math.max(0.01, ud.life*ud.life*4)); p.material.opacity = ud.life; }
        else if (ud.type === 'fireball') { const age=1-ud.life; p.scale.setScalar(Math.max(0.01,(1+age*2)*1.2)); p.material.opacity=ud.life*0.85; p.material.color.setHSL(Math.max(0,0.07-age*0.04),0.9,Math.max(0.1,0.5-age*0.3)); }
        else { p.scale.setScalar(Math.max(0.01,0.3+ud.life*0.2)); p.material.opacity=ud.life; }
        if (ud.life <= 0) { scene.remove(p); fxParticles.splice(i, 1); }
    }
    for (let i = smokeParticles.length - 1; i >= 0; i--) {
        const p = smokeParticles[i]; const ud = p.userData;
        ud.life -= ud.decay * dt;
        if (ud.vel) { p.position.addScaledVector(ud.vel, dt); if (ud.drag) ud.vel.multiplyScalar(Math.pow(ud.drag, dt)); }
        p.position.addScaledVector(wind, dt);
        const age = 1 - ud.life;
        const sc = ud.startScale + (ud.maxScale - ud.startScale) * Math.min(1, age * 2);
        p.scale.setScalar(Math.max(0.01, sc));
        if (age < (1 - ud.fadeIn)) p.material.opacity = age / (1 - ud.fadeIn) * 0.6;
        else p.material.opacity = ud.life * 0.6;
        if (ud.life <= 0) { scene.remove(p); smokeParticles.splice(i, 1); }
    }
    for (let i = waterSplashes.length - 1; i >= 0; i--) {
        const p = waterSplashes[i];
        p.userData.life -= p.userData.decay * dt;
        p.userData.vel.y -= 0.04 * dt;
        p.position.addScaledVector(p.userData.vel, dt);
        if (p.position.y < 0) p.position.y = 0;
        p.material.opacity = p.userData.life * 0.7;
        p.scale.setScalar(Math.max(0.01, p.userData.life));
        if (p.userData.life <= 0) { scene.remove(p); waterSplashes.splice(i, 1); }
    }
}

// ── Ship wakes ─────────────────────────────────────────────────────
const wakeParticles = [];
const MAX_WAKES = 300;
const wakeMat = new THREE.MeshBasicMaterial({
    color: 0xaaccdd, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide
});
const wakeGeo = new THREE.PlaneGeometry(1, 1);

function spawnWake(ship) {
    if (wakeParticles.length >= MAX_WAKES) return;
    const speed = Math.abs(ship.vel || 0);
    if (speed < 0.05) return;

    // Stern direction: negative of ship forward
    const fwdX = Math.cos(ship.ry - Math.PI / 2);
    const fwdZ = Math.sin(ship.ry - Math.PI / 2);
    const sternX = ship.x - fwdX * 6;
    const sternZ = ship.z - fwdZ * 6;
    // Right vector for the V spread
    const rtX = Math.cos(ship.ry), rtZ = Math.sin(ship.ry);

    for (let side = -1; side <= 1; side += 2) {
        if (wakeParticles.length >= MAX_WAKES) break;
        const p = new THREE.Mesh(wakeGeo, wakeMat.clone());
        p.rotation.x = -Math.PI / 2;
        p.position.set(
            sternX + rtX * side * 2.5 + (Math.random()-0.5),
            0.05,
            sternZ + rtZ * side * 2.5 + (Math.random()-0.5)
        );
        const spread = speed * 0.8;
        p.userData = {
            life: 1.0,
            decay: 0.012 + Math.random() * 0.008,
            vx: -fwdX * spread * 0.3 + rtX * side * spread * 0.15,
            vz: -fwdZ * spread * 0.3 + rtZ * side * spread * 0.15,
            maxScale: 3 + speed * 4,
        };
        p.scale.setScalar(0.5 + speed * 1.5);
        scene.add(p);
        wakeParticles.push(p);
    }
}

function updateWakes(dt) {
    for (let i = wakeParticles.length - 1; i >= 0; i--) {
        const p = wakeParticles[i];
        const ud = p.userData;
        ud.life -= ud.decay * dt;
        p.position.x += ud.vx * dt;
        p.position.z += ud.vz * dt;
        // Expand and fade
        const age = 1 - ud.life;
        p.scale.setScalar(p.scale.x + ud.maxScale * 0.015 * dt);
        p.material.opacity = Math.max(0, ud.life * 0.35);
        if (ud.life <= 0) { scene.remove(p); wakeParticles.splice(i, 1); }
    }
}

// ── Client-side reload tracking ────────────────────────────────────
const clientReloadTimes = new Array(14).fill(0);
const RELOAD_MS = 2500;

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
let showScoreboard  = false;
let showRangeDisplay = false;

// ── 3D Range Arcs (port / starboard / bow) ─────────────────────────
let rangeGroup = null, portArcLine = null, stbdArcLine = null, bowArcLine = null;
let aimDivRangeEnabled = false;
const MAX_CANNON_RANGE_ARC = 250;

function createArcPts(startAngle, endAngle, radius, segs) {
    const pts = [];
    pts.push(new THREE.Vector3(0, 0.8, 0));
    pts.push(new THREE.Vector3(Math.cos(startAngle)*radius, 0.8, Math.sin(startAngle)*radius));
    for (let i = 0; i <= segs; i++) {
        const a = startAngle + (endAngle - startAngle) * i / segs;
        pts.push(new THREE.Vector3(Math.cos(a)*radius, 0.8, Math.sin(a)*radius));
    }
    pts.push(new THREE.Vector3(0, 0.8, 0));
    return pts;
}

function initRangeArcs() {
    if (rangeGroup) { scene.remove(rangeGroup); }
    rangeGroup = new THREE.Group();
    const portGeo = new THREE.BufferGeometry().setFromPoints(createArcPts(Math.PI, 2*Math.PI, MAX_CANNON_RANGE_ARC, 40));
    portArcLine = new THREE.Line(portGeo, new THREE.LineBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.08 }));
    rangeGroup.add(portArcLine);
    const stbdGeo = new THREE.BufferGeometry().setFromPoints(createArcPts(0, Math.PI, MAX_CANNON_RANGE_ARC, 40));
    stbdArcLine = new THREE.Line(stbdGeo, new THREE.LineBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.08 }));
    rangeGroup.add(stbdArcLine);
    const bowGeo = new THREE.BufferGeometry().setFromPoints(createArcPts(-Math.PI/6, Math.PI/6, MAX_CANNON_RANGE_ARC, 12));
    bowArcLine = new THREE.Line(bowGeo, new THREE.LineBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.08 }));
    rangeGroup.add(bowArcLine);
    rangeGroup.visible = false;
    scene.add(rangeGroup);
}

function updateRangeArcs() {
    if (!rangeGroup || !gameState || !myShipId) return;
    const me = gameState.ships.find(s => s.id === myShipId);
    if (!me || me.isSinking || me.isDead) { rangeGroup.visible = false; return; }
    rangeGroup.visible = showRangeDisplay;
    if (!showRangeDisplay) return;
    rangeGroup.position.set(me.x, 0, me.z);
    rangeGroup.rotation.y = me.ry;
    const invQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), me.ry).invert();
    let portHit = false, stbdHit = false, bowHit = false;
    (gameState.ships || []).forEach(s => {
        if (s.team === me.team || s.isSinking || s.isDead) return;
        const dx = s.x - me.x, dz = s.z - me.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist > MAX_CANNON_RANGE_ARC) return;
        const local = new THREE.Vector3(dx, 0, dz).applyQuaternion(invQ);
        if (local.z < -2) portHit = true;
        if (local.z >  2) stbdHit = true;
        const fa = local.x > 0 ? Math.atan2(Math.abs(local.z), local.x) : Math.PI;
        if (local.x > 0 && fa < Math.PI/6) bowHit = true;
    });
    portArcLine.material.color.setHex(portHit ? 0xff3300 : 0xff8800);
    portArcLine.material.opacity = portHit ? 0.45 : 0.08;
    stbdArcLine.material.color.setHex(stbdHit ? 0x00ffff : 0x0088cc);
    stbdArcLine.material.opacity = stbdHit ? 0.45 : 0.08;
    bowArcLine.material.color.setHex(bowHit  ? 0xffff00 : 0x886600);
    bowArcLine.material.opacity  = bowHit  ? 0.45 : 0.08;
}

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
    initRangeArcs();
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
        if (ev.type === 'hit') {
            // Find where the hit ship is and spawn explosion there
            const hitShip = state.ships.find(s => s.id === ev.shipId);
            if (hitShip) spawnImpactExplosion(new THREE.Vector3(hitShip.x, 3, hitShip.z));
            if (ev.shipId === myShipId) {
                screenShake = 6;
                const hf = document.getElementById('hit-flash');
                if (hf) { hf.style.opacity = '1'; setTimeout(() => hf.style.opacity = '0', 80); }
            }
        }
        if (ev.type === 'fire') {
            const sh = state.ships.find(s => s.id === ev.shipId);
            if (sh) {
                // Muzzle flash + smoke at ship position in fire direction
                const cannonIdx = ev.cannonIdx || 0;
                const half = Math.floor(7 / 2);
                let lx = 1, lz = 0;
                if (cannonIdx >= 1 && cannonIdx <= half) { lx = 0; lz = -1; }
                else if (cannonIdx > half) { lx = 0; lz = 1; }
                const cos = Math.cos(sh.ry), sin = Math.sin(sh.ry);
                const dir = new THREE.Vector3(lx*cos - lz*sin, 0, lx*sin + lz*cos).normalize();
                const pos = new THREE.Vector3(sh.x, 3, sh.z);
                spawnMuzzleFlash(pos, dir);
                spawnCannonSmoke(pos, dir);

                const fl = fireLights[nextFl++ % fireLights.length];
                fl.position.set(sh.x, 4, sh.z);
                fl.intensity = 150;
            }
        }
        if (ev.type === 'sank') {
            const nm = state.ships.find(s => s.id === ev.shipId);
            addBattleLog((nm ? nm.name : 'A ship') + ' has been sunk!');
        }
        if (ev.type === 'capture') addBattleLog(ev.player + ' captured the flag!');
        if (ev.type === 'flagReturn') addBattleLog(ev.team + ' flag returned!');
    }

    // Wakes behind every moving ship
    for (const sd of state.ships) {
        if (!sd.isDead && !sd.isSinking) spawnWake(sd);
    }

    // Damage smoke for ships below 60% HP
    for (const sd of state.ships) {
        if (sd.isDead || sd.isSinking) continue;
        const hpRatio = sd.hp / sd.maxHp;
        if (hpRatio < 0.6 && Math.random() < (1 - hpRatio) * 0.08) {
            spawnDamageSmokeAt(new THREE.Vector3(sd.x, 0, sd.z), hpRatio);
        }
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
    clientReloadTimes.fill(0);
}

function updateCannonCircles() {
    const now = Date.now();
    for (let i = 0; i < 7; i++) {
        const el = document.getElementById('cannon-circle-' + i);
        if (!el) continue;
        const elapsed = now - (clientReloadTimes[i] || 0);
        if (elapsed >= RELOAD_MS) {
            el.style.background = '#52ff52';
            el.style.borderColor = '#2a8a2a';
            el.style.boxShadow   = '0 0 4px rgba(82,255,82,0.4)';
        } else {
            const deg = Math.round((elapsed / RELOAD_MS) * 360);
            el.style.background  = `conic-gradient(#ffaa00 ${deg}deg, #222 ${deg}deg)`;
            el.style.borderColor = '#334';
            el.style.boxShadow   = 'none';
        }
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
    if (!gameState || !myShipId || !showRangeDisplay) { aimDivs.forEach(a => a.div.style.display = 'none'); return; }
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
    if (e.key.toLowerCase() === 'r') {
        socket.emit('broadside', { side: 'port' });
        for (let i = 1; i <= 3; i++) clientReloadTimes[i] = Date.now() + i * 120;
    }
    if (e.key.toLowerCase() === 't') {
        socket.emit('broadside', { side: 'starboard' });
        for (let i = 4; i <= 6; i++) clientReloadTimes[i] = Date.now() + (i-4) * 120;
    }
    const n = parseInt(e.key);
    if (n >= 1 && n <= 7) {
        socket.emit('fire', { cannonIdx: n - 1 });
        clientReloadTimes[n - 1] = Date.now();
    }
    if (e.key === 'Tab') {
        e.preventDefault();
        showRangeDisplay = !showRangeDisplay;
    }
    if (e.key.toLowerCase() === 'm') {
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

let lastAnimTime = performance.now();
function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt  = Math.min((now - lastAnimTime) / 16.67, 3);
    lastAnimTime = now;

    updateParticles(dt);
    updateWakes(dt);
    updateCannonCircles();
    updateRangeArcs();
    fireLights.forEach(fl => { if (fl.intensity > 0) fl.intensity *= 0.88; });

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
