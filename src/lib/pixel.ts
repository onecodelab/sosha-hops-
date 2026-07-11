export const FB_PIXEL_ID = '910367244669180';

declare global {
  interface Window {
    fbq?: (
      action: 'track' | 'trackCustom' | 'init',
      eventName: string,
      params?: Record<string, any>
    ) => void;
    _fbq?: any;
  }
}

/**
 * Track a page view event with Meta Pixel
 */
export const pageview = (): void => {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'PageView');
  }
};

/**
 * Track standard Meta Pixel events (e.g. Lead, Contact, InitiateCheckout, CompleteRegistration, Purchase)
 */
export const trackPixelEvent = (
  eventName: string,
  data?: Record<string, any>
): void => {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', eventName, data);
  }
};

/**
 * Track custom Meta Pixel events
 */
export const trackCustomPixelEvent = (
  eventName: string,
  data?: Record<string, any>
): void => {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('trackCustom', eventName, data);
  }
};
