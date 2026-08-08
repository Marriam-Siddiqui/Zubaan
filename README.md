# ZUBAAN (زبان) 🎙️

**Bureaucracy explained in spoken Urdu. No reading, no forms, no middlemen. Just talk.**

ZUBAAN is a voice-first assistant that helps low-literacy Pakistanis navigate government services without reading or writing a single word. Around 40% of Pakistani adults can't comfortably read or write — government paperwork, SMS notifications, and web portals exclude them entirely. ZUBAAN lets them simply **speak** and get answers in clear, simple spoken Urdu.

## ✨ What it does

| Feature | Description |
|---|---|
| 🏦 **BISP Kafaalat eligibility check** | A real conversational interview — household size, income, province, disability — with an actual eligibility calculation, logged to a database |
| 🪪 **NADRA ID card guidance** | Documents needed, process for new/lost/renewed CNIC |
| 🏥 **Sehat Card** | What it is, who qualifies, how it works |
| 💡 **Utility bills** | How to pay (bank, ATM, JazzCash/Easypaisa), consumer numbers, filing complaints |
| 🤝 **Ehsaas vs Kafaalat** | Untangles the programs people commonly confuse |
| 📱 **SIM biometric verification** | Why SIMs get blocked and what to do |
| 📖 **Jargon explainer** | Explains terms like "NSER" and "survey" in plain Urdu |

### Built-in honesty
- Refuses to guess — when unsure, it says so and directs users to the **8171 helpline** or the relevant office
- Politely declines off-topic questions
- Every eligibility answer is labelled an **estimate** — the official decision comes via the government's NSER survey
- Never pretends to access real government records, pay bills, or submit applications

## 🗣️ How it works

1. User opens the app on any phone browser and taps **one button**
2. ZUBAAN greets them in spoken Urdu — no reading needed at any point
3. They speak in Urdu (Punjabi and mixed speech are understood too); it always replies in simple spoken Urdu
4. For BISP checks, the AI calls a real backend tool that runs the eligibility logic and saves the result to Postgres

**Voice pipeline:** user's voice → speech-to-text (Whisper) → LLM with a purpose-built Urdu persona → natural Urdu text-to-speech — all in real time over a live audio connection (UpliftAI / LiveKit).

## 🏗️ Architecture

```
├── artifacts/
│   ├── zubaan/        # React + Vite frontend — the voice UI (one button, zero required reading)
│   └── api-server/    # Express backend — BISP eligibility logging API
└── ...
```

- **Frontend:** React, Vite, Tailwind CSS, `@upliftai/realtime-web` (LiveKit-based realtime voice)
- **Backend:** Express + TypeScript
- **Database:** PostgreSQL via Drizzle ORM (eligibility checks & session logs)
- **Voice AI:** UpliftAI realtime assistant — Whisper STT (locked to Urdu), LLM persona, natural Urdu TTS tuned for low-bandwidth rural networks

## 🚀 Running locally

```bash
pnpm install

# Frontend
pnpm --filter @workspace/zubaan run dev

# Backend
pnpm --filter @workspace/api-server run dev
```

### Environment variables

| Variable | Purpose |
|---|---|
| `UPLIFTAI_API_KEY` | UpliftAI API key (server-side assistant management) |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Session signing secret |

> **Note:** No secrets are committed to this repository. Configure them in your environment.

## ⚠️ Honest limits

- Only the BISP check runs on real logic; other topics use AI general knowledge, which can be dated on exact fees/procedures
- No connection to actual government databases — it cannot look up anyone's real status
- Speaks only Urdu (understands more than it speaks)

## 🗺️ Roadmap

- Auto-reconnect on weak rural networks
- Spoken instructions on the start screen (fully reading-free onboarding)
- Conversation history with past eligibility results
- Press-and-hold walkie-talkie talk button
- Mobile app

---

Built for a hackathon with ❤️ — to give a voice to those the paperwork forgot.
