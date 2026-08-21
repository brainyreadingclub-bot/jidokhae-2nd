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
  /**
   * 메타 픽셀. 4번째 인자 eventID는 서버 Conversions API와의 dedup 키다.
   * (src/lib/analytics.ts · src/lib/meta-capi.ts 참조)
   */
  fbq?: (
    command: 'init' | 'track' | 'trackCustom' | 'consent',
    nameOrId: string,
    params?: Record<string, unknown>,
    options?: { eventID?: string },
  ) => void
}
