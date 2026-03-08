
import React from 'react';
import { GameStep } from '../types';
import { STEP_ORDER } from '../constants';

interface ProgressBarProps {
  currentStep: GameStep;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep }) => {
  const currentIndex = STEP_ORDER.indexOf(currentStep);
  const totalSteps = STEP_ORDER.length - 1; // Exclude the end step
  const progress = Math.max(0, (currentIndex / totalSteps) * 100);

  return (
    <div className="w-full px-6 py-4 bg-white/50 backdrop-blur-sm sticky top-0 z-10 border-b border-purple-100">
      <div className="flex justify-between text-xs text-purple-400 font-medium mb-2 uppercase tracking-widest">
        <span>Awareness</span>
        <span>{currentIndex + 1} of {totalSteps + 1}</span>
        <span>Integration</span>
      </div>
      <div className="w-full bg-purple-100 rounded-full h-1.5 overflow-hidden">
        <div 
          className="bg-gradient-to-r from-purple-300 to-indigo-300 h-full transition-all duration-700 ease-in-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
