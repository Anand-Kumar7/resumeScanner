# Deployment Guide - Resume Scanner

## Prerequisites
- Backend: MySQL database (PlanetScale, AWS RDS, or similar)
- Frontend: Vercel account
- Backend: Render account
- Gemini API key

---

## Step 1: Set Up Backend Database (Render)

### Option A: Using PlanetScale (Free MySQL Database)
1. Go to [PlanetScale.com](https://planetscale.com)
2. Create an account and a new MySQL database
3. Copy connection credentials (host, user, password)

### Option B: AWS RDS / DigitalOcean Databases
- AWS RDS: Create MySQL instance
- DigitalOcean: Create Managed Database

---

## Step 2: Deploy Backend to Render

1. **Push code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo>
   git push -u origin main
   ```

2. **Go to [Render.com](https://render.com)**
   - Sign up/login
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `backend` folder as root directory

3. **Set Environment Variables in Render Dashboard:**
   ```
   PORT=5000
   DB_HOST=<your-planetscale-host>
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
   - Copy your Render backend URL: `https://resume-scanner-api.onrender.com`

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
   - Key: `VITE_API_URL`
   - Value: `https://resume-scanner-api.onrender.com` (your Render backend URL)

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
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
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

### Backend not connecting to database
- Check MySQL host is accessible from Render
- Verify credentials in environment variables
- Check firewall/security group rules

### Frontend calls failing
- Verify `VITE_API_URL` environment variable is set
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
