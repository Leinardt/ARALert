import React, { useEffect, useState, useRef } from 'react';

export interface AnimatedCounterProps {
  value: number | null | undefined;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  fallback?: string;
  className?: string;
  alwaysFromZero?: boolean;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 750,
  decimals = 0,
  suffix = '',
  prefix = '',
  fallback = '—',
  className = '',
  alwaysFromZero = false,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const prevValueRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (value === null || value === undefined || isNaN(value)) {
      return;
    }

    if (prefersReducedMotion) {
      setDisplayValue(value);
      prevValueRef.current = value;
      return;
    }

    const startVal = alwaysFromZero ? 0 : prevValueRef.current;
    const endVal = value;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * ease;

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endVal);
        prevValueRef.current = endVal;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, duration, prefersReducedMotion, alwaysFromZero]);

  if (value === null || value === undefined || isNaN(value)) {
    return <span className={className}>{fallback}</span>;
  }

  const formatted =
    decimals > 0
      ? displayValue.toFixed(decimals)
      : Math.round(displayValue).toString();

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

export default AnimatedCounter;

