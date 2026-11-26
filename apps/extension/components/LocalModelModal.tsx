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
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { NanoDetector, NanoAvailability } from '../services/firebase-ai/nanoDetector';

interface LocalModelModalProps {
  onClose: () => void;
}

interface SetupStep {
  title: string;
  detail: string;
  copyText?: string;
  badge?: string;
}

const CHROME_NANO_STEPS: SetupStep[] = [
  {
    title: '1. Enable Chrome Prompt API',
    detail:
      'Open this flag URL in Chrome, set it to "Enabled", then restart Chrome:',
    copyText: 'chrome://flags/#prompt-api-for-gemini-nano',
    badge: 'Required',
  },
  {
    title: '2. Bypass Performance Check (Crucial for Execution Config)',
    detail:
      'Open this flag and select "Enabled BypassPerfRequirement". This prevents Chrome from withholding the execution config on Linux, Mac, or laptop GPUs:',
    copyText: 'chrome://flags/#optimization-guide-on-device-model',
    badge: 'Fixes Config Error',
  },
  {
    title: '3. Download Model Weights in Components',
    detail:
      'Open chrome://components, find "Optimization Guide On Device Model", and click "Check for update" until the version updates from 0.0.0.0:',
    copyText: 'chrome://components',
    badge: 'Components',
  },
  {
    title: '4. Check Diagnostics (Optional)',
    detail:
      'Open chrome://on-device-internals to inspect model loading and GPU status:',
    copyText: 'chrome://on-device-internals',
    badge: 'Diagnostics',
  },
];

export const LocalModelModal: React.FC<LocalModelModalProps> = ({ onClose }) => {
  const [nanoStatus, setNanoStatus] = useState<NanoAvailability | null>(null);
  const [checking, setChecking] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [testing, setTesting] = useState(false);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const refreshStatus = async () => {
    setChecking(true);
    try {
      const status = await NanoDetector.checkAvailability();
      setNanoStatus(status);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const handleCopy = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedKey(text);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setCopiedKey(text);
      setTimeout(() => setCopiedKey(null), 2000);
    }
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
      if (res.status === 'ready') {
        setTestOutput('✅ Model is ready on-device! You can run "Test Local" now.');
      } else {
        setTestOutput(res.message);
      }
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
        'Confirm on-device Gemini Nano inference is working in 10 words or less.'
      );
      const ms = Math.round(performance.now() - started);
      setTestOutput(`⚡ Local on-device reply (${ms}ms): "${reply}"`);
      await refreshStatus();
    } catch (err: any) {
      setTestOutput(`Local test notice: ${err?.message || String(err)}`);
    } finally {
      setTesting(false);
    }
  };

  const isExecutionConfigMissing =
    nanoStatus?.message.toLowerCase().includes('execution config') ||
    testOutput?.toLowerCase().includes('execution config');

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
      <div className="bg-white rounded-t-3xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4 text-zinc-900 border-t border-zinc-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 id="local-model-title" className="font-semibold text-sm text-zinc-950 tracking-tight">
                Local AI Model (Gemini Nano)
              </h2>
              <p className="text-[10px] text-zinc-500">100% on-device private processing</p>
            </div>
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

        {/* Local Gemini Nano Status & Download Trigger */}
        <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-semibold text-zinc-900">Chrome Built-in AI Status</span>
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
            <p className="text-zinc-700 leading-relaxed text-[11px]">
              {checking
                ? 'Checking Chrome Built-in AI Prompt API...'
                : nanoStatus?.message || 'Unable to detect local model.'}
            </p>
          </div>

          {/* Quick Troubleshooting Tip for Execution Config */}
          {isExecutionConfigMissing && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 space-y-1 text-[11px]">
              <div className="font-semibold flex items-center space-x-1">
                <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                <span>Fixing "Execution Config" Error:</span>
              </div>
              <p className="text-[10px] leading-normal text-amber-800">
                Chrome needs the performance requirement bypassed to load local weights:
              </p>
              <div className="space-y-1 pt-0.5">
                <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-amber-200 text-[10px]">
                  <span className="truncate">chrome://flags/#optimization-guide-on-device-model</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('chrome://flags/#optimization-guide-on-device-model')}
                    className="font-semibold text-emerald-700 hover:text-emerald-900 ml-2"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-[10px] text-amber-700">
                  Set to <strong>Enabled BypassPerfRequirement</strong>, restart Chrome, and click "Check for update" in <code>chrome://components</code>.
                </p>
              </div>
            </div>
          )}

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
            <div className="p-2.5 rounded-lg bg-white border border-zinc-200 text-[11px] text-zinc-800 leading-relaxed font-mono">
              {testOutput}
            </div>
          )}
        </div>

        {/* Step-by-Step Guide */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Step-by-Step Chrome Setup Guide
            </h3>
            <span className="text-[10px] text-zinc-400">Paste in address bar</span>
          </div>

          <div className="space-y-2">
            {CHROME_NANO_STEPS.map((step) => (
              <div
                key={step.title}
                className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-zinc-900">{step.title}</div>
                  {step.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                      {step.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-600 leading-normal">{step.detail}</p>
                {step.copyText && (
                  <div className="flex items-center justify-between gap-2 bg-white border border-zinc-200 rounded-lg px-2 py-1">
                    <code className="text-[10px] text-zinc-800 truncate select-all">{step.copyText}</code>
                    <button
                      type="button"
                      onClick={() => handleCopy(step.copyText!)}
                      className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-900 flex items-center space-x-1 flex-shrink-0 cursor-pointer"
                    >
                      {copiedKey === step.copyText ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600">Copied!</span>
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
