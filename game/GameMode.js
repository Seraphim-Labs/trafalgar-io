'use strict';
const C = require('./constants');

class GameMode {
    constructor(modeName) {
        this.mode = modeName;
        this.flags = null;
        this.capitalShipId = null;
    }

    initCTF() {
        this.flags = {
            red:  { x:  600, z: 0, carrier: null, atBase: true, team: 'red'  },
            blue: { x: -600, z: 0, carrier: null, atBase: true, team: 'blue' },
        };
    }

    update(ships, events) {
        if (this.mode === 'ctf') this._tickCTF(ships, events);
    }

    _tickCTF(ships, events) {
        // Update carrier positions / detect drops
        for (const flag of Object.values(this.flags)) {
            if (flag.carrier) {
                const carrier = ships.find(s => s.id === flag.carrier);
                if (!carrier || carrier.isSinking || carrier.isDead) {
                    if (carrier) { flag.x = carrier.x; flag.z = carrier.z; }
                    flag.carrier = null;
                    flag.atBase  = false;
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
                    const fl = this.flags[enemyTeam];
                    fl.carrier = null; fl.atBase = true;
                    fl.x = enemyTeam === 'red' ? 600 : -600; fl.z = 0;
                    events.push({ type: 'capture', player: ship.displayName, team: ship.team });
                }
            }

            // Return own flag (friendly ship walks over dropped own flag)
            if (!ownFlag.atBase && !ownFlag.carrier && ship.team === ownFlag.team) {
                const dx = ship.x - ownFlag.x, dz = ship.z - ownFlag.z;
                if (Math.sqrt(dx*dx+dz*dz) < C.CTF_FLAG_CAPTURE_R) {
                    ownFlag.atBase = true;
                    ownFlag.x = ship.team === 'red' ? 600 : -600; ownFlag.z = 0;
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
            const best = ships.reduce((a, s) => s.killCount > (a?.killCount||0) ? s : a, null);
            return best ? best.displayName + ' wins!' : 'No winner';
        }
        if (this.mode === 'ctf') {
            const red  = ships.filter(s=>s.team==='red').reduce((a,s)=>a+s.score,0);
            const blue = ships.filter(s=>s.team==='blue').reduce((a,s)=>a+s.score,0);
            if (red  > blue) return 'Red Fleet wins!';
            if (blue > red)  return 'Blue Fleet wins!';
            return 'Draw!';
        }
        if (this.mode === 'capital') {
            const cap = ships.find(s=>s.isCapital);
            if (!cap || cap.isDead) return 'Attackers win — flagship sunk!';
            return 'Defenders win — flagship survived!';
        }
        return 'Draw!';
    }

    serializeFlags() {
        if (!this.flags) return null;
        return {
            red:  { x:this.flags.red.x,  z:this.flags.red.z,  carrier:this.flags.red.carrier,  atBase:this.flags.red.atBase  },
            blue: { x:this.flags.blue.x, z:this.flags.blue.z, carrier:this.flags.blue.carrier, atBase:this.flags.blue.atBase },
        };
    }
}

module.exports = GameMode;
