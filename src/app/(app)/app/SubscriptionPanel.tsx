'use client'

import { useState, useTransition, useEffect } from 'react'
import { purchaseSubscription, toggleAutoRenew } from './actions'
import type { Subscription, SubscriptionPlan, SubscriptionHistoryItem } from './types'

interface SubscriptionPanelProps {
  subscription: Subscription | null
  mealsRemaining: number
  mealsTotal: number
  plans: SubscriptionPlan[]
  onSubscriptionChange: (sub: Subscription, remaining: number) => void
  subscriptionHistory: SubscriptionHistoryItem[]
  onHistoryChange: (newSub: SubscriptionHistoryItem) => void
}

export default function SubscriptionPanel({
  subscription,
  mealsRemaining,
  mealsTotal,
  plans,
  onSubscriptionChange,
  subscriptionHistory,
  onHistoryChange,
}: SubscriptionPanelProps) {
  const [showRenewConfirm, setShowRenewConfirm] = useState(false)
  const [showUpgradePicker, setShowUpgradePicker] = useState(!subscription)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [isPurchasePending, startPurchaseTransition] = useTransition()
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [autoRenew, setAutoRenew] = useState(subscription?.auto_renew ?? false)
  const [isTogglePending, startToggleTransition] = useTransition()

  // Sync autoRenew and picker state when subscription prop changes (e.g. after purchase)
  useEffect(() => {
    setAutoRenew(subscription?.auto_renew ?? false)
    if (subscription) setShowUpgradePicker(false)
  }, [subscription?.id])

  const plan = subscription?.subscription_plans ?? null
  const progressPct = Math.min(100, Math.round((mealsRemaining / (mealsTotal || 1)) * 100))

  function handlePurchase(planId: string) {
    setPurchaseError(null)
    startPurchaseTransition(async () => {
      const result = await purchaseSubscription(planId)
      if ('error' in result) {
        setPurchaseError(result.error)
      } else {
        const newSub = result.subscription as any
        onSubscriptionChange(newSub, newSub.meals_remaining)
        onHistoryChange({
          id: newSub.id,
          meals_remaining: newSub.meals_remaining,
          starts_at: newSub.starts_at,
          expires_at: newSub.expires_at,
          status: 'active',
          auto_renew: newSub.auto_renew ?? false,
          subscription_plans: newSub.subscription_plans,
        })
        setShowRenewConfirm(false)
        setShowUpgradePicker(false)
        setSelectedPlanId(null)
      }
    })
  }

  function handleToggleAutoRenew() {
    if (!subscription) return
    const next = !autoRenew
    setAutoRenew(next) // optimistic
    startToggleTransition(async () => {
      const result = await toggleAutoRenew(subscription.id, next)
      if ('error' in result) {
        setAutoRenew(!next) // revert
      }
    })
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.18)',
    backdropFilter: 'blur(12px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.35)',
    boxShadow: '0 8px 32px rgba(31,38,135,0.12)',
    borderRadius: 20,
    padding: 24,
  }

  const rowStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.10)',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: 12,
    padding: '10px 14px',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Section 1 — Current Plan Card */}
      <div style={cardStyle}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#2C1810', marginBottom: 16 }}>
          מנוי נוכחי
        </div>

        {subscription ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
                <span style={{ fontSize: 'clamp(2rem,6vw,3rem)', fontWeight: 800, color: '#FF6B35', lineHeight: 1 }}>
                  {mealsRemaining}
                </span>
                <span style={{ fontSize: 13, color: 'rgba(44,24,16,0.45)' }}>
                  מ-{mealsTotal} ארוחות נותרו
                </span>
              </div>
              <div className="balance-track">
                <div className="balance-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            {subscription.expires_at && (
              <div style={{ fontSize: 13, color: 'rgba(44,24,16,0.5)', marginBottom: 16 }}>
                תוקף: {new Date(subscription.expires_at).toLocaleDateString('he-IL')}
              </div>
            )}

            {/* Auto-renew toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: 'rgba(44,24,16,0.7)', fontWeight: 600 }}>חידוש אוטומטי</span>
              <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoRenew}
                  onChange={handleToggleAutoRenew}
                  disabled={isTogglePending}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                />
                <span style={{
                  position: 'absolute', inset: 0, borderRadius: 24,
                  background: autoRenew ? '#FF6B35' : 'rgba(44,24,16,0.15)',
                  transition: 'background 200ms ease-out',
                }} />
                <span style={{
                  position: 'absolute', top: 3, left: autoRenew ? 23 : 3,
                  width: 18, height: 18, borderRadius: '50%', background: 'white',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  transition: 'left 200ms ease-out',
                }} />
              </label>
            </div>

            {/* Two action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setShowRenewConfirm(true); setShowUpgradePicker(false) }}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 10,
                  border: '1.5px solid rgba(255,107,53,0.35)',
                  background: showRenewConfirm ? 'rgba(255,107,53,0.15)' : 'rgba(255,107,53,0.08)',
                  color: '#FF6B35', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                חדש מנוי
              </button>
              <button
                onClick={() => { setShowUpgradePicker(true); setShowRenewConfirm(false) }}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 10,
                  border: '1.5px solid rgba(255,107,53,0.35)',
                  background: showUpgradePicker ? 'rgba(255,107,53,0.15)' : 'rgba(255,107,53,0.08)',
                  color: '#FF6B35', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                שדרג
              </button>
            </div>
          </>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: 'rgba(44,24,16,0.5)', marginBottom: 12, padding: '10px 14px', background: 'rgba(44,24,16,0.05)', borderRadius: 12 }}>
              אין מנוי פעיל
            </div>
            <button
              onClick={() => setShowUpgradePicker(true)}
              className="btn-subscription-cta"
              style={{ border: 'none' }}
            >
              🛒 רכוש מנוי
            </button>
          </div>
        )}
      </div>

      {/* Section 2 — Renewal Confirmation Card */}
      {showRenewConfirm && subscription && plan && (
        <div style={cardStyle}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2C1810', marginBottom: 16 }}>
            חידוש מנוי
          </div>
          <div style={{ ...rowStyle, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2C1810' }}>{plan.name_he}</div>
            <div style={{ fontSize: 13, color: 'rgba(44,24,16,0.55)', marginTop: 4 }}>
              🍽️ {plan.meals_count} ארוחות &nbsp;·&nbsp; ₪{Math.round(plan.price_agorot / 100)}
            </div>
          </div>
          <button
            onClick={() => handlePurchase(plan.id)}
            disabled={isPurchasePending}
            style={{
              width: '100%', height: 48, borderRadius: 14, border: 'none',
              fontSize: 16, fontWeight: 700, cursor: isPurchasePending ? 'default' : 'pointer',
              color: 'white', background: isPurchasePending ? 'rgba(255,107,53,0.5)' : '#FF6B35',
              marginBottom: 8, transition: 'background 200ms ease-out',
            }}
          >
            {isPurchasePending ? 'מעבד...' : 'אשר חידוש'}
          </button>
          <button
            onClick={() => { setShowRenewConfirm(false); setPurchaseError(null) }}
            style={{ width: '100%', background: 'none', border: 'none', fontSize: 13, color: 'rgba(44,24,16,0.4)', cursor: 'pointer', textAlign: 'center' }}
          >
            ביטול
          </button>
          {purchaseError && (
            <div style={{ color: '#EF476F', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
              {purchaseError}
            </div>
          )}
        </div>
      )}

      {/* Section 3 — Upgrade Plan Picker */}
      {showUpgradePicker && (
        <div style={cardStyle}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2C1810', marginBottom: 16 }}>
            בחר חבילה
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {plans.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlanId(p.id)}
                className={`plan-card${selectedPlanId === p.id ? ' plan-card-selected' : ''}`}
                style={{ border: undefined }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#2C1810' }}>{p.name_he}</span>
                  <span style={{ fontSize: 17, fontWeight: 800, color: '#FF6B35' }}>
                    ₪{Math.round(p.price_agorot / 100)}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'rgba(44,24,16,0.55)', marginTop: 4 }}>
                  🍽️ {p.meals_count} ארוחות
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => selectedPlanId && handlePurchase(selectedPlanId)}
            disabled={!selectedPlanId || isPurchasePending}
            style={{
              width: '100%', height: 52, borderRadius: 14, border: 'none',
              fontSize: 16, fontWeight: 700,
              cursor: selectedPlanId && !isPurchasePending ? 'pointer' : 'default',
              color: selectedPlanId ? 'white' : 'rgba(44,24,16,0.35)',
              background: selectedPlanId ? '#FF6B35' : 'rgba(44,24,16,0.08)',
              transition: 'background 200ms ease-out',
            }}
          >
            {isPurchasePending ? 'מעבד...' : 'אשר רכישה'}
          </button>

          {purchaseError && (
            <div style={{ color: '#EF476F', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
              {purchaseError}
            </div>
          )}

          {subscription && (
            <button
              onClick={() => { setShowUpgradePicker(false); setSelectedPlanId(null); setPurchaseError(null) }}
              style={{ width: '100%', background: 'none', border: 'none', marginTop: 10, fontSize: 13, color: 'rgba(44,24,16,0.4)', cursor: 'pointer', textAlign: 'center' }}
            >
              ביטול
            </button>
          )}
        </div>
      )}

      {/* Section 4 — Purchase History (hidden when empty) */}
      {subscriptionHistory.length > 0 && (
        <div style={cardStyle}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2C1810', marginBottom: 16 }}>
            היסטוריית רכישות
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            ...(subscriptionHistory.length > 10 ? { maxHeight: 800, overflowY: 'auto' } : {}),
          }}>
            {subscriptionHistory.map((item) => (
              <div key={item.id} style={rowStyle}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#2C1810', marginBottom: 2 }}>
                  {item.subscription_plans?.name_he ?? '—'}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(44,24,16,0.45)' }}>
                  {new Date(item.starts_at).toLocaleDateString('he-IL')}
                  {' → '}
                  {item.expires_at ? new Date(item.expires_at).toLocaleDateString('he-IL') : 'ללא תפוגה'}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(44,24,16,0.45)', marginTop: 2 }}>
                  🍽️ {item.subscription_plans?.meals_count ?? '—'} ארוחות
                  {item.subscription_plans?.price_agorot
                    ? ` · ₪${Math.round(item.subscription_plans.price_agorot / 100)}`
                    : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

