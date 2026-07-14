/**
 * 목적격 조사(을/를)를 붙인다. 마지막 글자에 받침 있으면 '을', 없으면 '를'.
 * 한글이 아니면(영문/숫자 끝) '를'로 근사.
 */
export function withObjectParticle(word: string): string {
  const last = word.trim().slice(-1)
  const code = last.charCodeAt(0)
  // 한글 음절 영역(가~힣)에서 받침 유무 판정
  if (code >= 0xac00 && code <= 0xd7a3) {
    const hasBatchim = (code - 0xac00) % 28 !== 0
    return `${word}${hasBatchim ? '을' : '를'}`
  }
  return `${word}를`
}
