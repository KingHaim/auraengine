# 🧠 Mockup Engine — Backshot & Packshot Generator

> AI-powered creative tool for designers and product creators.
> Upload your product and automatically generate **backshots** with realistic models or **packshots** with professional studio lighting.
> Single‑engine pipeline using **Nano Banana (Gemini Images)** for generation, try‑on and refinement. Consistent look, zero diffusion drift.

---

## 🚀 1. Goal

Enable any creator to:

1. Upload an image of their product (clothing, bottles, cosmetics, gadgets, etc.).
2. Choose between:

   - 👕 **Backshot** – product on a realistic model or lifestyle scene.
   - 📦 **Packshot** – clean studio-style render with realistic lighting.

3. Modify the scene via text (prompts) and instantly get ad-ready results.

---

## 🧩 2. Tech Stack

**Frontend:**

- Next.js 14 (App Router)
- TypeScript + Tailwind + shadcn/ui
- Zustand for global state + React Query
- Framer Motion for animations
- **Dark UI theme with gradient sidebar** (spec below)

**Backend:**

- FastAPI (Python 3.11+)
- PostgreSQL (Supabase)
- Redis + RQ for async jobs
- Stripe (credits and subscriptions)
- S3-compatible storage (Supabase, Backblaze, etc.)

**AI / Image Generation:**

- **Nano Banana (Gemini Images)** — primary and only image engine (generation, inpainting, upscale).
- **SAM2 / U2Net** for background segmentation (pre/post).
- **Pose/landmark extractors** for guidance (no SD/FLUX used).

---

## 🖼️ 3. UI/UX Spec — Match the Provided Mockups

### Global

- Font: `Inter` (or `Plus Jakarta Sans`).
- Base sizing: 14px–16px body, titles tight leading, **letter‑spacing increased** on nav labels (Tailwind: `tracking-[0.18em]`).
- Rounded: `rounded-2xl` on cards, `rounded-xl` on thumbnails.
- Shadow: subtle (`shadow-[0_0_0_1px_rgba(255,255,255,0.04)]`).
- Color tokens:

  - `--ui-bg`: `#0E1115` (overall dark)
  - `--ui-panel`: `#11161C`
  - `--ui-card`: `#171C23`
  - `--ui-border`: `#242B35`
  - Text: `#E6E8EB` / secondary `#9BA3AF`
  - Accent: `#8B5CF6` (purple) + `#22D3EE` (cyan)

### Sidebar (AURA style)

- **Logo centered** at top; wordmark stacked: `AURA` (line 1), `ENGINE` (line 2), both uppercase with wide tracking.
- **Gradient background** identical in feel to the screenshot:

  - Base linear: `from-[#0B0F12] via-[#0E131A] to-[#121826]` (top→bottom).
  - Subtle radial glow: cyan/purple at edges.

- Sections: **CAMPAIGNS**, **PRODUCTS**, **MODELS**, **SCENES**; bottom: **HELP**, **TERMS**.
- Active item: bright text + small left accent bar.

**Tailwind utility (applied to sidebar container):**

```html
<div class="relative w-64 shrink-0 text-gray-300">
  <div
    class="absolute inset-0 bg-gradient-to-b from-[#0B0F12] via-[#0E131A] to-[#121826]"
  ></div>
  <div
    class="absolute inset-0 opacity-50 bg-[radial-gradient(600px_200px_at_20%_20%,rgba(34,211,238,0.15),transparent),radial-gradient(500px_200px_at_80%_70%,rgba(139,92,246,0.12),transparent)]"
  ></div>
  <aside
    class="relative h-full flex flex-col px-6 pt-8 pb-6 border-r border-[#1F2630]"
  >
    <!-- content -->
  </aside>
</div>
```

**Logo block (centered):**

```html
<div class="flex items-center justify-center">
  <div class="grid place-items-center">
    <div
      class="h-10 w-10 rounded-full grid place-items-center bg-white/5 border border-white/10"
    >
      ✶
    </div>
    <div
      class="mt-3 text-center text-sm font-semibold tracking-[0.25em] leading-tight"
    >
      AURA<br />ENGINE
    </div>
  </div>
</div>
```

**Nav items:**

