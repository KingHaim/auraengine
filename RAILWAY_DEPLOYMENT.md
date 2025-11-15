# Railway Deployment Guide - AuraEngine

This project requires **TWO** Railway services:
1. **API Service** (Backend - FastAPI)
2. **Web Service** (Frontend - Next.js)

## 🚂 Service 1: API (Backend)

### Configuration
- **Service Name**: `auraengine-api`
- **Root Directory**: `apps/api`
- **Dockerfile Path**: `apps/api/Dockerfile`
- **Start Command**: `uvicorn main_simple:app --host 0.0.0.0 --port $PORT`
- **Health Check Path**: `/health`

### Environment Variables
```env
# Required
DATABASE_URL=postgresql://...
REPLICATE_API_TOKEN=your_token
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
JWT_SECRET=your_jwt_secret

# CORS - Add your Railway web service URL here
ALLOWED_ORIGINS=https://auraengine-web-production.up.railway.app,https://www.beatingheart.ai,https://beatingheart.ai,http://localhost:3000
```

## 🌐 Service 2: Web (Frontend)

### Configuration
- **Service Name**: `auraengine-web`
- **Root Directory**: `apps/web`
- **Dockerfile Path**: `apps/web/Dockerfile`
- **Start Command**: `node server.js`

### Environment Variables
```env
# Point to your API service
NEXT_PUBLIC_API_URL=https://auraengine-api-production.up.railway.app

# Port
PORT=3000
```

## 📝 Step-by-Step Setup

### Option A: Railway Dashboard (Recommended)

#### Step 1: Create API Service (if not already done)
1. Go to [railway.app](https://railway.app)
2. Create new project or open existing
3. Click **"+ New"** → **"GitHub Repo"**
4. Select **auraengine** repo
5. Set **Root Directory**: `apps/api`
6. Configure using `apps/api/railway.json`
7. Add all environment variables listed above
8. Deploy!

#### Step 2: Create Web Service
1. In same project, click **"+ New"** → **"GitHub Repo"**
2. Select **auraengine** repo again (yes, same repo!)
3. Set **Root Directory**: `apps/web`
4. Configure using `apps/web/railway.json`
5. Add environment variables:
   - `NEXT_PUBLIC_API_URL`: Get this from your API service URL
   - `PORT`: 3000
6. Deploy!

#### Step 3: Update API CORS
1. Go to **API service** settings
2. Update `ALLOWED_ORIGINS` environment variable
3. Add your new web service URL (e.g., `https://auraengine-web-production.up.railway.app`)
4. Redeploy API service

### Option B: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Create API service
railway service create auraengine-api
railway up --service auraengine-api --directory apps/api

# Add API environment variables
railway variables set DATABASE_URL=... --service auraengine-api
railway variables set REPLICATE_API_TOKEN=... --service auraengine-api
# ... add all other variables

# Create Web service
railway service create auraengine-web
railway up --service auraengine-web --directory apps/web

# Add Web environment variables
railway variables set NEXT_PUBLIC_API_URL=https://your-api-url.railway.app --service auraengine-web
railway variables set PORT=3000 --service auraengine-web

# Update API CORS
railway variables set ALLOWED_ORIGINS=https://your-web-url.railway.app,https://www.beatingheart.ai,http://localhost:3000 --service auraengine-api
```

## 🔄 Auto-Deployment

Once both services are set up:
- **Push to GitHub** → Both services auto-deploy
- API changes deploy to API service
- Frontend changes deploy to Web service

## 🔗 URLs

After deployment, you'll have:
- **API**: `https://auraengine-api-production.up.railway.app`
- **Web**: `https://auraengine-web-production.up.railway.app`

## ⚠️ Important Notes

1. **Root Directory**: Make sure each service has the correct root directory set (`apps/api` or `apps/web`)
2. **Environment Variables**: Both services need their specific env vars
3. **CORS**: The API must allow the Web service URL in `ALLOWED_ORIGINS`
4. **Port**: Web service should use port 3000, API uses Railway's $PORT

## 🐛 Troubleshooting

### Frontend not updating
- Check that Web service root directory is `apps/web`
- Verify `NEXT_PUBLIC_API_URL` points to correct API URL
- Hard refresh browser: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### CORS errors
- Add Web service URL to API's `ALLOWED_ORIGINS`
- Format: comma-separated, no spaces
- Example: `https://web.railway.app,http://localhost:3000`

### Build fails
- Check Dockerfile paths are correct
- Verify package.json exists in service root directory
- Check Railway build logs for specific errors

