window.Clans = (function() {
    const KEY = 'tio_clan';
    function getTag() { return (localStorage.getItem(KEY) || '').slice(0,4).toUpperCase(); }
    function apply() {
        const input = document.getElementById('clanTagInput');
        if (!input) return;
        const tag = input.value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);
        if (tag.length < 2) { setStatus('Tag must be 2-4 letters/numbers'); return; }
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
    (function init() {
        const tag = getTag();
        const input = document.getElementById('clanTagInput');
        if (input && tag) input.value = tag;
        if (tag) setStatus('[' + tag + '] active');
    })();
    return { getTag, apply, leave };
})();
