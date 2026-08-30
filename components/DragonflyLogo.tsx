import React from 'react';

interface DragonflyLogoProps {
  className?: string;
  variant?: 'turquoise' | 'white';
  showStation?: boolean;
  stationCode?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Official Dragonfly Logo vector reproduced exactly from the 2024 Brand Guidelines
 * and the official Dragonfly logo PNG asset in Dragonfly Turquoise (#00A68F).
 */
export const DragonflyLogoGraphic: React.FC<{
  className?: string;
  color?: string;
  height?: number | string;
  usePng?: boolean;
}> = ({
  className = "",
  height = 36,
  usePng = false,
}) => {
  const logoSrc = usePng ? "/Dragonfly%20logo.png" : "/Dragonfly%20logo.svg";

  return (
    <div className={`flex items-center ${className}`}>
      <img
        src={logoSrc}
        onError={(e) => {
          // Fallback to PNG if SVG encounters any issues or vice versa
          const target = e.currentTarget;
          if (!target.src.includes('.png')) {
            target.src = '/Dragonfly%20logo.png';
          }
        }}
        alt="Dragonfly"
        height={height}
        style={{ height: typeof height === 'number' ? `${height}px` : height, width: 'auto' }}
        className="object-contain block shrink-0 select-none"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

export const DragonflySignature: React.FC<DragonflyLogoProps> = ({
  className = "",
  variant = 'turquoise',
  showStation = true,
  stationCode = 'KTCH',
  size = 'md',
}) => {
  const color = variant === 'turquoise' ? '#00A68F' : '#FFFFFF';

  const sizeConfig = {
    sm: { height: 24, subText: 'text-[9px]', badgeText: 'text-[9px]' },
    md: { height: 32, subText: 'text-[10px] md:text-[11px]', badgeText: 'text-[10px]' },
    lg: { height: 42, subText: 'text-xs md:text-sm', badgeText: 'text-xs' },
    xl: { height: 56, subText: 'text-sm md:text-base', badgeText: 'text-xs' },
  }[size];

  return (
    <div className={`flex flex-col select-none ${className}`}>
      {/* Official Dragonfly Logo Graphic (from PNG) */}
      <div className="flex items-center">
        <DragonflyLogoGraphic color={color} height={sizeConfig.height} />
      </div>

      {/* Subtitle Line: MANIFEST SPLITTER [KTCH] */}
      {showStation && (
        <div className="flex items-center gap-1.5 mt-1 ml-0.5">
          <span className={`font-extrabold text-gray-400 uppercase tracking-widest ${sizeConfig.subText}`}>
            MANIFEST SPLITTER
          </span>
          <span className={`font-bold uppercase tracking-wider bg-dragonfly-turquoise/15 text-dragonfly-turquoise border border-dragonfly-turquoise/40 px-1.5 py-0.5 rounded ${sizeConfig.badgeText}`}>
            {stationCode}
          </span>
        </div>
      )}
    </div>
  );
};

export default DragonflySignature;
