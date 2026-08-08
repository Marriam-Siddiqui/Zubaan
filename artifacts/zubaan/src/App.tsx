import { useState } from 'react';
import { UpliftAIRoom, type ToolConfig } from '@upliftai/assistants-react';
import { useVoiceAssistant, BarVisualizer, RoomAudioRenderer } from '@livekit/components-react';
import { Loader2 } from 'lucide-react';

type AppState = 'idle' | 'connecting' | 'connected' | 'error';

interface SessionData {
  token: string;
  wsUrl: string;
}

const bispTools: ToolConfig[] = [
  {
    name: 'check_bisp_eligibility',
    description: 'Check simplified BISP Kafaalat eligibility based on household details.',
    parameters: {
      type: 'object',
      properties: {
        household_income_pkr: { type: 'number', description: 'Total monthly household income in PKR' },
        family_size: { type: 'number', description: 'Number of people in the household' },
        province: { type: 'string', description: 'Province of residence' },
        has_disability: { type: 'boolean', description: 'Whether any household member has a disability' },
      },
      required: ['household_income_pkr', 'family_size', 'province'],
    },
    timeout: 8,
    handler: async (data) => {
      const args = JSON.parse(data.payload).arguments.raw_arguments as {
        household_income_pkr: number;
        family_size: number;
        province: string;
        has_disability?: boolean;
      };

      const { household_income_pkr, family_size, province, has_disability } = args;
      const perCapitaIncome = household_income_pkr / Math.max(family_size, 1);

      const isLikelyEligible =
        perCapitaIncome < 8000 || (has_disability === true && perCapitaIncome < 12000);

      const reason = isLikelyEligible
        ? 'فی کس آمدنی مقررہ حد سے کم ہے'
        : 'فی کس آمدنی مقررہ حد سے زیادہ ہے، لیکن حتمی فیصلہ NSER سروے سے ہوگا';

      // Fire-and-forget logging — never block the voice response
      fetch('/api/log-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          household_income_pkr,
          family_size,
          province,
          has_disability: has_disability ?? false,
          per_capita_income: perCapitaIncome,
          is_likely_eligible: isLikelyEligible,
        }),
      }).catch(() => {});

      return JSON.stringify({
        result: { isLikelyEligible, reason },
        presentationInstructions:
          isLikelyEligible
            ? `صارف کو اردو میں بتائیں کہ ان کی گھریلو صورتحال کی بنیاد پر وہ BISP کفالت پروگرام کے لیے اہل ہو سکتے ہیں۔ وجہ بتائیں: "${reason}"۔ یاد دلائیں کہ یہ صرف ایک اندازہ ہے اور حتمی فیصلہ NSER سروے کے بعد ہوگا۔`
            : `صارف کو اردو میں نرمی سے بتائیں کہ ابھی کی معلومات کے مطابق وہ BISP کفالت کے لیے اہل نہیں لگتے، لیکن یہ صرف ایک اندازہ ہے۔ وجہ بتائیں: "${reason}"۔ انہیں بتائیں کہ NSER سروے کے ذریعے درست تصدیق ہوگی اور حالات بدلنے پر دوبارہ درخواست دی جا سکتی ہے۔`,
      });
    },
  },
];

