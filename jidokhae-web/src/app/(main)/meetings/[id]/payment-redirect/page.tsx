import { Suspense } from 'react'
import { isNextUiEnabled } from '@/lib/next-ui'
import PaymentRedirectClient from '@/components/meetings/PaymentRedirectClient'

type Props = {
  params: Promise<{ id: string }>
}

export default async function PaymentRedirectPage({ params }: Props) {
  const { id } = await params
  const nextUi = await isNextUiEnabled()

  return (
    <Suspense fallback={null}>
      <PaymentRedirectClient
        meetingId={id}
        detailHref={nextUi ? `/meet/${id}` : `/meetings/${id}`}
        skin={nextUi ? 'toss' : 'legacy'}
      />
    </Suspense>
  )
}
