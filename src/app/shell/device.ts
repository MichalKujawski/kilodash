import { useEffect, useState } from 'react';

/** Phones: narrow in portrait, or short in landscape. Driving needs a bigger screen. */
export const PHONE = '(max-width: 599px), (max-height: 499px)';
export const PORTRAIT = '(orientation: portrait)';
/** Engineer's full tab set needs a laptop-sized screen. */
export const ENGINEER_FULL = '(min-width: 1024px)';
/** Engineer sidebar beside the cockpit. */
export const WIDE = '(min-width: 1280px)';

export function useMediaQuery(q: string): boolean {
  const [on, setOn] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const change = (): void => setOn(m.matches);
    m.addEventListener('change', change);
    return () => m.removeEventListener('change', change);
  }, [q]);
  return on;
}

export interface Device {
  phone: boolean;
  portrait: boolean;
  wide: boolean;
  engineerFull: boolean;
}

export function useDevice(): Device {
  return {
    phone: useMediaQuery(PHONE),
    portrait: useMediaQuery(PORTRAIT),
    wide: useMediaQuery(WIDE),
    engineerFull: useMediaQuery(ENGINEER_FULL),
  };
}
