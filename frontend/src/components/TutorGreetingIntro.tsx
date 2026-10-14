import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { User } from '../types';
import aralertLogo from '../assets/ARALert_Logo_LIGHT.png';
import { extractLastNameAndFirstName } from '../utils/studentFormatters';

export const getGreetingPeriod = (): 'morning' | 'afternoon' | 'evening' => {
  const hour = new Date().getHours();
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
};

/**
 * Checks whether a greeting should be shown:
 * 1. New account welcome greeting: shown strictly ONCE ever per account.
 * 2. Returning greeting: shown strictly ONCE per time period (morning, afternoon, evening) per day.
 */
export const checkGreetingEligibility = (
  user: User | null
): { show: boolean; isNewcomer: boolean; period: 'morning' | 'afternoon' | 'evening' } => {
  const period = getGreetingPeriod();
  if (!user || !user.id) return { show: false, isNewcomer: false, period };

  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const periodKey = `aralert_greeting_${user.id}_${today}_${period}`;
  const welcomeKey = `aralert_welcome_${user.id}`;

  const welcomeAlreadySeen = localStorage.getItem(welcomeKey) === 'true';
  const isNewcomer =
    !welcomeAlreadySeen &&
    (sessionStorage.getItem('aralert_is_first_login') === 'true' ||
      Boolean(user.is_first_login) ||
      !user.privacy_consent_accepted_at);

  if (isNewcomer) {
    return { show: true, isNewcomer: true, period };
  }

  const periodAlreadySeen = localStorage.getItem(periodKey) === 'true';
  if (periodAlreadySeen) {
    return { show: false, isNewcomer: false, period };
  }

  return { show: true, isNewcomer: false, period };
};

export const markGreetingAsSeen = (user: User | null, isNewcomer: boolean) => {
  if (!user || !user.id) return;
  const period = getGreetingPeriod();
  const today = new Date().toLocaleDateString('en-CA');
  const periodKey = `aralert_greeting_${user.id}_${today}_${period}`;
  const welcomeKey = `aralert_welcome_${user.id}`;

  if (isNewcomer) {
    localStorage.setItem(welcomeKey, 'true');
  }
  localStorage.setItem(periodKey, 'true');
};

interface TutorGreetingIntroProps {
  user: User | null;
  isTutor?: boolean;
  sidebarLogoId?: string;
  sidebarTextId?: string;
}