export default function App() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [debugMsg, setDebugMsg] = useState('');

  // Public assistant ID — safe to hardcode (no credentials, public session only)
  const assistantId = 'b73fbb90-c40d-4a80-8057-fc5623eb924a';

  const handleConnect = async () => {
    setAppState('connecting');
    setErrorMsg('');
    setDebugMsg('');

    // Guard: assistant ID must be set
    if (!assistantId) {
      const msg = 'VITE_ASSISTANT_ID is not set in environment variables.';
      console.error('[Zubaan]', msg);
      setErrorMsg('کنکشن ناکام ہوگیا۔ براہ کرم دوبارہ کوشش کریں۔');
      setDebugMsg(msg);
      setAppState('error');
      return;
    }

    // Step 1: mic permission (stop the probe stream immediately — the room re-acquires it)
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach((t) => t.stop());
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error('[Zubaan] Mic permission error:', err);
      setErrorMsg('مائیکروفون کی اجازت نہیں ملی۔ براہ کرم اجازت دیں اور دوبارہ کوشش کریں۔');
      setDebugMsg(`Mic error: ${detail}`);
      setAppState('error');
      return;
    }

    // Step 2: create UpliftAI session
    try {
      const url = `https://api.upliftai.org/v1/realtime-assistants/${assistantId}/createPublicSession`;
      console.log('[Zubaan] Calling:', url);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantName: 'user' }),
      });

      console.log('[Zubaan] API response status:', res.status);

      // Never log or surface the response body — it contains the session token.
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as Record<string, unknown>;
      // Accept multiple possible field names from the API
      const token =
        (data.token ?? data.accessToken ?? data.access_token) as string | undefined;
      const wsUrl =
        (data.wsUrl ?? data.serverUrl ?? data.server_url ?? data.ws_url) as string | undefined;

      if (!token || !wsUrl) {
        throw new Error(`Unexpected response shape (fields: ${Object.keys(data).join(', ')})`);
      }

      setSessionData({ token, wsUrl });
      setAppState('connected');
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error('[Zubaan] Session creation error:', err);
      setErrorMsg('کنکشن ناکام ہوگیا۔ براہ کرم دوبارہ کوشش کریں۔');
      setDebugMsg(detail);
      setAppState('error');
    }
  };

  const handleDisconnect = () => {
    setSessionData(null);
    setAppState('idle');
    setErrorMsg('');
    setDebugMsg('');
  };

  if (appState === 'connected' && sessionData) {
    return (
      <UpliftAIRoom
        token={sessionData.token}
        serverUrl={sessionData.wsUrl}
        connect={true}
        audio={true}
        video={false}
        tools={bispTools}
        onError={(err: Error) => {
          console.error('[Zubaan] Room error:', err.message);
          setSessionData(null);
          setErrorMsg('کنکشن ناکام ہوگیا۔ براہ کرم دوبارہ کوشش کریں۔');
          setDebugMsg(`Room error: ${err.message}`);
          setAppState('error');
        }}
        onDisconnected={() => {
          // Covers server-side disconnects (session expiry, network drop)
          setSessionData(null);
          setAppState('idle');
        }}
      >
        <ConnectedScreen onDisconnect={handleDisconnect} />
      </UpliftAIRoom>
    );
  }

  return (
    <IdleScreen
      appState={appState}
      errorMsg={errorMsg}
      debugMsg={debugMsg}
      onConnect={handleConnect}
    />
  );
}

