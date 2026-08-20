import BookIntro from '@/components/meetings/BookIntro'

/**
 * 토론모임 신청 상세의 책 섹션 (2026-08-18 표지 배치 확정).
 * 순서: 대형 표지(96×144) → 선정 이유(사람) → 책 소개(출판사, 3줄 접기)
 * — 2026-08-13 신청 설계서 §5-4의 확정 순서.
 */

type Props = {
  book: {
    title: string
    authors: string | null
    publisher: string | null
    thumbnail: string | null
    description: string | null
  }
  selectionReason: string | null
}

export default function BookSection({ book, selectionReason }: Props) {
  return (
    <div className="mt-5">
      <div className="flex gap-4">
        {book.thumbnail ? (
          <img
            src={book.thumbnail}
            alt={book.title}
            width={96}
            height={144}
            className="h-[144px] w-[96px] flex-none rounded-[6px] object-cover"
            style={{ boxShadow: '0 0 0 1px rgba(0,0,0,.06), 0 8px 18px rgba(25,31,40,.18)' }}
          />
        ) : (
          <div className="flex h-[144px] w-[96px] flex-none items-center justify-center rounded-[6px] bg-neutral-100 p-2 text-center text-xs font-bold text-neutral-600">
            {book.title}
          </div>
        )}
        <div className="min-w-0 self-center">
          <p className="text-xs font-bold text-primary-600">이달의 토론 책</p>
          <p className="mt-1 text-lg font-extrabold leading-snug tracking-tight text-neutral-900">
            {book.title}
          </p>
          {(book.authors || book.publisher) && (
            <p className="mt-1 text-xs text-neutral-500">
              {[book.authors, book.publisher].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {selectionReason && (
        <div className="mt-4 rounded-xl bg-primary-50 px-4 py-3.5">
          <p className="text-[11px] font-bold text-primary-700">이 책을 고른 이유</p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-800 break-keep">
            {selectionReason}
          </p>
        </div>
      )}

      {book.description && <BookIntro description={book.description} />}
    </div>
  )
}