```html
<nav class="mt-10 space-y-1 text-xs font-medium tracking-[0.18em]">
  <a
    class="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-300 hover:bg-white/5 data-[active=true]:text-white data-[active=true]:bg-white/10"
    data-active="true"
    >CAMPAIGNS</a
  >
  <a
    class="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-300 hover:bg-white/5"
    >PRODUCTS</a
  >
  <a
    class="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-300 hover:bg-white/5"
    >MODELS</a
  >
  <a
    class="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-300 hover:bg-white/5"
    >SCENES</a
  >
</nav>
<div class="mt-auto pt-6 border-t border-white/10">
  <div class="space-y-1 text-[11px] tracking-[0.22em] text-gray-400">
    <a class="block px-3 py-2 hover:text-white">HELP</a>
    <a class="block px-3 py-2 hover:text-white">TERMS</a>
  </div>
</div>
```

### Topbar + Search (Dashboard)

- Search bar centered under top padding. Placeholder: "Search for a project or a product…".
- Right corner user avatar (circle placeholder).

```html
<header class="flex items-center justify-between px-8 py-6">
  <div class="w-1/2 max-w-xl">
    <input
      class="w-full h-11 rounded-xl bg-[#161B22] border border-[#202632] px-4 text-sm placeholder:text-gray-500"
      placeholder="Search for a project or a product…"
    />
  </div>
  <div class="h-9 w-9 rounded-full bg-white/10"></div>
</header>
```

### Campaign Cards Grid (Dashboard)

- 3 columns on xl, 2 on md.
- Thumbnail with rounded corners, title bottom-left, small icons + counts.

```html
<main class="p-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
  <!-- card -->
  <article class="bg-[#171C23] rounded-2xl overflow-hidden">
    <div class="aspect-[16/9] relative">
      <img
        src="/ui/sample.jpg"
        class="absolute inset-0 h-full w-full object-cover"
      />
    </div>
    <div class="p-4">
      <h3 class="font-semibold">Harry Potter x Blvck</h3>
      <div class="mt-2 flex items-center gap-4 text-sm text-gray-400">
        <span class="inline-flex items-center gap-1">👥 2</span>
        <span class="inline-flex items-center gap-1">👗 2</span>
        <span class="inline-flex items-center gap-1">🖼️ 9</span>
      </div>
    </div>
  </article>
</main>
```

### Editor View (as per screenshot)

- **Left:** generated image centered with **left/right arrows** overlay.
- **Right:** big textarea with heading: "Type your modifications…"

```tsx
// apps/web/components/EditorLayout.tsx
import { ArrowLeft, ArrowRight } from "lucide-react";

export default function EditorLayout({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="flex h-screen w-full bg-black text-gray-300">
      <div className="relative w-1/2 flex items-center justify-center bg-neutral-900">
        <img src={imageUrl} alt="mockup" className="max-h-[90%] rounded-xl" />
        <button
          onClick={() => window.history.back()}
          className="absolute left-6 top-1/2 -translate-y-1/2 text-white opacity-80 hover:opacity-100"
        >
          <ArrowLeft size={48} />
        </button>
        <button
          onClick={() => console.log("next")}
          className="absolute right-6 top-1/2 -translate-y-1/2 text-white opacity-80 hover:opacity-100"
        >
          <ArrowRight size={48} />
        </button>
      </div>
      <div className="flex w-1/2 flex-col items-center justify-center p-10">
        <h2 className="text-3xl font-semibold mb-6 text-gray-300">
          Type your modifications…
        </h2>
        <textarea
          className="w-full h-72 bg-neutral-800 rounded-xl p-5 text-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Example: Add sunlight from the right, change shirt to navy blue…"
        />
      </div>
    </div>
  );
}
```

### Preview / Export

```tsx
// apps/web/components/PreviewPanel.tsx
import { ArrowLeft, Download, RefreshCcw } from "lucide-react";

export default function PreviewPanel({ results }: { results: string[] }) {
  return (
    <div className="flex h-screen flex-col bg-black text-gray-200">
      <header className="flex items-center justify-between p-6">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-white opacity-70 hover:opacity-100"
        >
          <ArrowLeft size={28} />
          <span>Back</span>
        </button>
        <h1 className="text-xl font-semibold">Generated Variants</h1>
        <button
          onClick={() => console.log("download-all")}
          className="flex items-center gap-2 text-white opacity-70 hover:opacity-100"
        >
          <Download size={28} />
          <span>Download All</span>
        </button>
      </header>
      <main className="flex-1 grid grid-cols-2 gap-6 p-8 overflow-y-auto">
        {results.map((img, i) => (
          <div key={i} className="relative group">
            <img
              src={img}
              alt={`Variant ${i + 1}`}
              className="w-full rounded-xl border border-neutral-800"
            />
            <div className="absolute inset-0 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition">
              <button
                onClick={() => console.log("reroll", i)}
                className="bg-neutral-800/70 hover:bg-purple-700 px-4 py-2 rounded-lg text-white flex items-center gap-2"
              >
                <RefreshCcw size={20} /> Re-roll
              </button>
              <button
                onClick={() => console.log("download", i)}
                className="bg-neutral-800/70 hover:bg-purple-700 px-4 py-2 rounded-lg text-white flex items-center gap-2"
              >
                <Download size={20} /> Download
              </button>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
```