export const TutorGreetingIntro: React.FC<TutorGreetingIntroProps> = ({
  user,
  sidebarLogoId = 'sidebar-brand-logo',
  sidebarTextId = 'sidebar-brand-text',
}) => {
  const isAllowed = Boolean(user);
  const [phase, setPhase] = useState<'idle' | 'centered' | 'flying' | 'completed'>('idle');
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [isNewcomerGreeting, setIsNewcomerGreeting] = useState(false);
  const [flightCoords, setFlightCoords] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const centerLogoRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const isDismissingRef = useRef(false);

  // Time slot calculation
  const period = getGreetingPeriod();
  const timeGreeting =
    period === 'morning' ? 'Good morning' : period === 'afternoon' ? 'Good afternoon' : 'Good evening';

  // Role prefix for greeting: tutor, Principal, Teacher, Admin, or none for students
  let greetingRolePrefix = '';
  if (user?.role === 'tutor') {
    greetingRolePrefix = 'tutor ';
  } else if (user?.role === 'principal') {
    greetingRolePrefix = 'Principal ';
  } else if (user?.role === 'faculty') {
    greetingRolePrefix = 'Teacher ';
  } else if (user?.role === 'admin' || user?.is_superuser) {
    greetingRolePrefix = 'Admin ';
  }

  const firstName = (() => {
    if (user?.first_name?.trim()) return user.first_name.trim();
    const candidate = user?.full_name || (user as any)?.name;
    if (candidate) {
      const { firstName: fn } = extractLastNameAndFirstName(candidate);
      if (fn?.trim()) return fn.trim();
    }
    return user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User';
  })();

  const triggerDismissalRef = useRef<() => void>(() => {});

  // Dismiss and fly back into sidebar header
  const triggerDismissal = useCallback(() => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Step 1: Fade and shrink chat bubble
    setBubbleVisible(false);

    // Step 2: Measure current center logo & target sidebar logo
    const centerEl = centerLogoRef.current;
    const sidebarEl = document.getElementById(sidebarLogoId);
    const sidebarTextEl = document.getElementById(sidebarTextId);

    if (!centerEl || !sidebarEl) {
      // Fallback if elements are missing
      if (sidebarEl) {
        sidebarEl.style.opacity = '1';
        sidebarEl.style.transform = '';
        sidebarEl.style.transition = '';
      }
      if (sidebarTextEl) {
        sidebarTextEl.style.transform = '';
        sidebarTextEl.style.transition = '';
        sidebarTextEl.style.transformOrigin = '';
      }
      setPhase('completed');
      return;
    }

    const centerRect = centerEl.getBoundingClientRect();
    const targetRect = sidebarEl.getBoundingClientRect();

    // Start flying logo at exact current center coordinates
    setFlightCoords({
      left: centerRect.left,
      top: centerRect.top,
      width: centerRect.width,
      height: centerRect.height,
    });
    setPhase('flying');

    // In the next frame, interpolate to target sidebar coordinates
    // and simultaneously slide the WHOLE ARALert / [role] title smoothly into position!
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFlightCoords({
          left: targetRect.left,
          top: targetRect.top,
          width: targetRect.width,
          height: targetRect.height,
        });

        if (sidebarTextEl) {
          sidebarTextEl.style.transition = 'transform 0.85s cubic-bezier(0.22, 1, 0.36, 1)';
          sidebarTextEl.style.transform = 'translateX(0px)';
        }
      });
    });

    // Step 3: Complete arrival after 850ms
    setTimeout(() => {
      if (sidebarEl) {
        sidebarEl.style.opacity = '1';
        sidebarEl.style.transition =
          'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-in-out';
        sidebarEl.style.transform = 'scale(1.12)';
        setTimeout(() => {
          sidebarEl.style.transform = '';
          sidebarEl.style.transition = '';
        }, 300);
      }

      if (sidebarTextEl) {
        sidebarTextEl.style.transform = '';
        sidebarTextEl.style.transition = '';
        sidebarTextEl.style.transformOrigin = '';
      }

      setPhase('completed');
    }, 850);
  }, [sidebarLogoId, sidebarTextId]);

  triggerDismissalRef.current = triggerDismissal;

  // Start the greeting intro
  const startIntro = useCallback(
    (isNewcomerAccount: boolean) => {
      isDismissingRef.current = false;
      setBubbleVisible(true);
      setFlightCoords(null);
      setPhase('centered');

      // Mark greeting as seen in persistent storage
      markGreetingAsSeen(user, isNewcomerAccount);
      sessionStorage.removeItem('aralert_login_greeting_pending');
      sessionStorage.removeItem('aralert_is_first_login');

      // Ensure the sidebar logo is hidden while intro is playing
      const sidebarLogo = document.getElementById(sidebarLogoId);
      if (sidebarLogo) {
        sidebarLogo.style.opacity = '0';
      }

      // Ensure the whole ARALert / [role] text container is left-aligned
      const sidebarText = document.getElementById(sidebarTextId);
      if (sidebarText) {
        sidebarText.style.transformOrigin = 'left center';
        sidebarText.style.transform = 'translateX(-34px)';
      }

      // Auto dismiss after 5 seconds
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        triggerDismissalRef.current();
      }, 5000);
    },
    [user, sidebarLogoId, sidebarTextId]
  );

  // Auto-open only if eligible for morning/afternoon/evening or new account welcome
  useEffect(() => {
    if (!isAllowed || !user) return;

    const { show, isNewcomer } = checkGreetingEligibility(user);
    if (!show) {
      setPhase('idle');
      return;
    }

    setIsNewcomerGreeting(isNewcomer);

    // If there IS a greeting, immediately ensure sidebar logo is hidden and text is left-aligned
    const sidebarLogo = document.getElementById(sidebarLogoId);
    if (sidebarLogo) {
      sidebarLogo.style.opacity = '0';
    }
    const sidebarText = document.getElementById(sidebarTextId);
    if (sidebarText) {
      sidebarText.style.transformOrigin = 'left center';
      sidebarText.style.transform = 'translateX(-34px)';
    }

    const mountTimer = setTimeout(() => {
      startIntro(isNewcomer);
    }, 300);

    return () => {
      clearTimeout(mountTimer);
    };
  }, [isAllowed, user?.id, sidebarLogoId, sidebarTextId, startIntro]);

  // Clean up timer on unmount and ensure sidebar logo and text are restored
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const sidebarLogo = document.getElementById(sidebarLogoId);
      if (sidebarLogo) {
        sidebarLogo.style.opacity = '1';
        sidebarLogo.style.transform = '';
        sidebarLogo.style.transition = '';
      }
      const sidebarText = document.getElementById(sidebarTextId);
      if (sidebarText) {
        sidebarText.style.transform = '';
        sidebarText.style.transition = '';
        sidebarText.style.transformOrigin = '';
      }
    };
  }, [sidebarLogoId, sidebarTextId]);

  if (phase === 'idle' || phase === 'completed') {
    return null;
  }

  return (
    <>
      {/* ── Backdrop Click-catcher (Click anywhere to dismiss) ──────── */}
      <div
        className={`fixed inset-0 z-[99980] bg-black/15 dark:bg-black/35 backdrop-blur-[1px] transition-opacity duration-300 cursor-pointer ${
          bubbleVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={triggerDismissal}
        aria-label="Click anywhere to continue"
      />

      {/* ── Centered Stage: Mascot Logo + Chat Bubble ───────────────── */}
      {phase === 'centered' && (
        <div
          className="fixed inset-0 z-[99990] flex items-center justify-center p-4 pointer-events-none select-none"
          onClick={triggerDismissal}
        >
          <div className="pointer-events-auto flex flex-col sm:flex-row items-center gap-6 sm:gap-8 max-w-4xl w-auto justify-center">
            {/* Center Logo */}
            <div
              ref={centerLogoRef}
              className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center select-none"
              style={{
                animation: 'float 3s ease-in-out infinite',
              }}
            >
              <img
                src={aralertLogo}
                alt="ARALert Mascot Logo"
                className="w-full h-full object-contain filter drop-shadow-[0_12px_28px_var(--brand-glow)]"
                style={{ backfaceVisibility: 'hidden', transform: 'translateZ(0)' }}
              />
            </div>

            {/* Chat Bubble (Longer single-line container) */}
            <div
              className={`relative bg-white dark:bg-[#141414] border border-gray-200/90 dark:border-gray-800 rounded-3xl px-6 py-4 sm:px-8 sm:py-5 shadow-2xl shadow-black/20 dark:shadow-black/70 w-fit max-w-[92vw] sm:max-w-none transition-all duration-300 ${
                bubbleVisible
                  ? 'opacity-100 scale-100 translate-y-0'
                  : 'opacity-0 scale-85 -translate-y-3 pointer-events-none'
              }`}
              style={{
                animation: bubbleVisible
                  ? 'bounce-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
                  : 'none',
              }}
            >
              {/* Desktop Left-pointing Chat Beak/Tail */}
              <div
                className="hidden sm:block absolute top-1/2 -left-3 -translate-y-1/2 w-0 h-0 border-y-[10px] border-y-transparent border-r-[12px] border-r-white dark:border-r-[#141414] filter drop-shadow-[-2px_0_1px_rgba(0,0,0,0.06)]"
                aria-hidden="true"
              />

              {/* Mobile Top-pointing Chat Beak/Tail */}
              <div
                className="sm:hidden absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-x-[10px] border-x-transparent border-b-[12px] border-b-white dark:border-b-[#141414]"
                aria-hidden="true"
              />

              {/* Dynamic Greeting Message (Welcome to ARALert for first-time, Welcome back for returning) */}
              <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-slate-100 leading-normal tracking-tight whitespace-nowrap">
                {timeGreeting}, {greetingRolePrefix}
                <span className="text-[var(--brand)] dark:text-blue-400 font-extrabold">
                  {firstName}
                </span>
                {isNewcomerGreeting ? '! Welcome to ARALert!' : '! Welcome back!'}
              </p>

              {/* 5-second animated progress indicator bar (Gray) */}
              <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gray-400 dark:bg-gray-500 rounded-full"
                  style={{
                    animation: 'timerProgress 5s linear forwards',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Flight Mascot: Gliding from Center into Sidebar Header ─── */}
      {phase === 'flying' && flightCoords && (
        <div
          style={{
            position: 'fixed',
            left: `${flightCoords.left}px`,
            top: `${flightCoords.top}px`,
            width: `${flightCoords.width}px`,
            height: `${flightCoords.height}px`,
            zIndex: 99999,
            pointerEvents: 'none',
            transition: 'all 0.85s cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'left, top, width, height',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={aralertLogo}
            alt="ARALert Flying Mascot"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 12px var(--brand-glow))',
              backfaceVisibility: 'hidden',
              transform: 'translateZ(0)',
            }}
          />
        </div>
      )}

      {/* Timer progress keyframe injection */}
      <style>{`
        @keyframes timerProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </>
  );
};
