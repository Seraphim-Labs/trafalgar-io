# Trafalgar.io

Multiplayer naval battle IO game. 3 game modes, 3 ship types, chat, clans, AI bots.

**Frontend (Netlify):** https://chic-mousse-f1bb43.netlify.app
**Backend (Render):** deploy from GitHub below — no credit card needed

---

## Deploy the Backend (only step needed — no credit card)

1. Go to **render.com** → sign up free (no credit card)
2. New → **Web Service** → connect GitHub → select **trafalgar-io**
3. Settings auto-fill from `render.yaml` → click **Deploy**
4. Done — your game URL is `https://trafalgar-io.onrender.com`

**No cold starts:** The server pings itself every 10 minutes automatically.
It will never sleep, even on the free tier.

---

## Local Dev

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

## Getting Players
- Share on Discord browser-game servers
- Post on r/WebGames
- Add to itch.io as a free HTML game
