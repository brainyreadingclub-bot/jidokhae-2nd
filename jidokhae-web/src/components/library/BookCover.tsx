import { highResCoverUrl } from '@/lib/book-cover'

type Props = {
  thumbnail: string | null
  title: string
}

/**
 * 책 표지. 카카오 이미지를 그대로 참조(재호스팅 안 함).
 * thumbnail은 120×174 리사이즈본이라 3배 밀도 기기에서 뭉개진다 →
 * highResCoverUrl로 원본(약 458×670)을 쓴다. 근거는 lib/book-cover.ts 주석.
 * 표지 없으면 중립 톤 배경 + 제목 텍스트 fallback (색 난사 금지).
 */
export default function BookCover({ thumbnail, title }: Props) {
  const src = highResCoverUrl(thumbnail)

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={title}
        loading="lazy"
        decoding="async"
        className="w-full aspect-[2/3] rounded-[6px] object-cover border border-neutral-200 shadow-sm"
      />
    )
  }
  return (
    <div className="w-full aspect-[2/3] rounded-[6px] border border-neutral-200 bg-neutral-100 flex items-end p-1.5">
      <span
        className="text-[10.5px] font-bold text-neutral-600 leading-tight break-keep"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title}
      </span>
    </div>
  )
}
