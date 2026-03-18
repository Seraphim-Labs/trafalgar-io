# Trafalgar.io

Multiplayer naval battle IO game. 3 game modes, 3 ship types, chat, clans, AI bots.

**Frontend:** Netlify — https://chic-mousse-f1bb43.netlify.app
**Backend:** Fly.io — https://trafalgar-io.fly.dev

---

## Deploy the Backend (the only step you need to do)

Install the Fly CLI once:
```
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

Then from the `trafalgar-io` folder:
```
flyctl auth login
flyctl deploy
```

That's it. The game is live. No config to edit — everything points to `trafalgar-io.fly.dev` automatically.

**Why Fly.io?**
- No cold starts (always running)
- Free tier: 3 VMs, 160 GB bandwidth/month
- Much faster than Render free

---

## Local Dev

```bash
npm install
node server.js
# open http://localhost:3001
```

For local dev, set `window.TRAFALGAR_SERVER = 'http://localhost:3001'` in `public/js/config.js`.

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
- Post on r/WebGames with a clip
- Add to itch.io as a free HTML game
