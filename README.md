# 🧠 Aura — AI Mockup Generator

> AI-powered creative tool for designers and product creators.
> Upload your product and automatically generate **backshots** with realistic models or **packshots** with professional studio lighting.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Redis (for job queues)

### Installation

1. **Install dependencies:**

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd apps/web && npm install

# Install backend dependencies
cd apps/api && pip install -r requirements.txt
```

2. **Set up environment:**

```bash
# Copy environment file
cp env.example .env

# Edit .env with your API keys
# - REPLICATE_API_TOKEN (already set)
# - Add your S3 credentials for production
```

3. **Run the development servers:**

**Terminal 1 - Backend:**

```bash
cd apps/api
python main.py
```

**Terminal 2 - Frontend:**

```bash
cd apps/web
npm run dev
```

4. **Open the app:**

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## 🏗️ Project Structure

```
app/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # FastAPI backend
├── packages/
│   └── shared/       # Shared types
└── infra/           # Docker, compose files
```

## 🎨 Features

- **Packshot Mode**: Clean studio-style renders with professional lighting
- **Backshot Mode**: Realistic lifestyle shots with models
- **AI-Powered**: Uses Nano Banana (Gemini Images) via Replicate
- **Background Removal**: Automatic product isolation
- **Real-time Generation**: Fast processing with progress tracking
- **Export Options**: Multiple formats and sizes

## 🔧 Tech Stack

**Frontend:**

- Next.js 14 (App Router)
- TypeScript + Tailwind CSS
- Framer Motion animations
- Dark UI theme with gradient sidebar

**Backend:**

- FastAPI (Python)
- Replicate API integration
- Background removal with rembg
- Image processing with PIL

**AI/ML:**

- Nano Banana (Gemini Images)
- Background segmentation
- Image upscaling and refinement

## 📝 API Usage

### Generate Mockups

```bash
curl -X POST "http://localhost:8000/jobs/generate" \
  -F "mode=packshot" \
  -F "user_mods=Add sunlight from the right" \
  -F "angle=front" \
  -F "background=white" \
  -F "reflection=false" \
  -F "shadow_strength=0.35" \
  -F "variants=4" \
  -F "product=@product.jpg"
```

### Response

```json
{
  "urls": [
    "https://replicate.com/output1.jpg",
    "https://replicate.com/output2.jpg",
    "https://replicate.com/output3.jpg",
    "https://replicate.com/output4.jpg"
  ]
}
```

## 🎯 Roadmap

- [ ] User authentication
- [ ] Credit system with Stripe
- [ ] Database integration
- [ ] S3 file storage
- [ ] Advanced editing tools
- [ ] Batch processing
- [ ] API rate limiting

## 📄 License

MIT License - see LICENSE file for details.

