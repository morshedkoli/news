# NewsByte Admin Dashboard

![NewsByte Admin](public/logo-mark.png)

**NewsByte Admin** is the central command center for the NewsByte news aggregation platform. It empowers administrators to manage AI-driven news generation, RSS feed pipelines, system-wide configurations, and real-time analytics.

Built with performance and scalability in mind using **Next.js 16 (Turbopack)** and **Tailwind CSS v4**.

---

## 🚀 Key Features

### 🤖 AI News Engine
- **Multi-Provider Support**: Seamlessly switch between OpenRouter, Ollama (Local), Groq, and custom OpenAI-compatible providers.
- **Smart Aggregation**: Automatically summarize and rewrite news from varied RSS sources.
- **Health Monitoring**: Real-time tracking of AI provider latency, success rates, and cost.

### 📡 RSS Pipeline
- **Feed Management**: Add, validate, and categorize RSS feeds.
- **Auto-Deduplication**: Intelligent logic to prevent duplicate news entries using fuzzy matching and time windows.
- **Cron Jobs**: Automated background fetching and processing of news feeds.

### 📊 Analytics & Insights
- **Live Dashboard**: Visualize user engagement, news consumption, and system health.
- **Ad Performance**: Track impression and click-through rates (CTR) for integrated ad networks.

### ⚙️ System Control
- **Ad Configuration**: Toggle global ad settings, providers (AdMob/Custom), and placements instantly.
- **App Updates**: Manage forced updates and version control for mobile apps.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Bundler**: Turbopack
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Database & Auth**: [Firebase](https://firebase.google.com/) (Firestore, Auth)
- **UI Components**: Custom components with [Lucide React](https://lucide.dev/) icons.
- **Charts**: [Recharts](https://recharts.org/)
- **RSS Parsing**: `rss-parser` + `cheerio` + `@mozilla/readability`

---

## 📦 Getting Started

### Prerequisites
- Node.js 18.17 or later
- npm or pnpm

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/murshedkoli-2/NewsByte.git
   cd NewsByte/admin
   ```

2. **Install dependencies**
   ```bash
   npm install
   # Ensure platform-specific binaries are installed if needed
   npm install lightningcss-linux-x64-gnu --save-optional
   ```

3. **Configure Environment**
   Create a `.env.local` file in the root directory with your Firebase and AI credentials:
   ```env
   # Firebase Admin SDK
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=your-client-email
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

   # App Config
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # AI Providers (Optional - can be managed in UI)
   OPENROUTER_API_KEY=sk-or-...
   ```

4. **Run the Development Server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

---

## 🔧 Deployment

The application is optimized for deployment on **Vercel**.

1. Push your code to a GitHub repository.
2. Import the project into Vercel.
3. Add the Environment Variables in the Vercel dashboard.
4. Deploy!

### Cron Jobs
For Cron jobs (RSS fetching, AI summaries) to work in production, ensure you have set up Vercel Cron or an external trigger pointed at the `/api/cron/*` endpoints.

---

## 🤝 Contributing

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add some amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

**NewsByte** — *Redefining News Aggregation with AI.*
