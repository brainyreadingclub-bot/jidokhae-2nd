import type { Metadata } from 'next'
import {
  REFUND_RULES,
  REFUND_DEFAULT,
  DISCUSSION_REFUND_RULES,
  DISCUSSION_REFUND_DEFAULT,
} from '@/lib/refund'
import { getSiteSettings } from '@/lib/site-settings'

export const metadata: Metadata = {
  title: '환불정책 | 지독해',
  description: '지독해 모임 참가비 환불 기준 안내',
}

export default async function RefundPolicyPage() {
  const settings = await getSiteSettings()
  const supportContact = settings['support_contact'] ?? '카카오톡 \'단무지\'에게 1:1 채팅으로 연락해 주세요.'
  return (
    <main className="px-[var(--spacing-page)] py-8">
      <h1
        className="text-2xl font-bold text-neutral-900"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        환불정책
      </h1>

      <p className="mt-4 text-neutral-700 leading-relaxed">
        지독해 모임 참가비 환불은 아래 기준에 따라 자동으로 처리돼요.
      </p>

      {/* 환불 기준 */}
      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          환불 기준 — 정기모임
        </h2>

        <div className="mt-4 overflow-hidden rounded-[var(--radius-md)] border border-surface-300">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-surface-100)' }}>
                <th className="px-4 py-3 text-left font-semibold text-neutral-700">취소 시점</th>
                <th className="px-4 py-3 text-left font-semibold text-neutral-700">환불 비율</th>
              </tr>
            </thead>
            <tbody className="text-neutral-600">
              {REFUND_RULES.map((rule) => (
                <tr key={rule.daysBeforeMeeting} className="border-t border-surface-300">
                  <td className="px-4 py-3">{rule.label}</td>
                  <td className="px-4 py-3">{rule.rateLabel}</td>
                </tr>
              ))}
              <tr className="border-t border-surface-300">
                <td className="px-4 py-3">{REFUND_DEFAULT.label}</td>
                <td className="px-4 py-3">{REFUND_DEFAULT.rateLabel}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2
          className="mt-8 text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          환불 기준 — 토론모임
        </h2>
        {/* 「책 주문 일정에 맞춰 신청 마감과 환불 경계가 7일 전으로 통일」 문단은 2026-10-13에 뺐다 —
            D-7 신청 마감 폐지 + 책 주문 마감을 서비스에 두지 않는다(대표님 결정). 표는 lib/refund.ts 상수를 읽는다 */}

        <div className="mt-4 overflow-hidden rounded-[var(--radius-md)] border border-surface-300">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-surface-100)' }}>
                <th className="px-4 py-3 text-left font-semibold text-neutral-700">취소 시점</th>
                <th className="px-4 py-3 text-left font-semibold text-neutral-700">환불 비율</th>
              </tr>
            </thead>
            <tbody className="text-neutral-600">
              {DISCUSSION_REFUND_RULES.map((rule) => (
                <tr key={rule.daysBeforeMeeting} className="border-t border-surface-300">
                  <td className="px-4 py-3">{rule.label}</td>
                  <td className="px-4 py-3">{rule.rateLabel}</td>
                </tr>
              ))}
              <tr className="border-t border-surface-300">
                <td className="px-4 py-3">{DISCUSSION_REFUND_DEFAULT.label}</td>
                <td className="px-4 py-3">{DISCUSSION_REFUND_DEFAULT.rateLabel}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ul className="mt-4 space-y-2 text-sm text-neutral-600 leading-relaxed">
          <li>• 환불 기준일은 한국 시간(KST) 자정 기준으로 계산돼요.</li>
          <li>• 취소할 때 환불 금액은 실제 결제 금액(참가비) 기준으로 산정돼요.</li>
          <li>• 환불은 결제 수단(카드)으로 자동 환불되고, 카드사에 따라 2~5영업일 걸릴 수 있어요.</li>
          <li>• 모임 전일·당일에도 취소는 할 수 있지만 환불은 되지 않아요.</li>
        </ul>
      </section>

      {/* 대기 신청 안내 */}
      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          대기 신청 안내
        </h2>

        <ul className="mt-4 space-y-2 text-sm text-neutral-600 leading-relaxed">
          <li>• 정원이 가득 찬 모임에 대기 신청을 할 수 있어요.</li>
          <li>• 대기 신청할 때 참가비가 결제되고, 취소자가 생기면 자동으로 신청이 완료돼요.</li>
          <li>• 대기 신청은 언제든 취소할 수 있고, 전액 환불돼요.</li>
          <li>• 모임 전날까지 자리가 나지 않으면 자동으로 전액 환불돼요.</li>
        </ul>
      </section>

      {/* 운영자에 의한 모임 취소 */}
      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          운영진이 모임을 취소한 경우
        </h2>

        <ul className="mt-4 space-y-2 text-sm text-neutral-600 leading-relaxed">
          <li>• 운영진이 모임을 삭제하면 모든 신청자에게 참가비 100%가 자동 환불돼요.</li>
          <li>• 이때는 환불 기준일과 관계없이 전액 환불돼요.</li>
        </ul>
      </section>

      {/* 문의 */}
      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          문의
        </h2>

        <p className="mt-4 text-sm text-neutral-600 leading-relaxed">
          {supportContact}
        </p>
      </section>
    </main>
  )
}