---

## 🏗️ 4. Repository Structure

```
mockup-engine/
│
├─ apps/
│  ├─ web/ # Next.js frontend (UI + Auth + Dashboard)
│  └─ api/ # FastAPI backend (REST + Stripe Webhooks)
│
├─ packages/
│  ├─ worker/ # RQ jobs and ML pipelines
│  └─ shared/ # Shared types, utils, SDK
│
├─ infra/ # Docker, compose files, etc.
└─ README.md
```

---

## ⚙️ 5. Environment Variables

```
# App base
NODE_ENV=development
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...

# DB
DATABASE_URL=postgresql://user:pass@host:5432/mockup

# Redis
REDIS_URL=redis://localhost:6379

# S3 Storage
S3_ENDPOINT=https://s3.eu-west-1.amazonaws.com
S3_BUCKET=mockup-engine
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...

# Stripe
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

# Gemini / Nano Banana
GEMINI_API_KEY=...

```

---

## 🧠 6. Database Schema

```sql
-- users
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  created_at timestamptz default now()
);

-- credits
create table credits (
  user_id uuid references users(id) on delete cascade,
  balance int not null default 0,
  updated_at timestamptz default now(),
  primary key (user_id)
);

-- assets (uploaded products)
create table assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  url text not null,
  mime text,
  width int,
  height int,
  has_alpha boolean default false,
  created_at timestamptz default now()
);

-- templates (preset scenes)
create table templates (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  mode text check (mode in ('object','tryon','packshot')) not null,
  prompt text not null,
  negative_prompt text,
  control jsonb,
  placement jsonb,
  created_at timestamptz default now()
);

-- jobs
create table jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  asset_id uuid references assets(id),
  template_id uuid references templates(id),
  mode text check (mode in ('object','tryon','packshot')) not null,
  status text check (status in ('queued','processing','done','failed')) default 'queued',
  engine text,
  seed int,
  outputs jsonb,
  options jsonb,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

## 🌐 7. API Endpoints (FastAPI)

`/jobs` — **Create generation job**

```yaml
post:
  summary: Create generation job
  requestBody:
    content:
      application/json:
        schema:
          type: object
          required: [asset_id, template_id, mode]
          properties:
            asset_id: { type: string, format: uuid }
            template_id: { type: string, format: uuid }
            mode: { type: string, enum: [object, tryon, packshot] }
            engine: { type: string, enum: [gemini], default: gemini }
            variants: { type: integer, default: 4 }
            options:
              type: object
              properties:
                angle:
                  {
                    type: string,
                    enum: [front, three_quarter, side, top],
                    default: front,
                  }
                background:
                  {
                    type: string,
                    enum: [white, light_gray, transparent, gradient],
                    default: white,
                  }
                reflection: { type: boolean, default: false }
                shadow_strength: { type: number, default: 0.35 }
