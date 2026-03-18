'use strict';
const C = require('./constants');

const BOT_NAMES = [
    'Lord Collingwood','Cuthbert Nelson','James Hardy','Thomas Fremantle',
    'Charles Bullen','Henry Blackwood','Edward Berry','Israel Pellew',
    'George Duff','William Hargood','John Conn','Richard King',
    'Robert Moorsom','John Cooke','Charles Tyler','William Rutherford',
];
const BOT_TITLES = ['Captain','Commodore','Admiral','Commander','Rear-Admiral'];
let _botIdx = 0;
function newBotName()  { return BOT_NAMES[_botIdx++ % BOT_NAMES.length]; }
function newBotTitle() { return BOT_TITLES[Math.floor(Math.random() * BOT_TITLES.length)]; }

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
        const score = 1000 - d + (1 - o.hp / o.maxHp) * 500;
        if (score > bestScore) { bestScore = score; best = o; }
    }
    return best;
}

function updateAI(ship, allShips, room, dt) {
    if (ship.isDead || ship.isSinking) return;
    ship.aiStateTimer += dt;
    if (!ship.aiTarget || ship.aiTarget.isSinking || ship.aiTarget.isDead || ship.aiStateTimer > 8) {
        ship.aiTarget = pickTarget(ship, allShips);
        if (ship.aiStateTimer > 8) ship.aiStateTimer = 0;
    }
    const target = ship.aiTarget;
    if (!target) { ship.vel *= 0.98; return; }

    const dx = target.x - ship.x, dz = target.z - ship.z;
    const d  = Math.sqrt(dx * dx + dz * dz) || 1;
    const toTargetAngle = Math.atan2(dx, dz) - Math.PI / 2;
    const rtX  = Math.cos(ship.ry), rtZ = Math.sin(ship.ry);
    const dotSide = rtX * dx / d + rtZ * dz / d;
    const broadsideAlign = Math.abs(dotSide);
    const side = dotSide > 0 ? 'starboard' : 'port';
    const spec   = C.SHIP_TYPES[ship.shipType];
    const hpFact = ship.hp / ship.maxHp;
    const maxSpd = spec.maxSpeed * (0.5 + hpFact * 0.5);

    if (hpFact < 0.25 && d < 150)      ship.aiState = 'DISENGAGE';
    else if (d > 350)                   ship.aiState = 'APPROACH';
    else if (d < 250 && broadsideAlign > 0.7) ship.aiState = 'BROADSIDE';
    else                                ship.aiState = 'MANEUVER';

    if (ship.aiState === 'APPROACH' || ship.aiState === 'MANEUVER') {
        const diff = angleDiff(toTargetAngle, ship.ry);
        ship.ry  += diff * 0.025 * ship.aiSkill;
        ship.vel += (maxSpd * (ship.aiState === 'MANEUVER' ? 0.8 : 1) - ship.vel) * 0.008;
    } else if (ship.aiState === 'BROADSIDE') {
        const perpAngle = Math.atan2(-dz / d, dx / d) - Math.PI / 2;
        const diff = angleDiff(perpAngle, ship.ry);
        ship.ry  += diff * 0.02;
        ship.vel += (maxSpd * 0.7 - ship.vel) * 0.01;
        _fireAIBroadside(ship, side, room);
    } else if (ship.aiState === 'DISENGAGE') {
        const awayAngle = toTargetAngle + Math.PI;
        ship.ry += angleDiff(awayAngle, ship.ry) * 0.03;
        ship.vel += (maxSpd - ship.vel) * 0.01;
    }
}

function _fireAIBroadside(ship, side, room) {
    const spec  = C.SHIP_TYPES[ship.shipType];
    const total = spec.cannonCount;
    const half  = Math.floor(total / 2);
    const start = side === 'port' ? 1 : half + 1;
    const end   = side === 'port' ? half : total - 1;
    for (let i = start; i <= Math.min(end, total - 1); i++) {
        if (ship.canFireCannon(i)) room.fireCannonFromShip(ship, i);
    }
}

module.exports = { updateAI, newBotName, newBotTitle };
