// Auto-detects the right backend.
window.TRAFALGAR_SERVER =
    window.location.hostname === 'localhost'
        ? 'http://localhost:3001'
        : window.location.hostname.includes('onrender.com')
            ? window.location.origin
            : 'https://trafalgar-io.onrender.com';
