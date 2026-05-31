# Deployment Guide - Resume Scanner

## Prerequisites
- Backend: MySQL database (PlanetScale, AWS RDS, or similar)
- Frontend: Vercel account
- Backend: Render account
- Gemini API key

---

## Step 1: Set Up Backend Database (Render)

### Your Setup: Railway MySQL + Render Backend
**See [RAILWAY_TO_RENDER_SETUP.md](RAILWAY_TO_RENDER_SETUP.md) for step-by-step instructions.**

Quick summary:
1. Get `DATABASE_URL` from Railway.app → MySQL service → Connect tab
2. Set in Render → Settings → Environment Variables
3. Redeploy and check logs

### Option A: Using Railway (MySQL Database)
1. Go to [Railway.app](https://railway.app)
2. Create account and project
3. Click "Add Service" → Select "MySQL"
4. Railway will provision a MySQL database
5. Copy the `MySQL_URL` from the Railway dashboard
   - Click on MySQL service
   - Go to "Connect" tab
   - Copy the full MySQL connection string (starts with `mysql://`)

### Option B: Using PlanetScale (Free MySQL Database)
1. Go to [PlanetScale.com](https://planetscale.com)
2. Create an account and a new MySQL database
3. Copy connection credentials (host, user, password)

### Option C: AWS RDS / DigitalOcean Databases
- AWS RDS: Create MySQL instance
- DigitalOcean: Create Managed Database

---

## Step 2: Deploy Backend to Render

1. **Push code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   # If origin already exists, update it instead of adding it again:
   git remote set-url origin <your-github-repo>
   # Or remove and re-add if you prefer:
   # git remote remove origin
   # git remote add origin <your-github-repo>
   git push -u origin main
   ```

2. **Go to [Render.com](https://render.com)**
   - Sign up/login
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `backend` folder as root directory

3. **Set Environment Variables in Render Dashboard:**
   - Go to your Render service → Settings → Environment Variables
   - Choose one option below:

   **If using Railway (Recommended):**
   ```
   DATABASE_URL=<copy from Railway MySQL_URL>
   PORT=5000
   GEMINI_API_KEY=<your-gemini-key>
   ALLOWED_ORIGIN=https://<your-vercel-domain>.vercel.app
   NODE_ENV=production
   ```
   
   If you prefer Railway service variables instead of `DATABASE_URL`, you can also set:
   ```
   MYSQL_HOST=<Railway host>
   MYSQL_USER=<Railway user>
   MYSQL_PASSWORD=<Railway password>
   MYSQL_PORT=<Railway port>
   MYSQL_DATABASE=<Railway database>
   ```
   
   **If using PlanetScale with connection string:**
   ```
   DATABASE_URL=mysql://<user>:<password>@<host>:3306/<database>
   PORT=5000
   GEMINI_API_KEY=<your-gemini-key>
   ALLOWED_ORIGIN=https://<your-vercel-domain>.vercel.app
   NODE_ENV=production
   ```

   **If using individual environment variables:**
   ```
   PORT=5000
   DB_HOST=<your-database-host>
   DB_PORT=3306
   DB_USER=<your-db-user>
   DB_PASSWORD=<your-db-password>
   DB_NAME=resume_screening
   GEMINI_API_KEY=<your-gemini-key>
   ALLOWED_ORIGIN=https://<your-vercel-domain>.vercel.app
   NODE_ENV=production
   ```

4. **Deploy**
   - Render will auto-deploy on push to main
   - Copy your Render backend URL: `https://resumescanner-p0gu.onrender.com`

---

## Step 3: Deploy Frontend to Vercel

1. **Connect GitHub to Vercel**
   - Go to [Vercel.com](https://vercel.com)
   - Click "Add New" → "Project"
   - Import your GitHub repository

2. **Configure Build Settings:**
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

3. **Add Environment Variable:**
   - Go to Settings → Environment Variables
   - Key: `VITE_API_BASE_URL`
   - Value: `https://resume-scanner-api.onrender.com/api` (your Render backend URL)
   
   > Note: the app also supports `VITE_API_URL` for backward compatibility.

4. **Deploy**
   - Vercel auto-deploys on push to main
   - Copy your Vercel frontend URL: `https://resume-scanner.vercel.app`

---

## Step 4: Update CORS Settings

1. Go to your Render dashboard
2. Update `ALLOWED_ORIGIN` environment variable:
   ```
   https://your-vercel-domain.vercel.app
   ```

---

## Step 5: Update Frontend API URL

Update [frontend/src/main.jsx](frontend/src/main.jsx) or create a config file:

```javascript
const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'https://resumescanner-p0gu.onrender.com/api';
```

---

## Database Setup on First Deployment

When backend starts on Render, it will:
1. Auto-create the `resume_screening` database (if MySQL is accessible)
2. Auto-create required tables
3. Fall back to `db.json` if MySQL fails

**Ensure your MySQL host allows connections from Render's IP addresses.**

---

## Security Checklist

- [x] API key stored in environment variables (not in code)
- [x] `.env` added to `.gitignore`
- [x] CORS restricted to production domain
- [x] Rate limiting enabled
- [ ] Enable HTTPS (Render/Vercel handle this)
- [ ] Use strong database password
- [ ] Set `NODE_ENV=production`

---

## Troubleshooting

### MySQL Database Offline After Deployment
If your application is falling back to db.json (local file database) after deployment:

**Step 1: Check Render Logs**
1. Go to Render dashboard → Your service → Logs
2. Look for messages like:
   - ✓ "Connected to MySQL database" = Success
   - ⚠ "MySQL database connection failed" = Connection issue

**Step 2: Verify Environment Variables (Railway Users)**
1. Go to Render → Settings → Environment Variables
2. Ensure `DATABASE_URL` is set with your Railway connection string:
   ```
   DATABASE_URL=mysql://user:password@host:port/database
   ```
3. To get your Railway URL:
   - Go to Railway.app → Your Project → MySQL service
   - Click "Connect" tab → Copy "MySQL_URL"
   - Should look like: `mysql://root:password@containers.railway.app:1234/railway`

**Step 3: Verify Environment Variables (Traditional Setup)**
1. Go to Render → Settings → Environment Variables
2. Ensure these are set:
   ```
   DB_HOST=<your-database-host>
   DB_USER=<your-username>
   DB_PASSWORD=<your-password>
   DB_PORT=3306
   DB_NAME=resume_screening
   ```

**Step 4: Check Database Credentials**
- Verify username/password with your database provider
- For Railway: Check the credentials in Railway dashboard
- Test connection locally first:
  ```bash
  mysql -h <host> -u <user> -p
  ```

**Step 5: Check Network Access**
- Railway: Database should be accessible from anywhere (default)
- AWS RDS: Add Render's IP to security group inbound rules
- DigitalOcean: Add Render's IP to firewall
- PlanetScale: Should work globally

**Step 6: Redeploy**
1. Make a small change and commit: `git commit --allow-empty -m "Redeploy"`
2. Push to trigger redeployment: `git push origin main`
3. Check logs again for ✓ "Connected to MySQL database"

### Backend not connecting to database
- Check MySQL host is accessible from Render
- Verify credentials in environment variables
- Check firewall/security group rules
- Ensure SSL requirements are met for cloud databases

### Frontend calls failing
- Verify `VITE_API_BASE_URL` environment variable is set
- If you used `VITE_API_URL`, that is also supported for backward compatibility
- Check CORS `ALLOWED_ORIGIN` matches frontend URL
- Check browser console for CORS errors

### Uploads not working
- Render's `/uploads` directory is temporary and resets on deploy
- **Solution:** Use S3 or similar cloud storage for file uploads (future enhancement)

---

## Costs

| Service | Free Tier | Notes |
|---------|-----------|-------|
| Render | $7/month | Auto-sleep after 15 min inactivity |
| Vercel | Free | ~100GB/month bandwidth |
| PlanetScale | Free | 5GB storage |
| Gemini API | Free tier | ~60 requests/minute |

---

## Next Steps

1. Create `.env` file with production values
2. Push code to GitHub
3. Follow deployment steps above
4. Test file uploads and scoring
5. Monitor logs on Render/Vercel dashboards

For questions, see [Render Docs](https://render.com/docs) or [Vercel Docs](https://vercel.com/docs)
