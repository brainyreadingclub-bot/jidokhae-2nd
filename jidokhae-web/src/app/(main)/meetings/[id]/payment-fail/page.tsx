import { Suspense } from 'react'
import { isNextUiEnabled } from '@/lib/next-ui'
import PaymentFailClient from '@/components/meetings/PaymentFailClient'

type Props = {
  params: Promise<{ id: string }>
}

export default async function PaymentFailPage({ params }: Props) {
  const { id } = await params
  const nextUi = await isNextUiEnabled()

  return (
    <Suspense fallback={null}>
      <PaymentFailClient
        detailHref={nextUi ? `/meet/${id}` : `/meetings/${id}`}
        skin={nextUi ? 'toss' : 'legacy'}
      />
    </Suspense>
  )
}
