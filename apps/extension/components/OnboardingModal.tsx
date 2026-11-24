import React, { useState } from 'react';
import { Eye, Shield, Compass, Sparkles, Check } from 'lucide-react';

interface OnboardingModalProps {
  onFinish: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onFinish }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: 'Welcome to Recare',
      subtitle: 'Your universal AI browser agent and accessibility copilot.',
      description:
        'Recare helps you understand unfamiliar websites, navigate complex pages, and complete everyday tasks through text, voice, or guided assistance.',
      icon: <Sparkles className="w-8 h-8 text-recare-600" />,
    },
    {
      title: 'Understand & Guide',
      subtitle: 'Accessible page explanations.',
      description:
        'Ask "What am I looking at?" anytime. Recare scans accessible controls, headings, and menus, and can visually highlight buttons or explain complex terminology.',
      icon: <Eye className="w-8 h-8 text-recare-600" />,
    },
    {
      title: 'Controlled Execution & Safety',
      subtitle: 'You are always in control.',
      description:
        'Recare can fill forms, click buttons, and guide multi-step workflows. Consequential actions (like submitting payments or applications) always ask for your explicit confirmation first.',
      icon: <Shield className="w-8 h-8 text-amber-600" />,
    },
  ];

  const current = steps[step];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-recare-50 flex items-center justify-center">
          {current.icon}
        </div>

        <h2 id="onboarding-title" className="text-base font-bold text-gray-900">
          {current.title}
        </h2>
        <div className="text-xs font-semibold text-recare-700">{current.subtitle}</div>
        <p className="text-xs text-gray-600 leading-relaxed">{current.description}</p>

        <div className="flex justify-center space-x-1.5 pt-2">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === step ? 'w-5 bg-recare-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <div className="pt-2">
          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="w-full py-2.5 bg-recare-600 hover:bg-recare-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={onFinish}
              className="w-full py-2.5 bg-recare-600 hover:bg-recare-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Get Started</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
