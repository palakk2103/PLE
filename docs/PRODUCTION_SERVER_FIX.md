# Production Server Remediation Guide (Fixing 502 Bad Gateway)

This guide provides the exact steps to restore the backend Node.js server on the production VPS (`187.127.159.231`) and resolve the **Network Error (502 Bad Gateway)** on `https://peoplesleagueofelectronics.com` and `https://plebusiness.com`.

---

## Step 1: Whitelist VPS IP on MongoDB Atlas (Crucial)

The backend server crashes on boot if it cannot connect to MongoDB Atlas.

1. Open your browser and go to [MongoDB Cloud Console](https://cloud.mongodb.com).
2. Select your project and cluster (`cluster0`).
3. Under **Security** in the left sidebar, click **Network Access**.
4. Click the **+ Add IP Address** button:
   - **Option A (Specific VPS IP - Recommended)**: Enter `187.127.159.231/32` with description `PLE Hostinger VPS`.
   - **Option B (Allow from Anywhere - Fallback)**: Click `ALLOW ACCESS FROM ANYWHERE` (`0.0.0.0/0`).
5. Click **Confirm** and wait 1–2 minutes for the status to turn green (**Active**).

---

## Step 2: SSH into the Production VPS

Open your terminal or PowerShell and SSH into the Hostinger VPS:

```bash
ssh root@187.127.159.231
# Or your specific SSH user/key configured on Hostinger
```

---

## Step 3: Check Process Status & Logs (PM2)

Check if the backend Node process is running or crashed:

```bash
pm2 status
```

You will likely see the process in an `errored` or `stopped` state.

To see the exact crash stack trace, run:

```bash
pm2 logs --lines 100
```

Common issues reported in logs:
- `MongoServerSelectionError: connection timed out` -> VPS IP not whitelisted in MongoDB Atlas (follow Step 1).
- `Missing required environment variables` -> Check `.env` in the backend root directory (follow Step 4).
- `Port 5000 already in use` -> A rogue Node process is hanging on port 5000 (run `lsof -i :5000` or `fuser -k 5000/tcp`).

---

## Step 4: Verify Backend Environment Variables

Navigate to your backend directory on the VPS (typically `/var/www/ple/backend` or `/home/.../PLE/backend`):

```bash
cd /var/www/PLE/backend # (or your path)
cat .env
```

Ensure the following variables are present and non-empty:

```ini
NODE_ENV=production
PORT=5000
CLIENT_URL=https://peoplesleagueofelectronics.com
MONGO_URI=mongodb+srv://palakpatel0342_db_user:U7wRhwijjNX4bboR@cluster0.h0adnwu.mongodb.net/?appName=Cluster0
JWT_SECRET=your_access_secret_change_this_in_production
JWT_REFRESH_SECRET=your_refresh_secret_change_this_in_production
CLOUDINARY_CLOUD_NAME=aewq5rta
CLOUDINARY_API_KEY=178432623393627
CLOUDINARY_API_SECRET=TxgLZlmbV9DXCkiFcZlDgczasiU
```

---

## Step 5: Test Node Process Manually & Restart with PM2

Before restarting in PM2, test running the server directly to ensure it boots without errors:

```bash
cd /var/www/PLE/backend # (or your path)
node src/server.js
```

You should see:
```
Environment variables validated successfully
MongoDB Connected: cluster0-shard-00-...
Server running on http://localhost:5000
Server running in production mode on port 5000
```

Once verified, press `Ctrl + C`, and restart via PM2:

```bash
# If process is already registered in PM2:
pm2 restart all --update-env

# Or start fresh if not registered:
pm2 start src/server.js --name ple-backend --update-env

# Save the PM2 process list so it restarts after server reboots:
pm2 save
```

---

## Step 6: Verify Nginx Configuration

Ensure Nginx has the proper reverse proxy block for `/api` and `/socket.io`:

```bash
sudo nano /etc/nginx/sites-available/default
# Or /etc/nginx/conf.d/ple.conf
```

The server block for port 443 should contain:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:5000/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}

location /socket.io/ {
    proxy_pass http://127.0.0.1:5000/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Test and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 7: Final Verification

From your local computer, verify that the endpoints are now healthy:

```bash
curl.exe -i "https://peoplesleagueofelectronics.com/health"
curl.exe -i "https://peoplesleagueofelectronics.com/api/products"
```

Both should return **`HTTP/1.1 200 OK`**. Then open `https://peoplesleagueofelectronics.com/login` and test logging in.