```

---

## 🧭 8. Frontend Flow

**Routes**

- `/upload` → upload product.
- `/templates` → select scene or model.
- `/editor` → modify prompt and view mockup (arrows left/right).
- `/preview` → view generated variants, re-roll or export.

```mermaid
graph LR
A[Upload] --> B[Select Template]
B --> C[Editor]
C --> D[Preview / Export]
C -->|⬅| B
C -->|➡| D
D -->|⬅| C
```

---

## 🧰 9. Tailwind Setup for This UI

**tailwind.config.ts** (ensure content paths + custom tracking utilities)

```ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./apps/web/app/**/*.{ts,tsx}",
    "./apps/web/components/**/*.{ts,tsx}",
    "./packages/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ui: {
          bg: "#0E1115",
          panel: "#11161C",
          card: "#171C23",
          border: "#242B35",
        },
      },
      letterSpacing: {
        tightish: ".02em",
        wideish: ".18em",
        widerbrand: ".25em",
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.2rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

**globals.css** (fonts + dark base)

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");

:root {
  color-scheme: dark;
}
html {
  font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto,
    "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji",
    "Segoe UI Symbol";
}

body {
  background: #0e1115;
  color: #e6e8eb;
}

/* smooth cards */
.card {
  background: #171c23;
  border: 1px solid #242b35;
  border-radius: 1.2rem;
}
```

---

## 📦 10. Packshot Mode (Nano Banana Only)

**Workflow**

1. **Pass 1:** Nano Banana prompt → clean studio packshot (white/gray/transparent bg, controlled lighting).
2. **Pass 2 (optional):** Nano Banana refine → micro‑texture + lighting polish (adds contact shadow/reflection as requested).

**Example flow**

```py
def generate_packshot_job(job_id: str):
    job = db.get_job(job_id)
    asset = db.get_asset(job.asset_id)
    opts = job.options or {}

    cutout = smart_cutout(asset.url)

    base = nano_packshot(
        cutout=cutout,
        angle=opts.get("angle", "front"),
        background=opts.get("background", "white"),
        prompt=build_base_prompt(opts)
    )

    refined = nano_refine(
        image=base,
        prompt=build_refine_prompt(opts),
        shadow_strength=opts.get("shadow_strength", 0.35),
        reflection=opts.get("reflection", False)
    )

    outs = upscale_and_export(refined or base, sizes=[1080,1440,2048], ratios=["1:1","4:5","16:9"])
    urls = upload_outputs(outs)
    db.update_job(job_id, status="done", outputs=urls)
```

**Prompts**

- **Base:** Ultra‑clean studio packshot, {ANGLE} view of the uploaded product. Even softbox lighting, white seamless background, soft contact shadow. No props, no text, no watermark. Crisp edges, accurate colors.
- **Refinement:** Enhance realism with micro‑textures and physically‑plausible lighting using Nano Banana. Preserve exact label design and product colors. Add a soft contact shadow (strength: {SHADOW}) and optional reflection. No props or text. Photorealistic finish.

---

## 💰 11. Credits System

- Backshot (Nano): 1 credit per variant
- Packshot (Nano single pass): 1 credit
- Packshot (Nano two‑pass refine): 1.5 credits
- Re‑roll: same credit cost
- Subscriptions: Basic, Pro, Enterprise (SLA + white‑label options)

---

## ✅ 12. Tests

- Upload PNG with transparency → cutout preserved
- Backshot → realistic model pose and lighting
- Packshot → clean background, accurate color
- Refine → shadows applied under product
- Exports → 1:1, 4:5, 9:16, 16:9
- Stripe → credits updated correctly
- Rate limit → 429 on abuse

---

## 🔒 13. Legal / Safety

- User must own the rights to uploaded logos or designs.
- Synthetic faces only; no real model likenesses.
- Block NSFW and copyrighted brand prompts.
- GDPR compliant: assets auto-deleted after 30 days.
- Store asset + output hashes for traceability.

---

## 🧭 14. Folder Structure (Next.js)

```
/apps/web/
 ├─ /components/
 │   ├─ EditorLayout.tsx
 │   ├─ PreviewPanel.tsx
 │   ├─ Sidebar.tsx
 │   ├─ Topbar.tsx
 │   ├─ CampaignCard.tsx
 │   ├─ PackshotControls.tsx
 │   ├─ UploadStep.tsx
 │   ├─ TemplatePicker.tsx
 │   └─ UI/atoms/...
 │
 ├─ /app/
 │   ├─ dashboard/page.tsx
 │   ├─ upload/page.tsx
 │   ├─ templates/page.tsx
 │   ├─ editor/page.tsx
 │   ├─ preview/page.tsx
 │   └─ packshot/page.tsx
 │
 └─ /public/ui/
     ├─ editor.png
     ├─ preview.png
     └─ packshot.png
```

---

## 🗺️ 15. Roadmap (2 Weeks MVP)

| Day   | Goal                           |
| ----- | ------------------------------ |
| 1–3   | Upload + S3 + Auth             |
| 4–6   | Object generation (IP-Adapter) |
| 7–9   | Try-on + lighting              |
| 10    | Preview + Export               |
| 11–12 | Stripe + rate limits           |
| 13–14 | QA + Landing Page              |

---

## ✨ Summary

- Seamless upload → generate → export workflow
- Backshots (lifestyle realism)
- Packshots (studio-grade, refined via Nano Banana)
- Stripe-powered credit system
- Real-time generation with Redis queues
- Built around Nano Banana (Gemini Images) with modular pre/post steps (segmentation, pose, upscaling).
