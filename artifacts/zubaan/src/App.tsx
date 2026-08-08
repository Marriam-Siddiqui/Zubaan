import { useState } from 'react';
import { UpliftAIRoom, type ToolConfig } from '@upliftai/assistants-react';
import { useVoiceAssistant, BarVisualizer } from '@livekit/components-react';
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

  const assistantId = import.meta.env.VITE_ASSISTANT_ID as string;

  const handleConnect = async () => {
    setAppState('connecting');
    setErrorMsg('');

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMsg('مائیکروفون کی اجازت نہیں ملی۔ براہ کرم اجازت دیں اور دوبارہ کوشش کریں۔');
      setAppState('error');
      return;
    }

    try {
      const res = await fetch(
        `https://api.upliftai.org/v1/realtime-assistants/${assistantId}/createPublicSession`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantName: 'user' }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSessionData({ token: data.token, wsUrl: data.wsUrl });
      setAppState('connected');
    } catch {
      setErrorMsg('کنکشن ناکام ہوگیا۔ براہ کرم دوبارہ کوشش کریں۔');
      setAppState('error');
    }
  };

  const handleDisconnect = () => {
    setSessionData(null);
    setAppState('idle');
    setErrorMsg('');
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
      >
        <ConnectedScreen onDisconnect={handleDisconnect} />
      </UpliftAIRoom>
    );
  }

  return (
    <IdleScreen
      appState={appState}
      errorMsg={errorMsg}
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

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-b from-[#0d2b1a] to-[#07170e] text-[#f5e6c8] flex flex-col relative overflow-hidden font-sans" dir="rtl">
      {/* 1. Top warning banner */}
      <div className="bg-[#d4a84b]/10 border-b border-[#d4a84b]/20 w-full py-4 text-center z-10 shrink-0 shadow-sm">
        <p className="text-[#d4a84b] text-base md:text-lg font-medium opacity-90 tracking-wide">
          یہ ایک اندازہ ہے، حتمی فیصلہ نہیں
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-between py-12 px-6">
        {/* 2. App name */}
        <h1 className="text-4xl md:text-5xl font-bold text-[#d4a84b] tracking-wide opacity-50 drop-shadow-sm">
          زبان
        </h1>

        {/* 3. BarVisualizer */}
        <div className="w-full flex-1 flex flex-col items-center justify-center min-h-[200px]">
          {audioTrack ? (
            <div className="h-32 md:h-48 w-full max-w-sm flex items-center justify-center text-[#d4a84b]">
              <BarVisualizer
                trackRef={audioTrack}
                barCount={7}
                options={{ minHeight: 10 }}
                className="w-full h-full opacity-90 drop-shadow-[0_0_15px_rgba(212,168,75,0.4)]"
              />
            </div>
          ) : (
            <div className="h-32 md:h-48 w-full max-w-sm flex items-center justify-center gap-3 opacity-50">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div 
                  key={i} 
                  className="w-3 h-3 bg-[#d4a84b] rounded-full animate-pulse" 
                  style={{ animationDelay: `${i * 100}ms` }} 
                />
              ))}
            </div>
          )}

          {/* 4. Status text */}
          <p 
            data-testid="text-status"
            className="text-2xl md:text-3xl font-medium text-[#d4a84b] mt-8 text-center animate-in fade-in zoom-in duration-500 drop-shadow-md"
          >
            {statusText}
          </p>
        </div>

        {/* 5. Disconnect button */}
        <button
          data-testid="btn-disconnect"
          onClick={onDisconnect}
          className="mt-8 px-10 py-4 rounded-full bg-[#174a2b]/80 text-[#f5e6c8]/90 hover:bg-[#1f5936] hover:text-[#f5e6c8] hover:shadow-lg transition-all duration-300 border border-[#1f5936] text-xl font-medium active:scale-95"
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
  onConnect,
}: {
  appState: AppState;
  errorMsg: string;
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

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-b from-[#0d2b1a] to-[#07170e] text-[#f5e6c8] flex flex-col relative overflow-hidden font-sans" dir="rtl">
      {/* 1. Top warning banner */}
      <div className="bg-[#d4a84b]/10 border-b border-[#d4a84b]/20 w-full py-4 text-center z-10 shrink-0 shadow-sm">
        <p className="text-[#d4a84b] text-base md:text-lg font-medium opacity-90 tracking-wide">
          یہ ایک اندازہ ہے، حتمی فیصلہ نہیں
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* 2. App name */}
        <div className="mb-20 text-center">
          <h1 className="text-6xl md:text-8xl font-bold text-[#d4a84b] tracking-wider drop-shadow-[0_0_20px_rgba(212,168,75,0.2)]">
            زبان
          </h1>
        </div>

        {/* 3. Big circular button */}
        <div className="relative group flex items-center justify-center mb-16">
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
        <div className="h-20 flex items-center justify-center text-center max-w-md w-full px-4">
          <p 
            data-testid="text-status"
            className={`text-2xl md:text-3xl font-medium transition-colors duration-300 drop-shadow-md leading-relaxed ${isError ? 'text-[#c0392b]' : 'text-[#d4a84b]/80'}`}
          >
            {statusMap[appState]}
          </p>
        </div>
      </div>
    </div>
  );
}
