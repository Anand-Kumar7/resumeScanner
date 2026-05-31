# Railway MySQL → Render Environment Setup

## Step 1: Get Railway MySQL Credentials

1. Go to [Railway.app](https://railway.app)
2. Open your Project → MySQL service
3. Click the "Connect" tab
4. Copy the **MySQL_URL** (looks like: `mysql://root:password@containers.railway.app:1234/railway`)

Or, get individual values:
- Scroll down and copy each value:
  - `MYSQL_HOST` (e.g., `containers.railway.app`)
  - `MYSQL_PORT` (e.g., `1234`)
  - `MYSQL_USER` (e.g., `root`)
  - `MYSQL_PASSWORD` (long random string)
  - `MYSQL_DATABASE` (e.g., `railway`)

## Step 2: Set in Render Dashboard

### Option A: Using Full Connection String (Recommended)
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select your "resume-scanner-backend" service
3. Go to **Settings** → **Environment Variables**
4. Click **Add Environment Variable**
5. Set:
   ```
   DATABASE_URL = mysql://root:PASSWORD@containers.railway.app:PORT/railway
   ```
   (Replace PASSWORD and PORT with your actual values)
6. Click **Save**

### Option B: Using Individual Variables
1. Go to **Settings** → **Environment Variables**
2. Add these variables:
   ```
   MYSQL_HOST = containers.railway.app
   MYSQL_PORT = 1234
   MYSQL_USER = root
   MYSQL_PASSWORD = your_password_here
   MYSQL_DATABASE = railway
   ```
3. Click **Save** after each one

## Step 3: Trigger Redeployment

1. Go to **Deployments** tab
2. Click the three dots on the latest deployment → **Redeploy**
3. Or push a new commit to GitHub:
   ```bash
   git commit --allow-empty -m "Redeploy with Railway DB env vars"
   git push origin main
   ```

## Step 4: Verify in Logs

1. Go to **Logs** tab
2. Look for:
   - `Database environment sources detected: ...`
   - `Attempting to connect to MySQL database...`
   - `✓ Connected to MySQL database: railway`

If you see these, it's working!

## Troubleshooting

If it still shows `localhost`:
- Check Render env vars are saved (refresh the page)
- Make sure you set `DATABASE_URL` or `MYSQL_*` variables
- Redeploy after setting variables
- Check logs for exact error message

If connection fails:
- Verify Railway credentials are correct (copy-paste carefully)
- Check Render logs for the exact error
- Ensure Railway database is running
