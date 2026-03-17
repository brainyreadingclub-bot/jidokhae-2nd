import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '환불정책 | 지독해',
  description: '지독해 모임 참가비 환불 기준 안내',
}

export default function RefundPolicyPage() {
  return (
    <main className="px-[var(--spacing-page)] py-8">
      <h1
        className="text-2xl font-bold text-neutral-900"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        환불정책
      </h1>

      <p className="mt-4 text-neutral-700 leading-relaxed">
        지독해 모임 참가비 환불은 아래 기준에 따라 자동으로 처리됩니다.
      </p>

      {/* 환불 기준 */}
      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          환불 기준
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
              <tr className="border-t border-surface-300">
                <td className="px-4 py-3">모임 3일 전까지</td>
                <td className="px-4 py-3">참가비 100% 환불</td>
              </tr>
              <tr className="border-t border-surface-300">
                <td className="px-4 py-3">모임 2일 전</td>
                <td className="px-4 py-3">참가비 50% 환불</td>
              </tr>
              <tr className="border-t border-surface-300">
                <td className="px-4 py-3">모임 전일 · 당일</td>
                <td className="px-4 py-3">환불 없음 (취소는 가능)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ul className="mt-4 space-y-2 text-sm text-neutral-600 leading-relaxed">
          <li>• 환불 기준일은 한국 시간(KST) 자정 기준으로 계산됩니다.</li>
          <li>• 취소 시 환불 금액은 실제 결제 금액(참가비) 기준으로 산정됩니다.</li>
          <li>• 환불은 결제 수단(카드)으로 자동 환불되며, 카드사에 따라 2~5영업일 소요될 수 있습니다.</li>
          <li>• 모임 전일·당일에도 취소는 가능하지만 환불은 이루어지지 않습니다.</li>
        </ul>
      </section>

      {/* 운영자에 의한 모임 취소 */}
      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          운영자에 의한 모임 취소
        </h2>

        <ul className="mt-4 space-y-2 text-sm text-neutral-600 leading-relaxed">
          <li>• 운영자가 모임을 삭제하는 경우, 모든 신청자에게 참가비 100%가 자동 환불됩니다.</li>
          <li>• 이 경우 환불 기준일과 관계없이 전액 환불됩니다.</li>
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
          환불 관련 문의는 카카오톡 &lsquo;단무지&rsquo;에게 1:1 채팅으로 연락해 주세요.
        </p>
      </section>
    </main>
  )
}
