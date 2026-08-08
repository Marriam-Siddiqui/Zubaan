# ZUBAAN (زبان) 🎙️

**Bureaucracy explained in spoken Urdu. No reading, no forms, no middlemen. Just talk.**

ZUBAAN is a voice first assistant that helps low literacy Pakistanis navigate government services without reading or writing a single word. Around 40% of Pakistani adults cannot comfortably read or write. Government paperwork, SMS notifications, and web portals exclude them entirely. ZUBAAN lets them simply **speak** and get answers in clear, simple spoken Urdu.

## ✨ What it does

| Feature | Description |
|---|---|
| 🏦 **BISP Kafaalat eligibility check** | A real conversational interview covering household size, income, province, and disability, with an actual eligibility calculation that is logged to a database |
| 🪪 **NADRA ID card guidance** | Documents needed and the process for a new, lost, or renewed CNIC |
| 🏥 **Sehat Card** | What it is, who qualifies, and how it works |
| 💡 **Utility bills** | How to pay (bank, ATM, JazzCash/Easypaisa), consumer numbers, and filing complaints |
| 🤝 **Ehsaas vs Kafaalat** | Untangles the programs people commonly confuse |
| 📱 **SIM biometric verification** | Why SIMs get blocked and what to do |
| 📖 **Jargon explainer** | Explains terms like "NSER" and "survey" in plain Urdu |

### Built-in honesty
1. Refuses to guess. When unsure, it says so and directs users to the **8171 helpline** or the relevant office
2. Politely declines off topic questions
3. Every eligibility answer is labelled an **estimate**. The official decision comes via the government's NSER survey
4. Never pretends to access real government records, pay bills, or submit applications

## 🗣️ How it works

1. User opens the app on any phone browser and taps **one button**
2. ZUBAAN greets them in spoken Urdu. No reading is needed at any point
3. They speak in Urdu (Punjabi and mixed speech are understood too) and it always replies in simple spoken Urdu
4. For BISP checks, the AI calls a real backend tool that runs the eligibility logic and saves the result to Postgres

**Voice pipeline:** user's voice → speech to text (Whisper) → LLM with a purpose built Urdu persona → natural Urdu text to speech, all in real time over a live audio connection (UpliftAI / LiveKit).

## 🏗️ Architecture

```
├── artifacts/
│   ├── zubaan/        # React + Vite frontend, the voice UI (one button, zero required reading)
│   └── api-server/    # Express backend, BISP eligibility logging API
└── ...
```

1. **Frontend:** React, Vite, Tailwind CSS, `@upliftai/realtime-web` (LiveKit based realtime voice)
2. **Backend:** Express + TypeScript
3. **Database:** PostgreSQL via Drizzle ORM (eligibility checks and session logs)
4. **Voice AI:** UpliftAI realtime assistant with Whisper STT (locked to Urdu), an LLM persona, and natural Urdu TTS tuned for low bandwidth rural networks

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
| `UPLIFTAI_API_KEY` | UpliftAI API key (server side assistant management) |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Session signing secret |

> **Note:** No secrets are committed to this repository. Configure them in your environment.

## ⚠️ Honest limits

1. Only the BISP check runs on real logic. Other topics use AI general knowledge, which can be dated on exact fees and procedures
2. No connection to actual government databases, so it cannot look up anyone's real status
3. Speaks only Urdu (understands more than it speaks)

## 🗺️ Roadmap

1. Auto reconnect on weak rural networks
2. Spoken instructions on the start screen (fully reading free onboarding)
3. Conversation history with past eligibility results
4. Press and hold walkie talkie talk button
5. Mobile app

---

Built for a hackathon with ❤️, to give a voice to those the paperwork forgot.
