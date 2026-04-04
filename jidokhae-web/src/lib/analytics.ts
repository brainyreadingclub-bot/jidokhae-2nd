type EventParams = Record<string, string | number | boolean | undefined>

export function trackEvent(name: string, params?: EventParams) {
  if (typeof window === 'undefined') return
  window.gtag?.('event', name, params)
}
