import React from 'react';
import Svg, { Text as SvgText } from 'react-native-svg';

interface LogoProps {
  width?: number;
  height?: number;
}

export default function Logo({ width = 160, height = 48 }: LogoProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 160 48">
      <SvgText
        x="0"
        y="36"
        fontSize="40"
        fontWeight="800"
        fill="#FF2D55"
        fontFamily="System"
      >
        D
      </SvgText>
      <SvgText
        x="30"
        y="36"
        fontSize="40"
        fontWeight="800"
        fill="#1A1A2E"
        fontFamily="System"
      >
        rapnr
      </SvgText>
    </Svg>
  );
}
