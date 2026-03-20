import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '이용약관 | 지독해',
  description: '지독해 서비스 이용약관',
}

export default function TermsPage() {
  return (
    <main className="px-[var(--spacing-page)] py-8">
      <h1
        className="text-2xl font-bold text-neutral-900"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        이용약관
      </h1>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          제1조 (목적)
        </h2>
        <p className="mt-4 text-sm text-neutral-600 leading-relaxed">
          이 약관은 지독해(이하 &ldquo;회사&rdquo;)가 운영하는 독서모임 웹서비스(이하 &ldquo;서비스&rdquo;)의 이용 조건 및 절차, 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
        </p>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          제2조 (정의)
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-neutral-600 leading-relaxed">
          <li>1. &ldquo;서비스&rdquo;란 회사가 제공하는 독서모임 일정 조회, 모임 신청·결제, 취소·환불 등 관련 제반 서비스를 의미합니다.</li>
          <li>2. &ldquo;이용자&rdquo;란 이 약관에 따라 서비스를 이용하는 자를 의미합니다.</li>
          <li>3. &ldquo;모임&rdquo;이란 회사가 주최하는 독서모임 행사를 의미합니다.</li>
          <li>4. &ldquo;운영자&rdquo;란 회사가 지정한 모임 운영 권한을 가진 자를 의미합니다.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          제3조 (약관의 효력 및 변경)
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-neutral-600 leading-relaxed">
          <li>1. 이 약관은 서비스 내에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.</li>
          <li>2. 회사는 관련 법령에 위배되지 않는 범위에서 약관을 개정할 수 있으며, 개정 시 적용일자 및 개정사유를 명시하여 서비스 내에 공지합니다.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          제4조 (서비스 이용)
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-neutral-600 leading-relaxed">
          <li>1. 서비스 이용을 위해서는 카카오 계정을 통한 로그인이 필요합니다.</li>
          <li>2. 이용자는 서비스 가입 시 정확한 정보를 제공하여야 하며, 변경사항이 있을 경우 즉시 수정하여야 합니다.</li>
          <li>3. 이용자는 서비스를 본래의 목적(독서모임 참여)에 맞게 이용하여야 합니다.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          제5조 (모임 신청 및 결제)
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-neutral-600 leading-relaxed">
          <li>1. 이용자는 서비스를 통해 모임에 신청하고 참가비를 결제할 수 있습니다.</li>
          <li>2. 결제는 토스페이먼츠를 통한 카드 결제로 이루어집니다.</li>
          <li>3. 결제 완료 시 모임 신청이 확정됩니다.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          제6조 (취소 및 환불)
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-neutral-600 leading-relaxed">
          <li>1. 이용자는 서비스 내에서 직접 모임 신청을 취소할 수 있습니다.</li>
          <li>2. 환불 기준은 서비스 내 환불정책 페이지에 명시된 바에 따릅니다.</li>
          <li>3. 운영자에 의한 모임 취소 시 참가비 전액이 환불됩니다.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          제7조 (이용자의 의무)
        </h2>
        <div className="mt-4 text-sm text-neutral-600 leading-relaxed">
          <p>1. 이용자는 다음 행위를 하여서는 안 됩니다.</p>
          <ul className="mt-2 ml-4 space-y-1">
            <li>- 허위 정보를 등록하는 행위</li>
            <li>- 타인의 정보를 도용하는 행위</li>
            <li>- 서비스의 운영을 고의로 방해하는 행위</li>
            <li>- 다른 이용자에게 불쾌감을 주거나 위협하는 행위</li>
            <li>- 모임의 목적과 무관한 상업적 홍보 행위</li>
            <li>- 기타 관련 법령에 위반되는 행위</li>
          </ul>
          <p className="mt-2">2. 위 사항을 위반한 경우 회사는 서비스 이용을 제한하거나 이용 자격을 해제할 수 있습니다.</p>
        </div>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          제8조 (회사의 의무)
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-neutral-600 leading-relaxed">
          <li>1. 회사는 안정적인 서비스 제공을 위해 노력합니다.</li>
          <li>2. 회사는 이용자의 개인정보를 보호하며, 개인정보처리방침에 따라 관리합니다.</li>
          <li>3. 회사는 이용자의 불만 및 민원을 신속하게 처리하기 위해 노력합니다.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          제9조 (서비스 중단)
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-neutral-600 leading-relaxed">
          <li>1. 회사는 시스템 점검, 기술적 장애, 기타 불가피한 사유로 서비스를 일시 중단할 수 있습니다.</li>
          <li>2. 서비스 중단 시 사전에 공지하며, 불가피한 경우 사후에 공지할 수 있습니다.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          제10조 (면책)
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-neutral-600 leading-relaxed">
          <li>1. 회사는 이용자 간 또는 이용자와 제3자 간의 분쟁에 대해 개입할 의무가 없으며, 이로 인한 손해를 배상할 책임이 없습니다.</li>
          <li>2. 회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력적인 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          제11조 (분쟁 해결)
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-neutral-600 leading-relaxed">
          <li>1. 서비스 이용과 관련하여 발생한 분쟁에 대해 회사와 이용자는 성실히 협의하여 해결합니다.</li>
          <li>2. 협의로 해결되지 않는 경우 관할 법원은 회사 소재지의 법원으로 합니다.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          부칙
        </h2>
        <p className="mt-4 text-sm text-neutral-600 leading-relaxed">
          이 약관은 2026년 3월 21일부터 시행합니다.
        </p>
      </section>
    </main>
  )
}
