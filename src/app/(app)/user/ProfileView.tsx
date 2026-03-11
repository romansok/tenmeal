'use client'

import { useState } from 'react'
import OrdersPanel from './OrdersPanel'
import SubscriptionPanel from './SubscriptionPanel'
import AccountPanel from './AccountPanel'
import type { Profile, Kid, Subscription, MenuItem, ExistingOrder, SubscriptionPlan, SubscriptionHistoryItem, DietaryTag } from './types'

interface ProfileViewProps {
  profile: Profile
  kids: Kid[]
  subscription: Subscription | null
  initialMealsRemaining: number
  mealsTotal: number
  menuItems: MenuItem[]
  initialWeekOrders: ExistingOrder[]
  initialWeekStart: string
  plans: SubscriptionPlan[]
  subscriptionHistory: SubscriptionHistoryItem[]
  dietaryTags: DietaryTag[]
}

type Tab = 'orders' | 'subscription' | 'account'

const TAB_LABELS: Record<Tab, string> = {
  orders: 'הזמנות',
  subscription: 'מנוי',
  account: 'חשבון',
}

const TAB_ICONS: Record<Tab, string> = {
  orders: '🍱',
  subscription: '⭐',
  account: '👤',
}

export default function ProfileView({
  profile,
  kids,
  subscription,
  initialMealsRemaining,
  mealsTotal,
  menuItems,
  initialWeekOrders,
  initialWeekStart,
  plans,
  subscriptionHistory,
  dietaryTags,
}: ProfileViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('orders')
  const [localKids, setLocalKids] = useState<Kid[]>(kids)
  const [localSubscription, setLocalSubscription] = useState<Subscription | null>(subscription)
  const [mealsRemainingLocal, setMealsRemainingLocal] = useState(initialMealsRemaining)
  const [mealsTotalLocal, setMealsTotalLocal] = useState(mealsTotal)
  const [localHistory, setLocalHistory] = useState<SubscriptionHistoryItem[]>(subscriptionHistory)

  function handleMealsUsed(n: number) {
    setMealsRemainingLocal((prev) => Math.max(0, prev - n))
  }

  function handleSubscriptionChange(sub: Subscription, remaining: number) {
    setLocalSubscription(sub)
    setMealsRemainingLocal((prev) => prev + remaining)
    setMealsTotalLocal((prev) => prev + (sub.subscription_plans?.meals_count ?? 0))
  }

  function handleHistoryChange(newSub: SubscriptionHistoryItem) {
    setLocalHistory((prev) => [newSub, ...prev])
  }

  const tabs: Tab[] = ['orders', 'subscription', 'account']

  return (
    <div dir="rtl">
      {/* Mobile tab bar */}
      <div className="user-tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`user-tab-item${activeTab === tab ? ' user-tab-item-active' : ''}`}
          >
            <span style={{ fontSize: 18 }}>{TAB_ICONS[tab]}</span>
            <span>{TAB_LABELS[tab]}</span>
          </button>
        ))}
      </div>

      {/* Page layout: sidebar (RTL right) + content (left) */}
      <div className="user-page-layout">

        {/* Sidebar — desktop only */}
        <nav className="user-sidebar">
          {/* Hero strip */}
          <div className="user-hero-strip">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="avatar"
                style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div
                style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #FFB347, #FF6B35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 18, fontWeight: 700,
                }}
              >
                {(profile.full_name ?? 'U')[0]}
              </div>
            )}
            <span style={{ fontSize: 14, fontWeight: 600, color: '#2C1810', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile.full_name ?? 'שם לא הוגדר'}
            </span>
          </div>

          {/* Nav items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0' }}>
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`sidebar-nav-item${activeTab === tab ? ' sidebar-nav-item-active' : ''}`}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{TAB_ICONS[tab]}</span>
                <span>{TAB_LABELS[tab]}</span>
              </button>
            ))}
          </div>

          {/* Meals remaining mini indicator */}
          {localSubscription && (
            <div style={{ padding: '12px 16px', marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.35)' }}>
              <div style={{ fontSize: 11, color: 'rgba(44,24,16,0.45)', fontWeight: 600, marginBottom: 4 }}>
                יתרת ארוחות
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#FF6B35', lineHeight: 1, marginBottom: 6 }}>
                {mealsRemainingLocal}
              </div>
              <div className="balance-track" style={{ height: 6 }}>
                <div
                  className="balance-fill"
                  style={{
                    width: `${Math.min(100, Math.round((mealsRemainingLocal / (mealsTotalLocal || 1)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}
        </nav>

        {/* Content area */}
        <div className="user-content-area">
          {activeTab === 'orders' && (
            <OrdersPanel
              profileId={profile.id}
              kids={localKids}
              subscription={localSubscription}
              menuItems={menuItems}
              initialWeekOrders={initialWeekOrders}
              mealsRemaining={mealsRemainingLocal}
              onMealsUsed={handleMealsUsed}
            />
          )}
          {activeTab === 'subscription' && (
            <SubscriptionPanel
              subscription={localSubscription}
              mealsRemaining={mealsRemainingLocal}
              mealsTotal={mealsTotalLocal}
              plans={plans}
              onSubscriptionChange={handleSubscriptionChange}
              subscriptionHistory={localHistory}
              onHistoryChange={handleHistoryChange}
            />
          )}
          {activeTab === 'account' && (
            <AccountPanel
              profile={profile}
              kids={localKids}
              dietaryTags={dietaryTags}
              onKidsChange={setLocalKids}
            />
          )}
        </div>
      </div>
    </div>
  )
}
