import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useColors } from '@/lib/theme';

// Circular progress ring. `value`/`max` fill the ring; children render in the middle.
export function Ring({
  value,
  max,
  size = 120,
  stroke = 10,
  color,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const c = useColors();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const over = max > 0 && value > max;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.soft} strokeWidth={stroke} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? c.danger : (color ?? c.primary)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - pct)}
        />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  );
}
