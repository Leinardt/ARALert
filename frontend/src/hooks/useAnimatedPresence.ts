import { useEffect, useState } from 'react';

/**
 * Keeps a modal or popover mounted long enough to run its outro animation
 * before unmounting, returning `shouldRender` and `isClosing` flags.
 */
export function useAnimatedPresence(isOpen: boolean, exitDurationMs = 170) {
  const [shouldRender, setShouldRender] = useState(isOpen);

  if (isOpen && !shouldRender) {
    setShouldRender(true);
  }

  useEffect(() => {
    if (isOpen || !shouldRender) return;
    const timer = setTimeout(() => {
      setShouldRender(false);
    }, exitDurationMs);
    return () => clearTimeout(timer);
  }, [isOpen, shouldRender, exitDurationMs]);

  return {
    shouldRender,
    isClosing: !isOpen && shouldRender,
  };
}
