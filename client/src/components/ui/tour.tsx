import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface TourStep {
  target: string;
  content: string;
  title?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface TourProps {
  steps: TourStep[];
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function Tour({ steps, isOpen, onComplete, onSkip }: TourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen && steps[currentStep]) {
      const element = document.querySelector(steps[currentStep].target) as HTMLElement;
      setTargetElement(element);
    }
  }, [currentStep, isOpen, steps]);

  const handleNext = () => {
    if (currentStep === steps.length - 1) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  if (!isOpen || !targetElement) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 z-50">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="relative"
        >
          <TooltipProvider>
            <Tooltip open={true}>
              <TooltipTrigger asChild>
                <div
                  style={{
                    position: 'absolute',
                    left: targetElement.getBoundingClientRect().left,
                    top: targetElement.getBoundingClientRect().top,
                    width: targetElement.offsetWidth,
                    height: targetElement.offsetHeight,
                  }}
                  className="border-2 border-purple-500 rounded-md"
                />
              </TooltipTrigger>
              <TooltipContent
                side={steps[currentStep].position || 'right'}
                className="w-80 p-4 space-y-2"
              >
                {steps[currentStep].title && (
                  <h3 className="font-semibold text-lg">{steps[currentStep].title}</h3>
                )}
                <p className="text-sm text-muted-foreground">{steps[currentStep].content}</p>
                <div className="flex justify-between items-center mt-4">
                  <Button variant="ghost" size="sm" onClick={onSkip}>
                    Skip tour
                  </Button>
                  <Button onClick={handleNext} className="bg-purple-600 hover:bg-purple-700">
                    {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Step {currentStep + 1} of {steps.length}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
