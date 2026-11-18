import { useEffect, useState } from 'react';

function checkMobileLandscape(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia?.('(orientation: landscape) and (max-height: 560px)');
  if (mq && mq.matches) return true;
  return window.innerHeight <= 560 && window.innerWidth > window.innerHeight;
}

/**
 * Returns true when running on a mobile phone in landscape orientation
 * (height <= 560px and width > height). Desktop viewports remain false.
 */
export function useIsMobileLandscape(): boolean {
  const [isMobileLandscape, setIsMobileLandscape] = useState<boolean>(checkMobileLandscape);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.('(orientation: landscape) and (max-height: 560px)');
    const update = () => setIsMobileLandscape(checkMobileLandscape());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    mq?.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      mq?.removeEventListener?.('change', update);
    };
  }, []);

  return isMobileLandscape;
}
