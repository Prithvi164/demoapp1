import React from 'react';

interface ZencxLogoProps {
  className?: string;
  width?: number | string;
  height?: number | string;
}

export const ZencxLogo: React.FC<ZencxLogoProps> = ({ 
  className = "", 
  width = 160, 
  height = 60 
}) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width, height, padding: 0, margin: 0, overflow: 'hidden' }}>
      <img 
        src="/images/zencx-logo-exact-700x240.png"
        alt="ZENCX Studio Logo" 
        className="w-full h-full object-contain object-center"
        style={{ 
          filter: 'drop-shadow(0 0 8px rgba(0, 0, 0, 0.2))',
          backgroundColor: 'transparent',
          padding: 0,
          margin: 0,
          verticalAlign: 'middle'
        }}
      />
    </div>
  );
};