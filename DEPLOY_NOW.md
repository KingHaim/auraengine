# 🚀 DEPLOY NOW - Quick Start Guide

## ✅ Pre-Deployment Checklist

All necessary files have been configured:

- ✅ `apps/api/Dockerfile` - Updated to use `main_simple.py`
- ✅ `apps/api/Procfile` - Updated for Railway
- ✅ `railway.json` - Configured for Docker build
- ✅ CORS - Set to allow all origins
- ✅ Environment variables - Ready in `.env.production`

---

## 🎯 Deployment Steps (15 minutes)

### Step 1: Backend on Railway (10 min)

1. **Go to Railway**: https://railway.app
2. **New Project** → "Deploy from GitHub repo"
3. **Select**: `auraengine` repository
4. **Add PostgreSQL**:
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway auto-sets `DATABASE_URL`
5. **Set Environment Variables**:
   ```
   REPLICATE_API_TOKEN=your_replicate_token_here
   JWT_SECRET=your_random_jwt_secret_here
   STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key_here
   STRIPE_SECRET_KEY=your_stripe_secret_key_here
   ```
6. **Deploy** and wait for build
7. **Copy Backend URL**: e.g., `https://auraengine-production.up.railway.app`

### Step 2: Frontend on Vercel (5 min)

1. **Go to Vercel**: https://vercel.com
2. **New Project** → Import `auraengine`
3. **Root Directory**: `apps/web`
4. **Framework Preset**: Next.js (auto-detected)
5. **Set Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL=https://your-railway-url.railway.app
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SIbQ9P94ZYHDynVP4Ys1thiP9nFKuL0i2hRRT8s6Xa9rfCQ6q5AC7mS9d2QcN5aRPAerP6o3IyaDpeKew7e9Hyc00ESugEmqg
   ```
6. **Deploy**

---

## 🧪 Testing After Deployment

1. **Visit your Vercel URL**: `https://your-app.vercel.app`
2. **Login**: `julian@julian.com` / `password123`
3. **Test Features**:
   - ✅ Generate Model
   - ✅ Create Campaign
   - ✅ Generate Images
   - ✅ Generate Videos
   - ✅ Buy Credits

---

## 🔧 Troubleshooting

### Backend not starting?

- Check Railway logs for errors
- Verify `REPLICATE_API_TOKEN` is set
- Ensure PostgreSQL is connected

### Frontend can't reach backend?

- Verify `NEXT_PUBLIC_API_URL` in Vercel
- Check Railway backend is running
- Test backend health: `https://your-railway-url.railway.app/health`

### CORS errors?

- Backend is configured to allow all origins
- If still issues, check Railway logs

### Database errors?

- Railway PostgreSQL should auto-connect
- Check `DATABASE_URL` is set in Railway

---

## 📊 Expected Costs

- **Railway**: ~$5/month (includes PostgreSQL)
- **Vercel**: Free tier (hobby projects)
- **Replicate**: Pay-per-use (varies by usage)

---

## 🎉 You're Done!

Your Aura Engine is now live! 🚀

**Next Steps**:

- Share your Vercel URL
- Monitor Railway logs
- Add custom domain (optional)
