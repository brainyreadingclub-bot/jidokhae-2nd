import type { Metadata } from 'next'
import { getSiteSettings } from '@/lib/site-settings'

export const metadata: Metadata = {
  title: '개인정보처리방침 | 지독해',
  description: '지독해 서비스 개인정보처리방침',
}

export default async function PrivacyPolicyPage() {
  const settings = await getSiteSettings()
  const representative = settings['representative'] ?? '임재윤'
  const contactPhone = settings['phone'] ?? '0507-1396-7908'
  return (
    <main className="px-[var(--spacing-page)] py-8">
      <h1
        className="text-2xl font-bold text-neutral-900"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        개인정보처리방침
      </h1>

      <p className="mt-4 text-neutral-700 leading-relaxed">
        지독해(이하 &ldquo;회사&rdquo;)는 이용자의 개인정보를 중요시하며, 개인정보보호법 등 관련 법령을 준수합니다. 이 개인정보처리방침을 통해 이용자가 제공하는 개인정보가 어떠한 용도와 방식으로 이용되고 있으며, 어떠한 보호 조치가 취해지고 있는지 알려드립니다.
      </p>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          1. 수집하는 개인정보 항목
        </h2>
        <div className="mt-4 text-sm text-neutral-600 leading-relaxed">
          <p className="font-semibold text-neutral-700">가. 카카오 로그인 시 자동 수집</p>
          <ul className="mt-2 ml-4 space-y-1">
            <li>- 카카오 닉네임, 이메일 주소</li>
          </ul>

          <p className="mt-4 font-semibold text-neutral-700">나. 서비스 이용 시 이용자가 직접 입력</p>
          <ul className="mt-2 ml-4 space-y-1">
            <li>- 실명, 닉네임(서비스 내 표시용), 전화번호, 지역, 이메일(선택)</li>
          </ul>

          <p className="mt-4 font-semibold text-neutral-700">다. 서비스 이용 과정에서 자동 생성</p>
          <ul className="mt-2 ml-4 space-y-1">
            <li>- 모임 신청 이력, 결제 이력, 참석 기록, 서비스 이용 일시</li>
            <li>- 서비스 이용 통계 분석을 위한 쿠키 및 익명화된 이용 기록(Google Analytics, Vercel Analytics)</li>
          </ul>
        </div>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          2. 개인정보 수집 및 이용 목적
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-neutral-600 leading-relaxed">
          <li>- 서비스 제공: 모임 신청·결제·취소·환불 처리, 모임 일정 안내</li>
          <li>- 이용자 식별: 카카오 로그인을 통한 본인 확인</li>
          <li>- 연락: 모임 관련 공지 및 리마인드 알림 발송(전화번호 활용)</li>
          <li>- 서비스 개선: 이용 통계 분석, 서비스 품질 향상</li>
          <li>- 민원 처리: 이용자 문의 및 불만 처리</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          3. 개인정보 보유 및 이용 기간
        </h2>
        <div className="mt-4 text-sm text-neutral-600 leading-relaxed">
          <p>회원 탈퇴 시까지 보유하며, 탈퇴 시 지체 없이 파기합니다.</p>
          <p className="mt-2">단, 관련 법령에 의해 보존이 필요한 경우 해당 기간 동안 보관합니다.</p>
          <ul className="mt-2 ml-4 space-y-1">
            <li>· 전자상거래 등에서의 소비자보호에 관한 법률</li>
            <li className="ml-4">- 계약 또는 청약 철회 등에 관한 기록: 5년</li>
            <li className="ml-4">- 대금결제 및 재화 등의 공급에 관한 기록: 5년</li>
            <li className="ml-4">- 소비자 불만 또는 분쟁 처리에 관한 기록: 3년</li>
          </ul>
        </div>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          4. 개인정보의 제3자 제공
        </h2>
        <div className="mt-4 text-sm text-neutral-600 leading-relaxed">
          <p>회사는 이용자의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다. 다만, 다음의 경우는 예외입니다.</p>
          <ul className="mt-2 ml-4 space-y-1">
            <li>- 이용자가 사전에 동의한 경우</li>
            <li>- 법령에 의해 요구되는 경우</li>
          </ul>
        </div>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          5. 개인정보 처리 위탁
        </h2>
        <div className="mt-4 text-sm text-neutral-600 leading-relaxed">
          <p>회사는 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁하고 있습니다.</p>
          <ul className="mt-2 ml-4 space-y-1">
            <li>- 결제 처리: 토스페이먼츠 주식회사 (결제 및 환불 처리)</li>
            <li>- 데이터 저장: Supabase (클라우드 데이터베이스)</li>
            <li>- 웹 호스팅: Vercel Inc. (웹사이트 호스팅)</li>
          </ul>
        </div>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          6. 개인정보의 국외 이전
        </h2>
        <div className="mt-4 text-sm text-neutral-600 leading-relaxed">
          <p>회사는 서비스 제공을 위해 아래와 같이 개인정보를 국외로 이전하고 있습니다.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-100">
                  <th className="border border-neutral-200 px-2 py-1.5 text-left font-semibold text-neutral-700">이전받는 자</th>
                  <th className="border border-neutral-200 px-2 py-1.5 text-left font-semibold text-neutral-700">이전 국가</th>
                  <th className="border border-neutral-200 px-2 py-1.5 text-left font-semibold text-neutral-700">이전 항목</th>
                  <th className="border border-neutral-200 px-2 py-1.5 text-left font-semibold text-neutral-700">이전 목적</th>
                  <th className="border border-neutral-200 px-2 py-1.5 text-left font-semibold text-neutral-700">보유 기간</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-neutral-200 px-2 py-1.5">Supabase Inc. (AWS)</td>
                  <td className="border border-neutral-200 px-2 py-1.5">미국</td>
                  <td className="border border-neutral-200 px-2 py-1.5">회원 정보, 모임 신청/결제 내역</td>
                  <td className="border border-neutral-200 px-2 py-1.5">클라우드 데이터베이스 호스팅</td>
                  <td className="border border-neutral-200 px-2 py-1.5">회원 탈퇴 시까지</td>
                </tr>
                <tr>
                  <td className="border border-neutral-200 px-2 py-1.5">Vercel Inc.</td>
                  <td className="border border-neutral-200 px-2 py-1.5">미국</td>
                  <td className="border border-neutral-200 px-2 py-1.5">서비스 접속 로그, 쿠키</td>
                  <td className="border border-neutral-200 px-2 py-1.5">웹 호스팅 및 서버리스 함수 실행</td>
                  <td className="border border-neutral-200 px-2 py-1.5">서비스 이용 기간</td>
                </tr>
                <tr>
                  <td className="border border-neutral-200 px-2 py-1.5">Google LLC (GA4)</td>
                  <td className="border border-neutral-200 px-2 py-1.5">미국</td>
                  <td className="border border-neutral-200 px-2 py-1.5">익명 처리된 서비스 이용 기록</td>
                  <td className="border border-neutral-200 px-2 py-1.5">서비스 이용 통계 분석</td>
                  <td className="border border-neutral-200 px-2 py-1.5">26개월</td>
                </tr>
                <tr>
                  <td className="border border-neutral-200 px-2 py-1.5">주식회사 솔라피</td>
                  <td className="border border-neutral-200 px-2 py-1.5">대한민국</td>
                  <td className="border border-neutral-200 px-2 py-1.5">휴대전화 번호, 모임 정보</td>
                  <td className="border border-neutral-200 px-2 py-1.5">카카오톡 알림톡 발송</td>
                  <td className="border border-neutral-200 px-2 py-1.5">발송 완료 후 즉시</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          7. 이용자의 권리
        </h2>
        <div className="mt-4 text-sm text-neutral-600 leading-relaxed">
          <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
          <ul className="mt-2 ml-4 space-y-1">
            <li>- 개인정보 열람, 정정, 삭제 요청</li>
            <li>- 개인정보 처리 정지 요청</li>
            <li>- 회원 탈퇴 요청</li>
          </ul>
          <p className="mt-2">위 요청은 아래 연락처를 통해 할 수 있으며, 회사는 지체 없이 조치합니다.</p>
          <p className="mt-2">회원 탈퇴를 원하시는 경우, 카카오톡 &lsquo;단무지&rsquo;에게 1:1 채팅으로 연락해 주세요. 탈퇴 요청 시 관련 법령에 따라 보존이 필요한 정보를 제외하고 지체 없이 파기합니다.</p>
        </div>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          8. 개인정보 보호 조치
        </h2>
        <div className="mt-4 text-sm text-neutral-600 leading-relaxed">
          <p>회사는 이용자의 개인정보를 안전하게 관리하기 위해 다음과 같은 조치를 취하고 있습니다.</p>
          <ul className="mt-2 ml-4 space-y-1">
            <li>- 데이터베이스 접근 제어(행 수준 보안 정책 적용)</li>
            <li>- 관리자 인증키와 일반 인증키 분리 운용</li>
            <li>- HTTPS를 통한 데이터 전송 암호화</li>
            <li>- 결제 정보는 회사가 직접 보관하지 않으며, 토스페이먼츠가 처리</li>
          </ul>
        </div>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          9. 개인정보 파기
        </h2>
        <div className="mt-4 text-sm text-neutral-600 leading-relaxed">
          <p>이용자의 개인정보는 수집 및 이용 목적이 달성된 후 지체 없이 파기합니다.</p>
          <ul className="mt-2 ml-4 space-y-1">
            <li>- 전자적 파일 형태: 복구 불가능한 방법으로 삭제</li>
            <li>- 종이 문서: 분쇄기로 분쇄하거나 소각</li>
          </ul>
        </div>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          10. 개인정보보호 책임자
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-neutral-600 leading-relaxed">
          <li>- 책임자: {representative}(대표)</li>
          <li>- 연락처: {contactPhone}</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          11. 개인정보 처리방침 변경
        </h2>
        <div className="mt-4 text-sm text-neutral-600 leading-relaxed">
          <p>이 개인정보처리방침은 2026년 3월 21일부터 적용됩니다.</p>
          <p className="mt-2">변경 시 서비스 내 공지를 통해 안내합니다.</p>
        </div>
      </section>
    </main>
  )
}
