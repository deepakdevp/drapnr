import React from 'react';
import Svg, { Rect, Circle, Path, G, Line } from 'react-native-svg';

interface OnboardingMixMatchProps {
  width?: number;
  height?: number;
}

/** Simple illustration of an avatar with swap arrows. */
export default function OnboardingMixMatch({ width = 200, height = 200 }: OnboardingMixMatchProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 200 200">
      {/* Avatar head */}
      <Circle cx="100" cy="55" r="22" fill="#1A1A2E" />

      {/* Avatar body / torso */}
      <Rect x="72" y="82" width="56" height="50" rx="8" fill="#FF2D55" />

      {/* Avatar legs */}
      <Rect x="76" y="136" width="20" height="35" rx="4" fill="#1A1A2E" />
      <Rect x="104" y="136" width="20" height="35" rx="4" fill="#1A1A2E" />

      {/* Left swap arrow */}
      <G opacity={0.7}>
        <Path
          d="M35 107 C20 107, 20 85, 35 85"
          stroke="#FF2D55"
          strokeWidth="2.5"
          fill="none"
        />
        <Path d="M33 80 L38 85 L33 90" fill="#FF2D55" />
      </G>

      {/* Right swap arrow */}
      <G opacity={0.7}>
        <Path
          d="M165 85 C180 85, 180 107, 165 107"
          stroke="#FF2D55"
          strokeWidth="2.5"
          fill="none"
        />
        <Path d="M167 112 L162 107 L167 102" fill="#FF2D55" />
      </G>

      {/* Small garment cards on the sides */}
      <Rect x="15" y="95" width="28" height="24" rx="4" fill="#FF6B8A" opacity={0.6} />
      <Rect x="157" y="95" width="28" height="24" rx="4" fill="#4A4A6A" opacity={0.6} />
    </Svg>
  );
}
