import React, { useState, useEffect } from 'react';
import { UserPreferences } from '../types';
import { X, Volume2, Type, Eye, Sparkles, Contrast, Activity, Check, Cpu, ShieldCheck } from 'lucide-react';
import { VoiceService } from '../services/voice';

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
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const list = VoiceService.getAvailableVoices();
    if (list.length > 0) {
      setVoices(list);
    } else if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        setVoices(VoiceService.getAvailableVoices());
      };
    }
  }, []);

  const handleTestSpeech = (rate?: number) => {
    const r = rate ?? preferences.speech_rate;
    VoiceService.speak(
      `This is a live preview of your voice speed at ${r.toFixed(2)}x.`,
      r,
      undefined,
      preferences.voice_gender !== 'neutral' ? preferences.voice_gender : undefined
    );
  };

  const speechRatePresets = [
    { label: '0.75x (Slow)', value: 0.75 },
    { label: '1.0x (Normal)', value: 1.0 },
    { label: '1.25x (Fast)', value: 1.25 },
    { label: '1.5x (Brisk)', value: 1.5 },
    { label: '1.75x (Rapid)', value: 1.75 },
    { label: '2.0x (Max)', value: 2.0 },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      className="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-sm flex flex-col justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-t-3xl p-5 shadow-2xl max-h-[88vh] overflow-y-auto space-y-5 text-zinc-900 border-t border-zinc-200 animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
            <h2 id="settings-title" className="font-semibold text-base text-zinc-950 tracking-tight">
              Accessibility & Preferences
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
            aria-label="Close preferences"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Text Size Scale (Live UI Zoom) */}
        <div className="space-y-2">
          <label className="flex items-center space-x-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            <Type className="w-3.5 h-3.5 text-zinc-700" />
            <span>Interface & Text Scale</span>
          </label>
          <div className="grid grid-cols-4 gap-1.5 bg-zinc-100 p-1 rounded-xl border border-zinc-200/60">
            {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => {
              const labels = { small: 'Small', medium: 'Default', large: 'Large', xlarge: 'XL' };
              const isSelected = preferences.text_size === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => onUpdate({ text_size: size })}
                  className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white text-zinc-950 shadow-sm font-semibold'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  {labels[size]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Speech Rate Slider & Presets */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="speech-rate-slider"
              className="flex items-center space-x-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider"
            >
              <Volume2 className="w-3.5 h-3.5 text-zinc-700" />
              <span>Voice Speech Rate</span>
            </label>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleTestSpeech()}
                className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-0.5 rounded-md transition-colors cursor-pointer"
              >
                ▶ Test Voice
              </button>
              <span className="text-xs font-mono font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200">
                {preferences.speech_rate.toFixed(2)}x
              </span>
            </div>
          </div>

          {/* Continuous Granular Slider (0.50x to 2.00x) */}
          <input
            id="speech-rate-slider"
            type="range"
            min="0.5"
            max="2.0"
            step="0.05"
            value={preferences.speech_rate}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onUpdate({ speech_rate: val });
            }}
            className="w-full accent-emerald-600 h-2 bg-zinc-200 rounded-lg cursor-pointer"
            aria-label="Adjust voice speech rate"
          />

          {/* Quick-Select Speed Presets */}
          <div className="grid grid-cols-3 gap-1">
            {speechRatePresets.map((preset) => {
              const isActive = Math.abs(preferences.speech_rate - preset.value) < 0.02;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => {
                    onUpdate({ speech_rate: preset.value });
                    handleTestSpeech(preset.value);
                  }}
                  className={`text-[10px] font-medium py-1 px-1.5 rounded-md border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-xs'
                      : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Voice Selection Dropdown if available */}
        {voices.length > 0 && (
          <div className="space-y-1.5">
            <label
              htmlFor="voice-select"
              className="flex items-center space-x-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider"
            >
              <Volume2 className="w-3.5 h-3.5 text-zinc-700" />
              <span>Speech Voice</span>
            </label>
            <select
              id="voice-select"
              value={preferences.voice_gender || 'neutral'}
              onChange={(e) => onUpdate({ voice_gender: e.target.value })}
              className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-2 text-zinc-900 font-medium focus:border-zinc-800"
            >
              <option value="neutral">System Default Voice</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Response Output Mode (Audio / Text / Both) */}
        <div className="space-y-2">
          <label className="flex items-center space-x-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            <Volume2 className="w-3.5 h-3.5 text-zinc-700" />
            <span>Response Output Mode</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-zinc-100 p-1 rounded-xl border border-zinc-200/60">
            {[
              { id: 'both', label: 'Voice & Text', desc: 'Audio + visual response' },
              { id: 'text', label: 'Text Only', desc: 'Silent visual response' },
              { id: 'voice', label: 'Voice Only', desc: 'Audio priority' },
            ].map((mode) => {
              const isSelected = (preferences.response_output_mode || 'both') === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    if (mode.id === 'text') VoiceService.stopSpeaking();
                    onUpdate({ response_output_mode: mode.id as any });
                  }}
                  className={`py-1.5 px-1 text-center text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white text-zinc-950 shadow-sm font-semibold'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                  title={mode.desc}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* AI Inference Mode */}
        <div className="space-y-2">
          <label className="flex items-center space-x-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            <Cpu className="w-3.5 h-3.5 text-zinc-700" />
            <span>AI Reasoning Engine</span>
          </label>
          <div className="grid grid-cols-2 gap-1.5 bg-zinc-100 p-1 rounded-xl border border-zinc-200/60">
            {[
              { id: 'PREFER_IN_CLOUD', label: 'Hybrid Cloud (Fast)' },
              { id: 'ONLY_IN_CLOUD', label: 'Cloud Only (Direct)' },
            ].map((mode) => {
              const isSelected = (preferences.inference_mode || 'PREFER_IN_CLOUD') === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onUpdate({ inference_mode: mode.id as any })}
                  className={`py-1.5 px-2 text-center text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white text-zinc-950 shadow-sm font-semibold'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Experience & Safety Toggles */}
        <div className="space-y-2 pt-1">
          <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
            Assistance & Behavior
          </label>

          {/* Auto-Approve Safe Actions */}
          <label className="flex items-center justify-between p-3 bg-zinc-50 hover:bg-zinc-100/80 rounded-xl border border-zinc-200 cursor-pointer transition-colors">
            <div className="space-y-0.5 pr-3">
              <div className="flex items-center space-x-1.5 font-medium text-xs text-zinc-900">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Auto-Approve Safe Navigation</span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-normal">
                Executes low-risk clicks and scrolls automatically without prompting for confirmation
              </p>
            </div>
            <input
              type="checkbox"
              checked={preferences.auto_approve_low_risk !== false}
              onChange={(e) => onUpdate({ auto_approve_low_risk: e.target.checked })}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              aria-label="Toggle auto-approve safe actions"
            />
          </label>

          {/* Simplified Language */}
          <label className="flex items-center justify-between p-3 bg-zinc-50 hover:bg-zinc-100/80 rounded-xl border border-zinc-200 cursor-pointer transition-colors">
            <div className="space-y-0.5 pr-3">
              <div className="flex items-center space-x-1.5 font-medium text-xs text-zinc-900">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Simplified Language</span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-normal">
                Explains interface elements and instructions in plain, jargon-free sentences
              </p>
            </div>
            <input
              type="checkbox"
              checked={preferences.simplified_language}
              onChange={(e) => onUpdate({ simplified_language: e.target.checked })}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              aria-label="Toggle simplified language"
            />
          </label>

          {/* High Contrast */}
          <label className="flex items-center justify-between p-3 bg-zinc-50 hover:bg-zinc-100/80 rounded-xl border border-zinc-200 cursor-pointer transition-colors">
            <div className="space-y-0.5 pr-3">
              <div className="flex items-center space-x-1.5 font-medium text-xs text-zinc-900">
                <Contrast className="w-3.5 h-3.5 text-zinc-700" />
                <span>High Visual Contrast</span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-normal">
                Enhances control outlines, borders, and text contrast for maximum visibility
              </p>
            </div>
            <input
              type="checkbox"
              checked={preferences.high_contrast}
              onChange={(e) => onUpdate({ high_contrast: e.target.checked })}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              aria-label="Toggle high visual contrast"
            />
          </label>

          {/* Reduced Motion */}
          <label className="flex items-center justify-between p-3 bg-zinc-50 hover:bg-zinc-100/80 rounded-xl border border-zinc-200 cursor-pointer transition-colors">
            <div className="space-y-0.5 pr-3">
              <div className="flex items-center space-x-1.5 font-medium text-xs text-zinc-900">
                <Activity className="w-3.5 h-3.5 text-zinc-700" />
                <span>Reduced Motion</span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-normal">
                Disables unnecessary animations, pulsing indicators, and micro-transitions
              </p>
            </div>
            <input
              type="checkbox"
              checked={preferences.reduced_motion}
              onChange={(e) => onUpdate({ reduced_motion: e.target.checked })}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              aria-label="Toggle reduced motion"
            />
          </label>
        </div>

        {/* Done Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-900 text-white text-xs font-semibold rounded-xl transition-all shadow-sm active:scale-[0.98] cursor-pointer"
        >
          Save & Close
        </button>
      </div>
    </div>
  );
};
