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
