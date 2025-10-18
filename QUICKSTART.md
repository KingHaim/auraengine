# 🚀 Aura Engine - Quick Start Guide

## What You've Built

A complete AI-powered mockup generation platform with:

- **Frontend**: Next.js 14 with dark theme and AURA-branded sidebar
- **Backend**: FastAPI with Replicate integration for AI image generation
- **AI Pipeline**: Background removal + Nano Banana (Gemini Images) generation
- **Two Modes**: Packshot (studio) and Backshot (lifestyle) generation

## 🎯 Key Features

✅ **Upload Interface**: Drag & drop product images  
✅ **AI Background Removal**: Automatic product isolation  
✅ **Dual Generation Modes**: Packshot vs Backshot  
✅ **Real-time Processing**: Live generation with progress  
✅ **Preview & Export**: Download generated variants  
✅ **Dark UI Theme**: Professional AURA-branded interface  
✅ **Responsive Design**: Works on all devices

## 🚀 Running the App

### Option 1: Quick Start (Recommended)

```bash
# Run the startup script
./start-dev.sh
```

### Option 2: Manual Start

```bash
# Terminal 1 - Backend
cd apps/api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py

# Terminal 2 - Frontend
cd apps/web
npm install
npm run dev
```

### Option 3: Docker

```bash
cd infra
docker-compose up --build
```

## 🌐 Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## 🎨 How to Use

1. **Upload**: Go to `/upload` and select a product image
2. **Choose Mode**: Pick Packshot (studio) or Backshot (lifestyle)
3. **Add Modifications**: Describe changes in the text area
4. **Generate**: Click "Generate Mockups" and wait for results
5. **Preview**: View generated variants in the preview page
6. **Export**: Download individual images or all variants

## 🔧 API Integration

The backend integrates with:

- **Replicate API**: For AI image generation using Nano Banana
- **Background Removal**: Automatic product isolation
- **Image Processing**: PIL for optimization and enhancement

## 📁 Project Structure

```
aura-engine/
├── apps/
│   ├── web/              # Next.js frontend
│   │   ├── app/          # Pages (dashboard, upload, editor, preview)
│   │   ├── components/   # React components
│   │   └── public/       # Static assets
│   └── api/              # FastAPI backend
│       ├── main.py       # Main API server
│       └── requirements.txt
├── packages/
│   └── shared/           # Shared TypeScript types
├── infra/                # Docker configuration
└── README.md
```

## 🎯 Next Steps

To extend the platform:

1. **Add Authentication**: User accounts and sessions
2. **Database Integration**: Store campaigns and assets
3. **S3 Storage**: Cloud file storage
4. **Stripe Integration**: Credit system and payments
5. **Advanced Editing**: More modification options
6. **Batch Processing**: Multiple products at once

## 🐛 Troubleshooting

**Backend won't start?**

- Check Python 3.11+ is installed
- Verify Replicate API token is set
- Install dependencies: `pip install -r requirements.txt`

**Frontend won't start?**

- Check Node.js 18+ is installed
- Install dependencies: `npm install`
- Clear cache: `rm -rf .next && npm run dev`

**Generation fails?**

- Check Replicate API token is valid
- Verify internet connection
- Check API logs for detailed errors

## 📞 Support

The app is fully functional and ready for development. All core features are implemented according to your specifications!

