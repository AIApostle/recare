import React from 'react';
import { UserPreferences } from '../types';
import { X, Volume2, Type, Eye, VolumeX, Sparkles, Contrast, Activity } from 'lucide-react';
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
  const handleTestSpeech = () => {
    VoiceService.speak('This is a test of your voice speed setting.', preferences.speech_rate);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      className="fixed inset-0 z-30 bg-zinc-950/40 backdrop-blur-sm flex flex-col justify-end"
    >
      <div className="bg-white rounded-t-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto space-y-6 text-zinc-900 border-t border-zinc-200/80 animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
            <h2 id="settings-title" className="font-semibold text-base text-zinc-950 tracking-tight">
              Accessibility & Display
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
            aria-label="Close preferences"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Text Size Scale */}
        <div className="space-y-2.5">
          <label className="flex items-center space-x-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            <Type className="w-3.5 h-3.5" />
            <span>Text Scale</span>
          </label>
          <div className="grid grid-cols-4 gap-1.5 bg-zinc-100/80 p-1 rounded-2xl border border-zinc-200/50">
            {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => {
              const labels = { small: 'Small', medium: 'Default', large: 'Large', xlarge: 'XL' };
              const isSelected = preferences.text_size === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => onUpdate({ text_size: size })}
                  className={`py-2 text-xs font-medium rounded-xl transition-all ${
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

        {/* Speech Rate Slider & Preview */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="speech-rate-slider"
              className="flex items-center space-x-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Voice Speech Rate</span>
            </label>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleTestSpeech}
                className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md transition-colors"
              >
                Preview
              </button>
              <span className="text-xs font-mono font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded-md">
                {preferences.speech_rate.toFixed(2)}x
              </span>
            </div>
          </div>
          <input
            id="speech-rate-slider"
            type="range"
            min="0.5"
            max="1.75"
            step="0.25"
            value={preferences.speech_rate}
            onChange={(e) => onUpdate({ speech_rate: parseFloat(e.target.value) })}
            className="w-full accent-emerald-600 h-1.5 bg-zinc-200 rounded-lg cursor-pointer"
            aria-label="Adjust voice speech rate"
          />
          <div className="flex justify-between text-[10px] text-zinc-400 font-medium px-0.5">
            <span>Slower (0.5x)</span>
            <span>Normal (1.0x)</span>
            <span>Faster (1.75x)</span>
          </div>
        </div>

        {/* Experience Toggles */}
        <div className="space-y-2 pt-1">
          <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
            Assistance Preferences
          </label>

          {/* Simplified Language */}
          <label className="flex items-center justify-between p-3.5 bg-zinc-50/80 hover:bg-zinc-50 rounded-2xl border border-zinc-200/80 cursor-pointer transition-colors">
            <div className="space-y-0.5 pr-3">
              <div className="flex items-center space-x-1.5 font-medium text-xs text-zinc-900">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Simplified Language</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-normal">
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
          <label className="flex items-center justify-between p-3.5 bg-zinc-50/80 hover:bg-zinc-50 rounded-2xl border border-zinc-200/80 cursor-pointer transition-colors">
            <div className="space-y-0.5 pr-3">
              <div className="flex items-center space-x-1.5 font-medium text-xs text-zinc-900">
                <Contrast className="w-3.5 h-3.5 text-zinc-700" />
                <span>High Visual Contrast</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-normal">
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
          <label className="flex items-center justify-between p-3.5 bg-zinc-50/80 hover:bg-zinc-50 rounded-2xl border border-zinc-200/80 cursor-pointer transition-colors">
            <div className="space-y-0.5 pr-3">
              <div className="flex items-center space-x-1.5 font-medium text-xs text-zinc-900">
                <Activity className="w-3.5 h-3.5 text-zinc-700" />
                <span>Reduced Motion</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-normal">
                Disables unnecessary animations and micro-transitions
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
          className="w-full py-3 bg-zinc-950 hover:bg-zinc-900 text-white text-xs font-semibold rounded-2xl transition-all shadow-sm active:scale-[0.98]"
        >
          Save & Close
        </button>
      </div>
    </div>
  );
};
