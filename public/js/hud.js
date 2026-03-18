window.updateHUD = function(state, myShipId) {
    if (!state || !myShipId) return;
    const me = state.ships.find(function(s) { return s.id === myShipId; });
    if (!me) return;

    const bar = document.getElementById('hud-hp-bar');
    if (bar) {
        const r = Math.max(0, me.hp / me.maxHp);
        bar.style.width = (r * 100) + '%';
        bar.style.backgroundColor = r > 0.5 ? '#52ff52' : r > 0.25 ? '#ffaa00' : '#ff3333';
    }

    const nameEl = document.getElementById('ship-name-display');
    if (nameEl) nameEl.textContent = me.name;

    const st = document.getElementById('ship-status');
    if (st) {
        const r = me.hp / me.maxHp;
        const col = r > 0.5 ? '#52ff52' : r > 0.25 ? '#ffaa00' : '#ff3333';
        st.innerHTML = '<span style="color:' + col + '">HULL: ' + Math.ceil(r * 100) + '%</span>' +
            (me.isSinking ? ' <span style="color:#ff3333">SINKING</span>' : '') +
            ' | <span style="color:#888">KILLS: ' + me.killCount + '</span>' +
            ' | <span style="color:' + (me.team === 'red' ? '#ff7777' : '#7799ff') + '">' + me.team.toUpperCase() + '</span>' +
            (me.hasFlag ? ' <span style="color:#ffd700">\uD83D\uDEA9 HAS FLAG</span>' : '');
    }

    const timerEl = document.getElementById('hud-timer');
    if (timerEl) {
        const t = Math.max(0, state.timeLeft);
        const m = Math.floor(t / 60), s = Math.floor(t % 60);
        timerEl.textContent = m + ':' + String(s).padStart(2, '0');
    }

    const modeEl = document.getElementById('hud-mode-label');
    if (modeEl) {
        const labels = { dm: 'DEATHMATCH', ctf: 'CAPTURE THE FLAG', capital: 'SINK THE CAPITAL SHIP' };
        modeEl.textContent = labels[state.mode] || state.mode.toUpperCase();
    }

    const red  = state.ships.filter(function(s) { return s.team === 'red'  && !s.isSinking && !s.isDead; }).length;
    const blue = state.ships.filter(function(s) { return s.team === 'blue' && !s.isSinking && !s.isDead; }).length;
    const ais = document.getElementById('ai-status');
    if (ais) ais.innerHTML = '<span style="color:#ff7777">RED: ' + red + '</span> | <span style="color:#7799ff">BLUE: ' + blue + '</span>';

    const hdg = document.getElementById('hud-heading');
    if (hdg && me.ry !== undefined) {
        const deg = Math.round(((-me.ry * 180 / Math.PI) % 360 + 360) % 360);
        const cards = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
        const card = cards[Math.round(deg / 22.5) % 16];
        hdg.innerHTML = '<span style="color:#888">HDG</span> <span style="color:#ffd700">' + String(deg).padStart(3, '0') + '\u00b0</span> ' + card;
    }

    const windEl = document.getElementById('hud-wind');
    if (windEl) {
        windEl.innerHTML = '<span style="color:#888">WIND</span> ESE <span style="color:#444">\u2591\u2591\u2591\u2591</span>';
    }

    const tgtEl = document.getElementById('hud-target');
    if (tgtEl) {
        const enemies = state.ships.filter(function(s) { return s.team !== me.team && !s.isSinking && !s.isDead; });
        if (!enemies.length) {
            tgtEl.innerHTML = '<span style="color:#334">NO CONTACTS</span>';
        } else {
            enemies.sort(function(a, b) {
                return ((a.x - me.x) ** 2 + (a.z - me.z) ** 2) - ((b.x - me.x) ** 2 + (b.z - me.z) ** 2);
            });
            const t = enemies[0];
            const dist = Math.round(Math.sqrt((t.x - me.x) ** 2 + (t.z - me.z) ** 2));
            const tr = Math.max(0, t.hp / t.maxHp);
            const tb = Math.round(tr * 10);
            tgtEl.innerHTML = '<span style="color:#ff7777">' + t.name + '</span><br>' +
                '<span style="color:#666">RANGE</span> ' + dist + 'm<br>' +
                '<span style="color:#ff5252">' + '\u2588'.repeat(tb) + '</span>' +
                '<span style="color:#333">' + '\u2588'.repeat(10 - tb) + '</span>';
        }
    }
};
