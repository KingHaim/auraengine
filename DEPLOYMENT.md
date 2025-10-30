# 🚀 Beating Heart Deployment Guide

## Option 1: Cloud Deployment (Recommended)

### Backend (Railway) - Deploy First

1. Go to [railway.app](https://railway.app)
2. Sign up/login with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will detect `railway.json` and use Dockerfile
6. Add PostgreSQL database:
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will automatically set `DATABASE_URL`
7. Set environment variables in Railway:
   - `REPLICATE_API_TOKEN` = Your Replicate API token
   - `JWT_SECRET` = A random secret string (generate one)
   - `STRIPE_PUBLISHABLE_KEY` = Your Stripe publishable key
   - `STRIPE_SECRET_KEY` = Your Stripe secret key
8. Click "Deploy"
9. Copy your Railway backend URL

### Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com)
2. Sign up/login with GitHub
3. Click "New Project"
4. Import your repository
5. Set root directory to `apps/web`
6. Set environment variables:
   - `NEXT_PUBLIC_API_URL` = `https://your-railway-backend-url.railway.app` (from step 9 above)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = Your Stripe publishable key
7. Click "Deploy"

## Option 2: Docker Deployment (Local)

### Prerequisites

1. Install Docker Desktop: https://www.docker.com/products/docker-desktop/
2. Start Docker Desktop

### Deploy

```bash
# Build and start services
docker-compose up --build

# Access the application
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
```

## Environment Variables

### Frontend (Vercel)

- `NEXT_PUBLIC_API_URL`: Backend API URL

### Backend (Railway)

- `REPLICATE_API_TOKEN`: Your Replicate API token
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Random secret for JWT tokens

## Post-Deployment

1. **Update Frontend API URL**: After backend deploys, update `NEXT_PUBLIC_API_URL` in Vercel
2. **Test Login**: Use `julian@julian.com` / `password123`
3. **Verify Features**: Test model generation, campaigns, etc.

## Troubleshooting

- **CORS Issues**: Ensure `NEXT_PUBLIC_API_URL` is correct
- **Database Issues**: Check Railway logs for connection errors
- **API Errors**: Check Railway logs for Replicate API issues
