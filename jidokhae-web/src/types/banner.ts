export type Banner = {
  id: string
  title: string
  description: string | null
  link_url: string | null
  image_url: string | null
  is_active: boolean
  display_order: number // 작을수록 먼저 노출
  created_at: string
  updated_at: string
}
