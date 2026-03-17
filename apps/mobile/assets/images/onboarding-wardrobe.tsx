import React from 'react';
import Svg, { Rect, G } from 'react-native-svg';

interface OnboardingWardrobeProps {
  width?: number;
  height?: number;
}

/** Simple illustration of a wardrobe grid with garment thumbnails. */
export default function OnboardingWardrobe({ width = 200, height = 200 }: OnboardingWardrobeProps) {
  const colors = ['#FF2D55', '#FF6B8A', '#1A1A2E', '#4A4A6A', '#FF2D55', '#2A2A4E'];

  return (
    <Svg width={width} height={height} viewBox="0 0 200 200">
      {/* Background card */}
      <Rect x="25" y="20" width="150" height="160" rx="12" fill="#F8F9FA" />

      {/* Grid of garment thumbnails */}
      <G>
        {[0, 1, 2].map((row) =>
          [0, 1].map((col) => (
            <Rect
              key={`${row}-${col}`}
              x={45 + col * 60}
              y={35 + row * 48}
              width="50"
              height="40"
              rx="6"
              fill={colors[row * 2 + col]}
              opacity={0.85}
            />
          )),
        )}
      </G>

      {/* Bottom indicator dots */}
      <G>
        <Rect x="85" y="172" width="8" height="3" rx="1.5" fill="#FF2D55" />
        <Rect x="97" y="172" width="8" height="3" rx="1.5" fill="#1A1A2E" opacity={0.3} />
        <Rect x="109" y="172" width="8" height="3" rx="1.5" fill="#1A1A2E" opacity={0.3} />
      </G>
    </Svg>
  );
}
