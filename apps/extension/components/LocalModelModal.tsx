import React, { useEffect, useState } from 'react';
import {
  X,
  Cpu,
  Download,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Cloud,
  Sparkles,
} from 'lucide-react';
import { NanoDetector, NanoAvailability } from '../services/firebase-ai/nanoDetector';
import { getApiBaseUrl } from '../services/api';

interface LocalModelModalProps {
  isBackendConnected: boolean;
  onRetryBackend: () => Promise<boolean>;
  onClose: () => void;
}

interface SetupStep {
  title: string;
  detail: string;
  copyText?: string;
}

const CHROME_NANO_STEPS: SetupStep[] = [
  {
    title: '1. Enable Chrome Prompt API',
    detail: 'Paste this flag URL in Chrome, set it to Enabled:',
    copyText: 'chrome://flags/#prompt-api-for-gemini-nano',
  },
  {
    title: '2. Enable On-Device Model Optimization',
    detail: 'Set this flag to "Enabled BypassPerfRequirement" (important!):',
    copyText: 'chrome://flags/#optimization-guide-on-device-model',
  },
  {
    title: '3. Relaunch Chrome',
    detail: 'Click the blue Relaunch button at the bottom of Chrome after setting both flags.',
  },
  {
    title: '4. Download Model Weights (~1.5–2.5 GB)',
    detail:
      'Click "Download Local Model" above, or open chrome://components, find "Optimization Guide On Device Model" (not Manifest), and click "Check for update".',
    copyText: 'chrome://components',
  },
];

export const LocalModelModal: React.FC<LocalModelModalProps> = ({
  isBackendConnected,
  onRetryBackend,
  onClose,
}) => {
  const [nanoStatus, setNanoStatus] = useState<NanoAvailability | null>(null);
  const [apiUrl, setApiUrl] = useState<string>('https://recare.onrender.com');
  const [checking, setChecking] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [testing, setTesting] = useState(false);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [checkingBackend, setCheckingBackend] = useState(false);

  const refreshStatus = async () => {
    setChecking(true);
    try {
      const [status, url] = await Promise.all([
        NanoDetector.checkAvailability(),
        getApiBaseUrl(),
      ]);
      setNanoStatus(status);
      setApiUrl(url);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(text);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {}
  };

  const handleDownloadModel = async () => {
    setDownloading(true);
    setProgress(5);
    setTestOutput(null);
    try {
      const res = await NanoDetector.downloadAndInitialize((pct) => {
        setProgress(pct);
      });
      setNanoStatus(res);
    } finally {
      setDownloading(false);
    }
  };

  const handleTestLocal = async () => {
    setTesting(true);
    setTestOutput(null);
    const started = performance.now();
    try {
      const reply = await NanoDetector.runLocalPrompt(
        'Reply in one short sentence confirming local Gemini Nano inference works.'
      );
      const ms = Math.round(performance.now() - started);
      setTestOutput(`⚡ Local reply (${ms}ms): ${reply}`);
      await refreshStatus();
    } catch (err: any) {
      setTestOutput(`Local test failed: ${err?.message || String(err)}`);
    } finally {
      setTesting(false);
    }
  };

  const handleRetryBackend = async () => {
    setCheckingBackend(true);
    try {
      await onRetryBackend();
    } finally {
      setCheckingBackend(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="local-model-title"
      className="fixed inset-0 z-50 bg-zinc-950/45 backdrop-blur-sm flex flex-col justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-t-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4 text-zinc-900 border-t border-zinc-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <h2 id="local-model-title" className="font-semibold text-base text-zinc-950 tracking-tight">
              Cloud & Local AI (Gemini Nano)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
            aria-label="Close setup modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cloud (Render) Status Card */}
        <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Cloud className="w-4 h-4 text-sky-600" />
              <span className="text-xs font-semibold text-zinc-900">Primary Cloud Backend</span>
            </div>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                isBackendConnected
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isBackendConnected ? 'Connected' : 'Unreachable / Waking'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
            <code className="truncate bg-white px-2 py-0.5 rounded border border-zinc-200 text-zinc-700">
              {apiUrl}
            </code>
            <button
              type="button"
              onClick={handleRetryBackend}
              disabled={checkingBackend}
              className="flex items-center space-x-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg cursor-pointer flex-shrink-0"
            >
              <RefreshCw className={`w-3 h-3 ${checkingBackend ? 'animate-spin' : ''}`} />
              <span>{checkingBackend ? 'Checking...' : 'Check Health'}</span>
            </button>
          </div>
        </div>

        {/* Local Gemini Nano Status & Download Trigger */}
        <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-semibold text-zinc-900">On-Device Fallback (Gemini Nano)</span>
            </div>
            <button
              type="button"
              onClick={refreshStatus}
              disabled={checking}
              className="text-[11px] text-zinc-500 hover:text-zinc-900 flex items-center space-x-1 cursor-pointer"
              title="Re-check local model status"
            >
              <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="flex items-start space-x-2 text-xs">
            {nanoStatus?.status === 'ready' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            )}
            <p className="text-zinc-700 leading-relaxed">
              {checking
                ? 'Checking Chrome Built-in AI availability...'
                : nanoStatus?.message || 'Unable to detect local model.'}
            </p>
          </div>

          {downloading && (
            <div className="space-y-1">
              <div className="w-full h-2 bg-emerald-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${Math.max(8, progress)}%` }}
                />
              </div>
              <div className="text-[10px] text-emerald-800 font-medium text-right">
                Initializing / Downloading: {progress}%
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleDownloadModel}
              disabled={downloading}
              className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {downloading
                  ? 'Downloading...'
                  : nanoStatus?.status === 'ready'
                  ? 'Verify / Warm Local Model'
                  : 'Download Local Model'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleTestLocal}
              disabled={testing || downloading}
              className="py-2 px-3 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-800 text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              {testing ? 'Testing...' : 'Test Local'}
            </button>
          </div>

          {testOutput && (
            <div className="p-2.5 rounded-lg bg-white border border-zinc-200 text-[11px] text-zinc-800 leading-relaxed">
              {testOutput}
            </div>
          )}
        </div>

        {/* Step-by-Step Guide */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Step-by-Step Chrome Setup Guide
          </h3>
          <div className="space-y-2">
            {CHROME_NANO_STEPS.map((step) => (
              <div
                key={step.title}
                className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-1.5"
              >
                <div className="text-xs font-semibold text-zinc-900">{step.title}</div>
                <p className="text-[11px] text-zinc-600 leading-normal">{step.detail}</p>
                {step.copyText && (
                  <div className="flex items-center justify-between gap-2 bg-white border border-zinc-200 rounded-lg px-2 py-1">
                    <code className="text-[10px] text-zinc-800 truncate">{step.copyText}</code>
                    <button
                      type="button"
                      onClick={() => handleCopy(step.copyText!)}
                      className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-900 flex items-center space-x-1 flex-shrink-0 cursor-pointer"
                    >
                      {copiedKey === step.copyText ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-900 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
};
