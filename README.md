# DealForge

AI-powered Zoom Marketplace application for sales meeting intelligence, lead management, and automated email outreach.

## Features

- **Real-time Transcription** — Zoom RTMS integration for live meeting transcription
- **AI Analysis** — Automatic summarization, action items, and sentiment analysis (BYOK)
- **Lead Management** — Auto-create leads from meeting participants, scoring, pipeline tracking
- **Email Outreach** — Automated drip campaigns, email drafting with AI
- **Analytics Dashboard** — Meeting stats, conversion metrics, pipeline visualization
- **Zoom In-Meeting Panel** — Live suggestions and notes without leaving Zoom

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Zustand, Dexie.js (IndexedDB) |
| Backend | Node.js, Express, TypeScript, Socket.io |
| Auth | Firebase Authentication |
| AI | OpenAI, Anthropic, Google Gemini (BYOK) |
| Email | Resend |
| Payments | Dodo Payments |
| Database | IndexedDB (client-side), optional Redis |

## Architecture

Privacy-first design — sensitive data stored client-side in IndexedDB. Backend acts as a stateless relay with 24h temporary buffer.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Zoom Panel    │────▶│   Express API    │────▶│   Firebase      │
│   (Stateless)   │     │   (Relay)        │     │   (Auth Only)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │
┌─────────────────┐           │
│  Web Dashboard  │───────────┘
│  (IndexedDB)    │
└─────────────────┘
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Firebase project (for authentication)
- Optional: Zoom Developer account, Resend API key, Dodo Payments account

### Installation

```bash
git clone https://github.com/akshatsha5ill/vigilant-goggles.git
cd vigilant-goggles
npm install
```

### Environment Setup

```bash
# Copy example env files
cp server/.env.example server/.env
cp client/.env.example client/.env

# Edit with your credentials
```

### Development

```bash
# Start both client and server
npm run dev

# Or start individually
npm run dev:client   # Vite dev server on port 5173
npm run dev:server   # Express server on port 3000
```

### Testing

```bash
npm run test         # Run all tests
npm run test:client  # Client tests only
npm run test:server  # Server tests only
npm run lint         # Lint client code
```

### Build

```bash
npm run build        # Build client for production
```

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Route pages
│   │   ├── services/       # Business logic
│   │   ├── store/          # Zustand state
│   │   ├── hooks/          # Custom hooks
│   │   └── crypto/         # Client-side encryption
│   └── ...
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/      # Express middleware
│   │   └── utils/          # Utilities
│   └── ...
└── ...
```

## API Documentation

Server includes OpenAPI/Swagger documentation at `/api/docs` when running.

## License

MIT
