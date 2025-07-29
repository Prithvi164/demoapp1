import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, HelpCircle } from "lucide-react";

interface MascotProps {
  state: 'idle' | 'pointing' | 'explaining' | 'celebrating';
  message?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Mascot({ state = 'idle', message, position = 'bottom' }: MascotProps) {
  const [isVisible, setIsVisible] = useState(true);

  // Mascot character - cute location manager
  const MascotSVG = () => (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <circle cx="60" cy="60" r="50" fill="#6366F1" />
      {/* Eyes */}
      <circle cx="45" cy="50" r="5" fill="white" />
      <circle cx="75" cy="50" r="5" fill="white" />
      {/* Smile */}
      <path
        d={state === 'celebrating' ? "M45 70 Q60 80 75 70" : "M45 70 Q60 75 75 70"}
        stroke="white"
        strokeWidth="3"
        fill="none"
      />
      {/* Location Pin Icon */}
      <g transform="translate(85, 25) scale(0.8)">
        <MapPin color="white" />
      </g>
    </svg>
  );

  // Animation variants
  const variants = {
    idle: {
      y: [0, -5, 0],
      transition: {
        duration: 2,
        repeat: Infinity,
      },
    },
    pointing: {
      x: [0, 10, 0],
      transition: {
        duration: 1,
        repeat: Infinity,
      },
    },
    explaining: {
      rotate: [-5, 5, -5],
      transition: {
        duration: 1.5,
        repeat: Infinity,
      },
    },
    celebrating: {
      scale: [1, 1.2, 1],
      rotate: [-10, 10, -10],
      transition: {
        duration: 0.8,
        repeat: 1,
      },
    },
  };

  // Position styles
  const positionStyles = {
    top: { top: '20px', right: '20px' },
    bottom: { bottom: '20px', right: '20px' },
    left: { left: '20px', top: '50%', transform: 'translateY(-50%)' },
    right: { right: '20px', top: '50%', transform: 'translateY(-50%)' },
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed z-50 flex items-center gap-4"
          style={positionStyles[position]}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
        >
          {message && (
            <motion.div
              className="bg-white p-4 rounded-lg shadow-lg max-w-xs relative"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <p className="text-sm text-gray-700">{message}</p>
              <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 rotate-45 w-4 h-4 bg-white" />
            </motion.div>
          )}
          <motion.div
            variants={variants}
            animate={state}
            className="cursor-pointer hover:scale-105 transition-transform"
            onClick={() => setIsVisible(false)}
            title="Click to hide mascot"
          >
            <MascotSVG />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}