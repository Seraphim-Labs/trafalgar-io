# Trafalgar.io

Multiplayer naval battle IO game. 3 game modes, 3 ship types, chat, clans, AI bots.

**Frontend (Netlify):** https://chic-mousse-f1bb43.netlify.app
**Backend:** deploy below — no credit card needed

---

## ▶ Deploy the backend (one click, no credit card)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Seraphim-Labs/trafalgar-io)

1. Click the button above
2. Sign up to Render (free, no credit card)
3. Click **Apply** — done

The server names itself `trafalgar-io` and runs at `https://trafalgar-io.onrender.com`.
**It never sleeps** — a built-in self-ping fires every 10 minutes to keep it awake.

The Netlify frontend already points to that URL. The moment Render finishes deploying, the game is live.

---

## Local dev

```bash
npm install
node server.js
# open http://localhost:3001
```

---

## Controls

| Key | Action |
|-----|--------|
| W / S | Accelerate / Brake |
| A / D | Turn |
| R | Port broadside |
| T | Starboard broadside |
| 1–7 | Individual cannons |
| TAB | Scoreboard |
| Enter | Chat |
| Q / E | Orbit camera |
| Z / X | Zoom |