function ConnectedScreen({ onDisconnect }: { onDisconnect: () => void }) {
  const { state, audioTrack } = useVoiceAssistant();

  const statusMap: Record<string, string> = {
    listening: 'سن رہی ہوں...',
    thinking: 'سوچ رہی ہوں...',
    speaking: 'بول رہی ہوں...',
  };

  const statusText = statusMap[state] ?? 'جڑ گئی ہوں...';

  const isListening = state === 'listening';

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-b from-[#0d2b1a] to-[#07170e] text-[#f5e6c8] flex flex-col relative overflow-hidden font-sans" dir="rtl">
      {/* Required: renders all remote audio tracks including the assistant's voice */}
      <RoomAudioRenderer />

      {/* 1. Top warning banner */}
      <div className="bg-[#d4a84b]/10 border-b border-[#d4a84b]/20 w-full py-3 md:py-4 text-center z-10 shrink-0">
        <p className="text-[#d4a84b] text-sm md:text-base font-medium opacity-80 tracking-wide px-4">
          یہ ایک اندازہ ہے، حتمی فیصلہ نہیں
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-between py-8 md:py-12 px-6">
        {/* 2. App name */}
        <h1 className="text-3xl md:text-5xl font-bold text-[#d4a84b] tracking-wide opacity-40 drop-shadow-sm">
          زبان
        </h1>

        {/* 3. Visualizer + mic pulse area */}
        <div className="flex-1 flex flex-col items-center justify-center w-full gap-6">
          {/* Pulsing ring around visualizer when listening */}
          <div
            className={[
              'relative flex items-center justify-center rounded-full transition-all duration-700',
              isListening
                ? 'w-52 h-52 md:w-64 md:h-64 ring-4 ring-[#d4a84b]/60 shadow-[0_0_40px_rgba(212,168,75,0.35)]'
                : 'w-44 h-44 md:w-56 md:h-56',
            ].join(' ')}
          >
            {/* Outer pulse ring — visible only while listening */}
            {isListening && (
              <span className="absolute inset-0 rounded-full bg-[#d4a84b]/10 animate-ping" style={{ animationDuration: '2s' }} />
            )}

            {/* BarVisualizer — fades + scales in once the audio track is live */}
            <div
              className={[
                'w-full h-full flex items-center justify-center transition-all duration-500',
                audioTrack ? 'opacity-100 scale-100' : 'opacity-40 scale-90',
              ].join(' ')}
            >
              {audioTrack ? (
                <BarVisualizer
                  trackRef={audioTrack}
                  barCount={9}
                  options={{ minHeight: 8 }}
                  className="w-4/5 h-3/5 drop-shadow-[0_0_18px_rgba(212,168,75,0.5)]"
                />
              ) : (
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div
                      key={i}
                      className="w-2.5 h-2.5 bg-[#d4a84b] rounded-full animate-pulse"
                      style={{ animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 4. Status text — smooth cross-fade via key */}
          <p
            key={statusText}
            data-testid="text-status"
            className="text-xl md:text-2xl font-medium text-[#d4a84b]/90 text-center drop-shadow-md transition-opacity duration-300 px-4"
          >
            {statusText}
          </p>
        </div>

        {/* 5. Disconnect button */}
        <button
          data-testid="btn-disconnect"
          onClick={onDisconnect}
          className="px-8 md:px-10 py-3 md:py-4 rounded-full bg-[#174a2b]/70 text-[#f5e6c8]/80 hover:bg-[#1f5936] hover:text-[#f5e6c8] hover:shadow-lg transition-all duration-300 border border-[#2a6040]/60 text-lg md:text-xl font-medium active:scale-95"
        >
          بند کریں
        </button>
      </div>
    </div>
  );
}

function IdleScreen({
  appState,
  errorMsg,
  debugMsg,
  onConnect,
}: {
  appState: AppState;
  errorMsg: string;
  debugMsg: string;
  onConnect: () => void;
}) {
  const statusMap: Record<AppState, string> = {
    idle: 'شروع کرنے کے لیے بٹن دبائیں',
    connecting: 'جوڑ رہی ہوں...',
    connected: '',
    error: errorMsg,
  };

  const isConnecting = appState === 'connecting';
  const isError = appState === 'error';
  // Replit's embedded preview iframe blocks microphone access.
  const isInsideIframe = window.self !== window.top;

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-b from-[#0d2b1a] to-[#07170e] text-[#f5e6c8] flex flex-col relative overflow-hidden font-sans" dir="rtl">
      {/* 1. Top warning banner */}
      <div className="bg-[#d4a84b]/10 border-b border-[#d4a84b]/20 w-full py-4 text-center z-10 shrink-0 shadow-sm">
        <p className="text-[#d4a84b] text-base md:text-lg font-medium opacity-90 tracking-wide">
          یہ ایک اندازہ ہے، حتمی فیصلہ نہیں
        </p>
      </div>

      {/* Iframe / mic warning — shown when embedded in Replit preview */}
      {isInsideIframe && (
        <div className="bg-amber-900/40 border-b border-amber-600/40 w-full py-2 text-center shrink-0" dir="ltr">
          <p className="text-amber-300 text-xs md:text-sm px-4">
            ⚠️ Microphone is blocked in the embedded preview.{' '}
            <a
              href={window.location.href}
              target="_blank"
              rel="noreferrer"
              className="underline font-semibold hover:text-amber-100"
            >
              Open in a new tab
            </a>{' '}
            to use voice.
          </p>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* 2. App name */}
        <div className="mb-16 text-center">
          <h1 className="text-6xl md:text-8xl font-bold text-[#d4a84b] tracking-wider drop-shadow-[0_0_20px_rgba(212,168,75,0.2)]">
            زبان
          </h1>
        </div>

        {/* 3. Big circular button */}
        <div className="relative flex items-center justify-center mb-12">
          {appState === 'idle' && (
            <div className="absolute inset-0 rounded-full bg-[#d4a84b]/30 animate-ping opacity-75" style={{ animationDuration: '3s' }} />
          )}

          <button
            data-testid="btn-talk"
            onClick={onConnect}
            disabled={isConnecting}
            className="relative flex flex-col items-center justify-center w-48 h-48 md:w-56 md:h-56 rounded-full bg-gradient-to-br from-[#d4a84b] to-[#b88c36] text-[#0d2b1a] shadow-[0_0_50px_rgba(212,168,75,0.4)] transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-90 disabled:hover:scale-100 outline-none focus-visible:ring-4 focus-visible:ring-[#f5e6c8]/50"
          >
            {isConnecting ? (
              <Loader2 className="w-16 h-16 animate-spin text-[#0d2b1a] opacity-80" />
            ) : (
              <span className="text-4xl md:text-5xl font-bold drop-shadow-sm mt-4">بات کریں</span>
            )}
          </button>
        </div>

        {/* 4. Status line */}
        <div className="flex flex-col items-center gap-2 text-center max-w-sm w-full px-4">
          <p
            data-testid="text-status"
            className={`text-xl md:text-2xl font-medium transition-colors duration-300 drop-shadow-md leading-relaxed ${isError ? 'text-red-400' : 'text-[#d4a84b]/80'}`}
          >
            {statusMap[appState]}
          </p>
          {/* Debug detail — shown in English so developers can act on it */}
          {isError && debugMsg && (
            <p
              data-testid="text-debug"
              className="text-xs text-red-300/70 font-mono break-all mt-1 max-w-xs"
              dir="ltr"
            >
              {debugMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
