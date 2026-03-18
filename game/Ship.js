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
        this.score       = 0;
        this.hasFlag     = false;
        this.reloadTimes = new Array(14).fill(0);
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

    takeDamage(dmg) {
        if (this.isDead || this.isSinking) return false;
        this.hp -= dmg;
        if (this.hp <= 0 && !this.isSinking) {
            this.hp = 0;
            this.isSinking = true;
            this.hasFlag = false;
            return true;
        }
        return false;
    }

    canFireCannon(idx) {
        return (Date.now() - (this.reloadTimes[idx] || 0)) >= 2500;
    }

    fireCannonDir(idx) {
        const spec = C.SHIP_TYPES[this.shipType];
        const half = Math.floor(spec.cannonCount / 2);
        const isPort = idx >= 1 && idx <= half;
        const isStbd = idx > half && idx > 0;
        let localX = 1, localZ = 0;
        if (isPort) { localX = 0; localZ = -1; }
        else if (isStbd) { localX = 0; localZ = 1; }
        const cos = Math.cos(this.ry);
        const sin = Math.sin(this.ry);
        return {
            x: localX * cos - localZ * sin,
            z: localX * sin + localZ * cos,
        };
    }

    serialize() {
        return {
            id: this.id, name: this.displayName,
            shipType: this.shipType, sailColour: this.sailColour, hullColour: this.hullColour,
            team: this.team, isBot: this.isBot, isCapital: this.isCapital,
            x: this.x, y: this.y, z: this.z, ry: this.ry, vel: this.vel,
            hp: this.hp, maxHp: this.maxHp,
            isSinking: this.isSinking, isDead: this.isDead,
            killCount: this.killCount, score: this.score, hasFlag: this.hasFlag,
        };
    }
}

module.exports = Ship;
