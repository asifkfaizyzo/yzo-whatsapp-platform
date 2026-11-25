
<!-- DEV_SETUP.md (do not remove this comment) -->
# SudoReply — Local Dev Setup & WhatsApp Testing

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 18+ | Use `node -v` to check |
| PostgreSQL | 18 | Local install, service: `postgresql-x64-18` |
| Redis | 7+ | Local install, default port 6379 |
| Cloudflared | Latest | [Download](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) |

> **Important:** Local dev runs with `node`/`nodemon` directly. Docker is only used on the VPS.

---

## 1. Environment Setup

Copy and configure `backend/.env`:

```env
# Core
PORT=5000
NODE_ENV=development
BASE_URL=http://localhost:5000

# Database (local PostgreSQL password is 1234)
DATABASE_URL="postgresql://postgres:1234@localhost:5432/whatsapp_platform"
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# WhatsApp — set to false for real Meta testing
MOCK_WHATSAPP=false
META_VERIFY_TOKEN=yzo_default_verification_token
META_PHONE_NUMBER_ID=<from Meta Dev Console>
WHATSAPP_TOKEN=<from Meta Dev Console>
```

### Key env vars to know:

| Variable | `true` | `false` |
|---|---|---|
| `MOCK_WHATSAPP` | Fake connection status, skips Meta API | Real Meta API calls for send/receive |

---

## 2. Start the Backend

```bash
cd backend
npm install          # first time only
npm run dev          # starts nodemon on port 5000
```

You should see:
```
🚀 Server is running on http://localhost:5000
⚡ Connected to Redis successfully
```

---

## 3. Start the Cloudflare Tunnel (for WhatsApp webhooks)

We use a **permanent Cloudflare tunnel** instead of ngrok. No URL changes needed.

```bash
cloudflared tunnel run sudoreply-dev
```

You should see 4 connections registered (bom/maa regions):
```
INF Registered tunnel connection connIndex=0 location=bom11 protocol=quic
INF Registered tunnel connection connIndex=1 location=maa01 protocol=quic
```

Your local backend is now accessible at: **`https://dev-api.sudoreply.com`**

### First-time tunnel setup (new machine only):

If the tunnel doesn't exist on your machine yet:

```bash
# 1. Authenticate with Cloudflare
cloudflared tunnel login

# 2. Create tunnel (one-time, already done for the team)
cloudflared tunnel create sudoreply-dev

# 3. Route DNS (one-time, already done)
cloudflared tunnel route dns sudoreply-dev dev-api.sudoreply.com

# 4. Create config file at ~/.cloudflared/config.yml:
tunnel: sudoreply-dev
credentials-file: C:\Users\<YOU>\.cloudflared\<TUNNEL_ID>.json
ingress:
  - hostname: dev-api.sudoreply.com
    service: http://localhost:5000
  - service: http_status:404
```

> Ask the team lead for the tunnel credentials JSON file if you don't have it.

---

## 4. Configure Meta Webhook (Dev App)

1. Go to [Meta Developer Console](https://developers.facebook.com/)
2. Select **Sudo Reply Dev** (App ID: `1574294074180447`)
3. Left sidebar → **WhatsApp** → **Configuration** → **Webhook** → **Edit**
4. Set:
   - **Callback URL:** `https://dev-api.sudoreply.com/sradmin/webhook/whatsapp`
   - **Verify token:** `yzo_default_verification_token`
5. Click **Verify and save**
6. Click **Manage** → subscribe to **`messages`**

> The webhook path is `/sradmin/webhook/whatsapp` — NOT `/api/` or `/tenant/`.

---

## 5. Test End-to-End

1. Ensure tunnel + backend are both running
2. In Meta Dev Console → **WhatsApp** → **API Setup**
3. Send a test message from the test number to your registered tester phone
4. Watch your backend terminal for the incoming webhook payload

---

## Troubleshooting

### ❌ `dev-api.sudoreply.com` — DNS not found

**Cause:** Your ISP (especially Jio, Airtel) aggressively caches old DNS records.

**Fix — change your DNS to Cloudflare/Google:**

**Windows (PowerShell Admin):**
```powershell
Set-DnsClientServerAddress -InterfaceAlias "Wi-Fi" -ServerAddresses ("1.1.1.1","8.8.8.8")
ipconfig /flushdns
```

**Windows (GUI):**
1. `Win + R` → `ncpa.cpl` → Enter
2. Right-click active connection → Properties
3. Double-click **IPv4** → Use the following DNS:
   - Preferred: `1.1.1.1`
   - Alternate: `8.8.8.8`
4. OK → Close → `ipconfig /flushdns`

**Mac:**
```bash
# Set DNS for Wi-Fi
networksetup -setdnsservers Wi-Fi 1.1.1.1 8.8.8.8
dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

**Linux:**
```bash
# Edit /etc/resolv.conf or use NetworkManager
sudo nmcli con mod "Wi-Fi" ipv4.dns "1.1.1.1 8.8.8.8"
sudo nmcli con up "Wi-Fi"
sudo systemd-resolve --flush-caches
```

**Verify it works:**
```bash
nslookup dev-api.sudoreply.com 8.8.8.8   # should return Cloudflare IPs
nslookup dev-api.sudoreply.com            # should also work now
```

---

### ❌ Tunnel connects but returns 502

- Is the backend running on port 5000? (`http://localhost:5000/` should respond)
- Check `~/.cloudflared/config.yml` — the `service` should be `http://localhost:5000`

---

### ❌ Meta webhook verification fails

- Verify the URL is exactly: `https://dev-api.sudoreply.com/sradmin/webhook/whatsapp`
- Verify token matches `META_VERIFY_TOKEN` in your `.env`
- Test manually:
  ```
  https://dev-api.sudoreply.com/sradmin/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=yzo_default_verification_token&hub.challenge=TEST123
  ```
  Should return `TEST123` with status 200.

---

### ❌ Backend won't start — PostgreSQL P1000 auth error

**Cause:** `.env` password doesn't match your local PostgreSQL password.

**Fix:**
```env
DATABASE_URL="postgresql://postgres:1234@localhost:5432/whatsapp_platform"
```

If the database doesn't exist yet:
```bash
psql -U postgres -c "CREATE DATABASE whatsapp_platform;"
cd backend && npx prisma migrate deploy
```

---

### ❌ Backend won't start — Redis connection refused

Start Redis locally:
- **Windows:** `redis-server` (or start the Redis service)
- **Mac:** `brew services start redis`
- **Linux:** `sudo systemctl start redis`

---

### ❌ `MOCK_WHATSAPP=true` but I want real messages

Set `MOCK_WHATSAPP=false` in `.env` and restart the backend. Ensure `META_PHONE_NUMBER_ID` and `WHATSAPP_TOKEN` are set with real Dev app credentials.

---

## Quick Reference

| What | Command / URL |
|---|---|
| Start backend | `cd backend && npm run dev` |
| Start tunnel | `cloudflared tunnel run sudoreply-dev` |
| Local API | `http://localhost:5000` |
| Tunnel URL | `https://dev-api.sudoreply.com` |
| Webhook path | `/sradmin/webhook/whatsapp` |
| Dev Meta App | Sudo Reply Dev (1574294074180447) |
| Live Meta App | Sudo Reply (1510944094144775) |
| VPS IP | `72.61.241.109` |
| VPS deploy | SSH → `cd /var/www/SudoReply` → `git pull` → `docker compose up -d --build` |
