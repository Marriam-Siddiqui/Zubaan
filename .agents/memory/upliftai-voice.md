---
name: UpliftAI voice assistant quirks
description: Lessons from wiring the Zubaan Urdu voice app to UpliftAI/LiveKit
---

- **RoomAudioRenderer is mandatory.** Without it inside `UpliftAIRoom`/`LiveKitRoom`, the room connects but the user's mic is never published and agent audio never plays — the app looks connected while "not listening."
  **How to apply:** any LiveKit-based voice UI must mount `<RoomAudioRenderer />` in the connected view.
- **Assistant ID vs API key.** `createPublicSession` needs only the public assistant UUID (safe to hardcode for public assistants). The `sk_api_` key is only for creating/managing assistants and must never reach the frontend.
- **Never log/surface the createPublicSession response body** — it contains the LiveKit bearer token. Log status only; error UI must show sanitized messages.
- **Users paste whole blobs into secret prompts.** When re-requesting an existing secret, the old value stays unless they actually replace it — verify the value took effect (e.g. check the URL being called) rather than trusting the "confirmed" event.
- **UpliftAI assistant update (POST /v1/realtime-assistants/:id) REPLACES the whole document.** A partial body wipes `config` (stt/llm/agent/tts) and resets `public` to false — the agent then never joins the room (UI stuck at "connected" with no greeting). Always GET first, merge, and send the complete config + `public: true`.
- **Replit preview iframe blocks the microphone.** Voice must be tested in a new browser tab; the testing subagent can grant fake-mic permissions for e2e verification.
