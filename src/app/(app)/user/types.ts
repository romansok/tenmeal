export interface DietaryTag { id: string; label_he: string }
export interface KidRestriction { dietary_tag_id: string; dietary_tags: DietaryTag | null }

export interface Kid {
  id: string
  name: string
  class_name: string | null
  emoji_avatar: string
  sort_order: number
  kid_dietary_restrictions: KidRestriction[]
}

export interface SubscriptionPlan {
  id: string
  name_he: string
  meals_count: number
  price_agorot: number
}

export interface Subscription {
  id: string
  meals_remaining: number
  starts_at: string
  expires_at: string | null
  subscription_plans: SubscriptionPlan | null
}

export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  onboarding_done: boolean
}

export interface MenuItem {
  id: string
  name_he: string
  price_agorot: number
  is_customizable: boolean
  image_url: string | null
}

export interface OrderItem { id: string; menu_item_id: string; quantity: number }
export interface ExistingOrder {
  id: string
  kid_id: string | null
  delivery_date: string
  notes: string | null
  status: string
  order_items: OrderItem[]
}

export interface DayPlan { menuItemId: string | null; notes: string }
