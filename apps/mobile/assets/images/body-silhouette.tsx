import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

type BodyVariant = 'male_slim' | 'male_avg' | 'female_slim' | 'female_avg';

interface BodySilhouetteProps {
  variant: BodyVariant;
  width?: number;
  height?: number;
  color?: string;
}

interface BodyDimensions {
  shoulderWidth: number;
  torsoWidth: number;
  hipWidth: number;
  waistWidth: number;
  legSpacing: number;
  headRadius: number;
}

const BODY_DIMENSIONS: Record<BodyVariant, BodyDimensions> = {
  male_slim: {
    shoulderWidth: 38,
    torsoWidth: 28,
    hipWidth: 26,
    waistWidth: 24,
    legSpacing: 10,
    headRadius: 14,
  },
  male_avg: {
    shoulderWidth: 44,
    torsoWidth: 34,
    hipWidth: 32,
    waistWidth: 30,
    legSpacing: 12,
    headRadius: 15,
  },
  female_slim: {
    shoulderWidth: 32,
    torsoWidth: 24,
    hipWidth: 30,
    waistWidth: 20,
    legSpacing: 8,
    headRadius: 13,
  },
  female_avg: {
    shoulderWidth: 36,
    torsoWidth: 30,
    hipWidth: 36,
    waistWidth: 26,
    legSpacing: 10,
    headRadius: 14,
  },
};

function buildBodyPath(d: BodyDimensions): string {
  const cx = 60;
  const neckY = 44;
  const shoulderY = 54;
  const waistY = 90;
  const hipY = 105;
  const kneeY = 140;
  const footY = 170;

  const sl = cx - d.shoulderWidth / 2;
  const sr = cx + d.shoulderWidth / 2;
  const wl = cx - d.waistWidth / 2;
  const wr = cx + d.waistWidth / 2;
  const hl = cx - d.hipWidth / 2;
  const hr = cx + d.hipWidth / 2;
  const legW = 8;
  const ls = d.legSpacing / 2;

  return [
    // Left side: neck -> shoulder -> waist -> hip -> leg down
    `M ${cx - 4} ${neckY}`,
    `Q ${sl} ${shoulderY - 4} ${sl} ${shoulderY}`,
    `L ${sl - 4} ${shoulderY + 6}`, // arm stub
    `L ${sl} ${shoulderY + 6}`,
    `Q ${wl} ${(shoulderY + waistY) / 2} ${wl} ${waistY}`,
    `Q ${hl} ${(waistY + hipY) / 2} ${hl} ${hipY}`,
    // Left leg
    `L ${cx - ls - legW} ${hipY}`,
    `L ${cx - ls - legW - 1} ${kneeY}`,
    `L ${cx - ls - legW} ${footY}`,
    `L ${cx - ls} ${footY}`,
    `L ${cx - ls + 1} ${kneeY}`,
    `L ${cx - ls} ${hipY + 2}`,
    // Right leg
    `L ${cx + ls} ${hipY + 2}`,
    `L ${cx + ls - 1} ${kneeY}`,
    `L ${cx + ls} ${footY}`,
    `L ${cx + ls + legW} ${footY}`,
    `L ${cx + ls + legW + 1} ${kneeY}`,
    `L ${cx + ls + legW} ${hipY}`,
    // Right side back up
    `L ${hr} ${hipY}`,
    `Q ${hr} ${(waistY + hipY) / 2} ${wr} ${waistY}`,
    `Q ${wr} ${(shoulderY + waistY) / 2} ${sr} ${shoulderY + 6}`,
    `L ${sr + 4} ${shoulderY + 6}`, // arm stub
    `L ${sr} ${shoulderY}`,
    `Q ${sr} ${shoulderY - 4} ${cx + 4} ${neckY}`,
    'Z',
  ].join(' ');
}

/**
 * Parametric body silhouette that renders different proportions
 * based on the variant prop.
 */
export default function BodySilhouette({
  variant,
  width = 120,
  height = 190,
  color = '#1A1A2E',
}: BodySilhouetteProps) {
  const dims = BODY_DIMENSIONS[variant];
  const bodyPath = buildBodyPath(dims);

  return (
    <Svg width={width} height={height} viewBox="0 0 120 190">
      {/* Head */}
      <Circle cx={60} cy={24} r={dims.headRadius} fill={color} opacity={0.85} />
      {/* Body */}
      <Path d={bodyPath} fill={color} opacity={0.75} />
    </Svg>
  );
}
