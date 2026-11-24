import React, { useEffect, useState } from 'react';
import { UserPreferences } from '../types';
import { X, Volume2, Type, Eye, Zap, HelpCircle, Cpu, Cloud, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { NanoDetector, NanoAvailability } from '../services/firebase-ai/nanoDetector';

interface AccessibilitySettingsProps {
  preferences: UserPreferences;
  onUpdate: (prefs: Partial<UserPreferences>) => void;
  onClose: () => void;
}

export const AccessibilitySettings: React.FC<AccessibilitySettingsProps> = ({
  preferences,
  onUpdate,
  onClose,
}) => {
  const [nanoStatus, setNanoStatus] = useState<NanoAvailability | null>(null);

  useEffect(() => {
    async function check() {
      const res = await NanoDetector.checkAvailability();
      setNanoStatus(res);
    }
    check();
  }, []);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      className="fixed inset-0 z-30 bg-black/40 flex flex-col justify-end"
    >
      <div className="bg-white rounded-t-2xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5 text-gray-900">
        <div className="flex items-center justify-between border-b pb-3 border-gray-200">
          <div className="flex items-center space-x-2">
            <Eye className="w-5 h-5 text-recare-600" />
            <h2 id="settings-title" className="font-bold text-base text-gray-900">
              Accessibility & Preferences
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100"
            aria-label="Close preferences"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hybrid AI & Gemini Nano 4 Section (Google #BuildHybridAI) */}
        <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                Hybrid AI Logic & Gemini Nano 4
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 font-bold">
              #BuildHybridAI
            </span>
          </div>

          <div className="p-2.5 bg-white/80 rounded-lg border border-emerald-100 text-xs space-y-1.5">
            <div className="flex items-center space-x-1.5 font-semibold text-gray-800">
              {nanoStatus?.available ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>Device Status: {nanoStatus?.status.toUpperCase() || 'CHECKING...'}</span>
            </div>
            <p className="text-[11px] text-gray-600 leading-normal">
              {nanoStatus?.message || 'Detecting Chrome Built-in AI support...'}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-emerald-900 block">
              Inference Mode Strategy:
            </label>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {[
                { id: 'PREFER_ON_DEVICE', label: 'Hybrid (Nano 1st)', desc: 'Tries Nano 4, falls back to Cloud' },
                { id: 'ONLY_ON_DEVICE', label: 'On-Device Only', desc: 'Strict local privacy' },
                { id: 'PREFER_IN_CLOUD', label: 'Cloud Preferred', desc: 'Fast cloud model' },
                { id: 'ONLY_IN_CLOUD', label: 'Cloud Only', desc: 'Full cloud execution' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdate({ inference_mode: opt.id as any })}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    preferences.inference_mode === opt.id
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm font-semibold'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-emerald-50'
                  }`}
                >
                  <div className="font-bold text-[11px]">{opt.label}</div>
                  <div className={`text-[10px] ${preferences.inference_mode === opt.id ? 'text-emerald-100' : 'text-gray-500'}`}>
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Text Size */}
        <div className="space-y-2">
          <label className="flex items-center space-x-2 text-xs font-bold text-gray-700 uppercase tracking-wide">
            <Type className="w-4 h-4" />
            <span>Interface Text Size</span>
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onUpdate({ text_size: size })}
                className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  preferences.text_size === size
                    ? 'bg-recare-600 text-white border-recare-600 shadow-sm'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {size.charAt(0).toUpperCase() + size.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Speech Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="speech-rate-slider"
              className="flex items-center space-x-2 text-xs font-bold text-gray-700 uppercase tracking-wide"
            >
              <Volume2 className="w-4 h-4" />
              <span>Voice Speech Rate</span>
            </label>
            <span className="text-xs font-mono font-bold text-recare-700">
              {preferences.speech_rate.toFixed(1)}x
            </span>
          </div>
          <input
            id="speech-rate-slider"
            type="range"
            min="0.5"
            max="1.75"
            step="0.25"
            value={preferences.speech_rate}
            onChange={(e) => onUpdate({ speech_rate: parseFloat(e.target.value) })}
            className="w-full accent-recare-600"
            aria-label="Adjust voice speech rate"
          />
        </div>

        {/* Cognitive Simplification */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
          <div>
            <div className="font-semibold text-xs text-gray-900">Simplified Language</div>
            <div className="text-[11px] text-gray-500">Plain explanations with reduced technical jargon</div>
          </div>
          <input
            type="checkbox"
            checked={preferences.simplified_language}
            onChange={(e) => onUpdate({ simplified_language: e.target.checked })}
            className="w-4 h-4 accent-recare-600 rounded"
            aria-label="Toggle simplified language"
          />
        </div>

        {/* High Contrast */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
          <div>
            <div className="font-semibold text-xs text-gray-900">High Visual Contrast</div>
            <div className="text-[11px] text-gray-500">Enhanced borders and dark text contrast</div>
          </div>
          <input
            type="checkbox"
            checked={preferences.high_contrast}
            onChange={(e) => onUpdate({ high_contrast: e.target.checked })}
            className="w-4 h-4 accent-recare-600 rounded"
            aria-label="Toggle high visual contrast"
          />
        </div>

        {/* Reduced Motion */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
          <div>
            <div className="font-semibold text-xs text-gray-900">Reduced Motion</div>
            <div className="text-[11px] text-gray-500">Disable UI transitions and smooth scrolling</div>
          </div>
          <input
            type="checkbox"
            checked={preferences.reduced_motion}
            onChange={(e) => onUpdate({ reduced_motion: e.target.checked })}
            className="w-4 h-4 accent-recare-600 rounded"
            aria-label="Toggle reduced motion"
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors shadow"
        >
          Done
        </button>
      </div>
    </div>
  );
};
