import React from 'react';
import Svg, { Rect, Path, Circle, G, Line } from 'react-native-svg';

interface EmptyWardrobeProps {
  width?: number;
  height?: number;
}

/** Empty state illustration for the wardrobe screen. */
export default function EmptyWardrobe({ width = 200, height = 200 }: EmptyWardrobeProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 200 200">
      {/* Wardrobe outline */}
      <Rect
        x="40"
        y="30"
        width="120"
        height="130"
        rx="10"
        stroke="#1A1A2E"
        strokeWidth="2"
        fill="none"
        opacity={0.2}
      />

      {/* Shelf lines */}
      <G stroke="#1A1A2E" strokeWidth="1" opacity={0.15}>
        <Line x1="40" y1="75" x2="160" y2="75" />
        <Line x1="40" y1="115" x2="160" y2="115" />
      </G>

      {/* Hanger icon */}
      <G opacity={0.3}>
        <Path
          d="M100 50 L100 58 C100 58 80 68 80 72 C80 76 88 78 100 78 C112 78 120 76 120 72 C120 68 100 58 100 58"
          stroke="#1A1A2E"
          strokeWidth="2"
          fill="none"
        />
        <Circle cx="100" cy="48" r="3" fill="#1A1A2E" />
      </G>

      {/* Plus icon */}
      <Circle cx="100" cy="130" r="16" fill="#FF2D55" opacity={0.15} />
      <G stroke="#FF2D55" strokeWidth="2.5">
        <Line x1="100" y1="122" x2="100" y2="138" />
        <Line x1="92" y1="130" x2="108" y2="130" />
      </G>

      {/* Caption area placeholder dots */}
      <G fill="#1A1A2E" opacity={0.2}>
        <Circle cx="88" cy="175" r="2" />
        <Circle cx="100" cy="175" r="2" />
        <Circle cx="112" cy="175" r="2" />
      </G>
    </Svg>
  );
}
