export const VALID_REGIONS = [
  '경주', '포항', '울산', '부산', '대구',
  '창원', '대전', '광주', '전주',
  '수원', '인천', '서울', '제주',
] as const

export type Region = (typeof VALID_REGIONS)[number]
