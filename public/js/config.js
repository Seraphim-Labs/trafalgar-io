// Auto-detects backend.
// On Render: uses same origin (server serves frontend too).
// Locally: uses localhost:3001.
window.TRAFALGAR_SERVER = window.location.origin;
