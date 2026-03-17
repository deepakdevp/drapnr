import React from 'react';
import Svg, { Rect, Circle, Path, G } from 'react-native-svg';

interface OnboardingCaptureProps {
  width?: number;
  height?: number;
}

/** Simple illustration of a phone with a camera viewfinder. */
export default function OnboardingCapture({ width = 200, height = 200 }: OnboardingCaptureProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 200 200">
      {/* Phone body */}
      <Rect x="55" y="20" width="90" height="160" rx="12" fill="#1A1A2E" />
      <Rect x="60" y="30" width="80" height="130" rx="4" fill="#F8F9FA" />

      {/* Camera viewfinder circle */}
      <Circle cx="100" cy="95" r="30" stroke="#FF2D55" strokeWidth="3" fill="none" />
      <Circle cx="100" cy="95" r="4" fill="#FF2D55" />

      {/* Crosshair lines */}
      <G stroke="#FF2D55" strokeWidth="1.5" opacity={0.6}>
        <Path d="M100 60 L100 75" />
        <Path d="M100 115 L100 130" />
        <Path d="M65 95 L80 95" />
        <Path d="M120 95 L135 95" />
      </G>

      {/* Record button */}
      <Circle cx="100" cy="170" r="8" fill="#FF2D55" />
    </Svg>
  );
}
