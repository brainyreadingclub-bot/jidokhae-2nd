export default function EmptyMeetings() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-gray-300 mb-4"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      <p className="text-sm font-medium text-gray-400">
        다가오는 모임이 없습니다
      </p>
      <p className="mt-1 text-xs text-gray-300">
        새로운 모임이 등록되면 여기에 표시됩니다
      </p>
    </div>
  )
}
