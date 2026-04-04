interface GtagEventParams {
  [key: string]: string | number | boolean | undefined
}

interface Window {
  gtag?: (
    command: 'config' | 'event' | 'js' | 'set',
    targetOrName: string | Date,
    params?: GtagEventParams,
  ) => void
  dataLayer?: Record<string, unknown>[]
}
