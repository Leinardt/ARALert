import React, { useState, useEffect, useRef } from 'react';
import { Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

interface ThemeToggleProps {
  className?: string;
  style?: React.CSSProperties;
  size?: number;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  style = {},
  size = 17,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [currentTheme, setCurrentTheme] = useState(theme);
  const [outgoingTheme, setOutgoingTheme] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (theme !== currentTheme) {
      setOutgoingTheme(currentTheme);
      setCurrentTheme(theme);

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        setOutgoingTheme(null);
      }, 380);
    }
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [theme, currentTheme]);

  const renderIcon = (t: string) => {
    return t === 'dark' ? (
      <Moon
        size={size}
        strokeWidth={2}
      />
    ) : (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="lucide lucide-sun"
        style={{ display: 'block' }}
      >
        {/* Hollow / outline center circle of the sun */}
        <circle
          cx="12"
          cy="12"
          r="4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        {/* Filled solid rays (old ray shape, no outline stroke) */}
        <g fill="currentColor" stroke="none">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <rect
              key={deg}
              x="10.9"
              y="1"
              width="2.2"
              height="4"
              rx="1.1"
              transform={`rotate(${deg} 12 12)`}
            />
          ))}
        </g>
      </svg>
    );
  };

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`theme-toggle-btn ${className}`}
      style={{
        width: '38px',
        height: '38px',
        borderRadius: '12px',
        border: '1px solid var(--slate-200)',
        background: 'var(--surface-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        overflow: 'hidden',
        position: 'relative',
        color: 'var(--text-secondary)',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--brand-light)';
        e.currentTarget.style.borderColor = 'var(--brand-border)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--surface-muted)';
        e.currentTarget.style.borderColor = 'var(--slate-200)';
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        {/* Outgoing icon moving clockwise along celestial arc down and out */}
        {outgoingTheme && (
          <span
            key={`outgoing-${outgoingTheme}`}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'currentColor',
              transformOrigin: '50% calc(50% + 24px)',
              animation: 'moveClockwiseOut 0.38s cubic-bezier(0.22, 1, 0.36, 1) forwards',
              pointerEvents: 'none',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              willChange: 'transform, opacity',
            }}
            aria-hidden="true"
          >
            {renderIcon(outgoingTheme)}
          </span>
        )}

        {/* Current/Incoming icon moving clockwise from lower-left into center */}
        <span
          key={`current-${currentTheme}`}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'currentColor',
            transformOrigin: '50% calc(50% + 24px)',
            animation: outgoingTheme
              ? 'moveClockwiseIn 0.38s cubic-bezier(0.22, 1, 0.36, 1) forwards'
              : undefined,
            pointerEvents: 'none',
            backfaceVisibility: outgoingTheme ? 'hidden' : undefined,
            WebkitBackfaceVisibility: outgoingTheme ? 'hidden' : undefined,
            willChange: outgoingTheme ? 'transform, opacity' : undefined,
          }}
          aria-hidden="true"
        >
          {renderIcon(currentTheme)}
        </span>
      </div>
    </button>
  );
};
