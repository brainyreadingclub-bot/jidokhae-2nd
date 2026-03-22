/**
 * Solapi 알림톡 발송 래퍼.
 * variables key에 반드시 #{} 포함 필수 (e.g. '#{회원명}': '홍길동').
 */

import { SolapiMessageService } from 'solapi'

const messageService = new SolapiMessageService(
  process.env.SOLAPI_API_KEY!,
  process.env.SOLAPI_API_SECRET!,
)

type AlimtalkParams = {
  to: string
  templateId: string
  variables: Record<string, string>
}

export async function sendAlimtalk({ to, templateId, variables }: AlimtalkParams) {
  return messageService.send({
    to: to.replace(/-/g, ''),
    from: process.env.SOLAPI_SENDER_PHONE!,
    kakaoOptions: {
      pfId: process.env.SOLAPI_KAKAO_CHANNEL!,
      templateId,
      variables,
    },
  })
}
