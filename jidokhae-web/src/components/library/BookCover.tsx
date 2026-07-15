type Props = {
  thumbnail: string | null
  title: string
}

/**
 * 책 표지. 카카오 thumbnail URL을 그대로 참조(재호스팅 안 함).
 * 표지 없으면 중립 톤 배경 + 제목 텍스트 fallback (색 난사 금지).
 */
export default function BookCover({ thumbnail, title }: Props) {
  if (thumbnail) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbnail}
        alt={title}
        loading="lazy"
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
