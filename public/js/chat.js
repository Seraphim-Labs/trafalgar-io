window.Chat = (function() {
    const messages = [];
    function escHtml(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    function receive(msg) {
        messages.push(msg);
        if (messages.length > 30) messages.shift();
        render();
    }
    function render() {
        const el = document.getElementById('chat-messages');
        if (!el) return;
        el.innerHTML = messages.slice(-8).map(m =>
            '<div><span style="color:#aabbcc">' + escHtml(m.name) + ':</span> <span>' + escHtml(m.text) + '</span></div>'
        ).join('');
    }
    function focus() {
        const row = document.getElementById('chat-input-row');
        const input = document.getElementById('chat-input');
        if (!row || !input) return;
        row.style.display = 'flex';
        input.focus();
        input.addEventListener('keydown', function h(e) {
            if (e.key === 'Enter') { send(); input.removeEventListener('keydown', h); }
            if (e.key === 'Escape') { blur(); input.removeEventListener('keydown', h); }
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
        if (window._gameSocket) window._gameSocket.emit('chat', { text: input.value.trim() });
        blur();
    }
    return { receive, render, focus, blur, send };
})();
