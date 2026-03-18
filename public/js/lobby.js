(function() {
    var saved = JSON.parse(localStorage.getItem('tio_prefs') || '{}');
    document.getElementById('captainName').value  = saved.name  || '';
    document.getElementById('captainTitle').value = saved.title || 'Captain';

    var selectedShip     = saved.shipType    || 'frigate';
    var selectedSail     = saved.sailColour  || '#f5f0e0';
    var selectedHull     = saved.hullColour  || '#5D4037';
    var selectedMode     = saved.mode        || 'dm';
    var selectedDuration = saved.duration    || '5m';

    document.querySelectorAll('.ship-option').forEach(function(el) {
        if (el.dataset.type === selectedShip) el.classList.add('selected');
        else el.classList.remove('selected');
        el.addEventListener('click', function() {
            document.querySelectorAll('.ship-option').forEach(function(e) { e.classList.remove('selected'); });
            el.classList.add('selected');
            selectedShip = el.dataset.type;
        });
    });

    var SAIL_COLOURS = [
        ['Ivory','#f5f0e0'],['Crimson','#cc2222'],['Ocean','#2255aa'],
        ['Midnight','#1a1a3a'],['Gold','#d4a017'],['Forest','#2a5e2a'],
        ['Obsidian','#222222'],['Blood','#8b0000']
    ];
    var sailEl = document.getElementById('sailColours');
    SAIL_COLOURS.forEach(function(nc) {
        var sw = document.createElement('div');
        sw.className = 'swatch' + (nc[1] === selectedSail ? ' selected' : '');
        sw.style.background = nc[1]; sw.title = nc[0];
        sw.addEventListener('click', function() {
            document.querySelectorAll('#sailColours .swatch').forEach(function(s) { s.classList.remove('selected'); });
            sw.classList.add('selected'); selectedSail = nc[1];
        });
        sailEl.appendChild(sw);
    });

    var HULL_COLOURS = [['Oak','#5D4037'],['Ebony','#2c1a0e'],['Coral','#a05020'],['Slate','#445566']];
    var hullEl = document.getElementById('hullColours');
    HULL_COLOURS.forEach(function(nc) {
        var sw = document.createElement('div');
        sw.className = 'swatch' + (nc[1] === selectedHull ? ' selected' : '');
        sw.style.background = nc[1]; sw.title = nc[0];
        sw.addEventListener('click', function() {
            document.querySelectorAll('#hullColours .swatch').forEach(function(s) { s.classList.remove('selected'); });
            sw.classList.add('selected'); selectedHull = nc[1];
        });
        hullEl.appendChild(sw);
    });

    document.querySelectorAll('.mode-option').forEach(function(el) {
        if (el.dataset.mode === selectedMode) el.classList.add('selected');
        else el.classList.remove('selected');
        el.addEventListener('click', function() {
            document.querySelectorAll('.mode-option').forEach(function(e) { e.classList.remove('selected'); });
            el.classList.add('selected'); selectedMode = el.dataset.mode;
        });
    });

    document.querySelectorAll('.dur-option').forEach(function(el) {
        if (el.dataset.dur === selectedDuration) el.classList.add('selected');
        else el.classList.remove('selected');
        el.addEventListener('click', function() {
            document.querySelectorAll('.dur-option').forEach(function(e) { e.classList.remove('selected'); });
            el.classList.add('selected'); selectedDuration = el.dataset.dur;
        });
    });

    window.refreshRooms = function() {
        fetch(window.TRAFALGAR_SERVER + '/api/rooms')
            .then(function(r) { return r.json(); })
            .then(function(rooms) {
                var el = document.getElementById('roomList');
                if (!rooms.length) { el.innerHTML = '<div style="color:#445;font-size:0.8em">No open matches \u2014 you\'ll start a new one</div>'; return; }
                el.innerHTML = rooms.map(function(r) {
                    var modeLbl = { dm: 'Deathmatch', ctf: 'CTF', capital: 'Capital Ship' }[r.mode] || r.mode;
                    return '<div class="room-row"><span style="color:#ffd700">' + modeLbl + '</span><span>' + r.players + '/' + r.max + ' players</span><span>' + Math.floor(r.timeLeft / 60) + 'm left</span><button class="btn-small" style="pointer-events:auto" onclick="joinSpecific(\'' + r.id + '\')">JOIN</button></div>';
                }).join('');
            }).catch(function() {
                document.getElementById('roomList').innerHTML = '<div style="color:#554;font-size:0.8em">Could not reach server \u2014 check config.js</div>';
            });
    };
    refreshRooms();
    setInterval(refreshRooms, 10000);

    window.joinGame = function(specificRoomId) {
        var name = document.getElementById('captainName').value.trim();
        if (!name) { document.getElementById('lobbyError').textContent = 'Enter your captain name first.'; return; }
        var prefs = {
            name: name,
            title: document.getElementById('captainTitle').value,
            shipType: selectedShip, sailColour: selectedSail, hullColour: selectedHull,
            mode: selectedMode, duration: selectedDuration,
            clanTag: Clans.getTag(),
        };
        localStorage.setItem('tio_prefs', JSON.stringify(prefs));
        var params = new URLSearchParams(prefs);
        if (specificRoomId) params.set('roomId', specificRoomId);
        window.location.href = 'game.html?' + params.toString();
    };
    window.joinSpecific = function(roomId) { window.joinGame(roomId); };
})();
