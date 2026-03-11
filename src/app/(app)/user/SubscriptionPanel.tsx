'use client'

import { useState, useTransition } from 'react'
import { purchaseSubscription } from './actions'
import type { Subscription, SubscriptionPlan } from './types'

interface SubscriptionPanelProps {
  subscription: Subscription | null
  mealsRemaining: number
  plans: SubscriptionPlan[]
  onSubscriptionChange: (sub: Subscription, remaining: number) => void
}

export default function SubscriptionPanel({
  subscription,
  mealsRemaining,
  plans,
  onSubscriptionChange,
}: SubscriptionPanelProps) {
  const [showPlanPicker, setShowPlanPicker] = useState(!subscription)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [isPurchasePending, startPurchaseTransition] = useTransition()
  const [purchaseError, setPurchaseError] = useState<string | null>(null)

  const plan = subscription?.subscription_plans ?? null
  const mealsTotal = plan?.meals_count ?? 1
  const progressPct = Math.min(100, Math.round((mealsRemaining / mealsTotal) * 100))

  function handlePurchase() {
    if (!selectedPlanId) return
    setPurchaseError(null)
    startPurchaseTransition(async () => {
      const result = await purchaseSubscription(selectedPlanId)
      if ('error' in result) {
        setPurchaseError(result.error)
      } else {
        onSubscriptionChange(result.subscription as any, result.subscription.meals_remaining)
        setShowPlanPicker(false)
        setSelectedPlanId(null)
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Current balance card */}
      <div style={cardStyle}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#2C1810', marginBottom: 16 }}>
          מנוי נוכחי
        </div>

        {subscription ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.55)', fontWeight: 600, marginBottom: 4 }}>
                {plan?.name_he}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
                <span style={{ fontSize: 'clamp(2rem,6vw,3rem)', fontWeight: 800, color: '#FF6B35', lineHeight: 1 }}>
                  {mealsRemaining}
                </span>
                <span style={{ fontSize: 13, color: 'rgba(44,24,16,0.45)' }}>
                  מ-{plan?.meals_count} ארוחות נותרו
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

            <button
              onClick={() => setShowPlanPicker((v) => !v)}
              style={{
                padding: '8px 16px', borderRadius: 10, border: '1.5px solid rgba(255,107,53,0.35)',
                background: 'rgba(255,107,53,0.08)', color: '#FF6B35', fontSize: 14,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              {showPlanPicker ? 'סגור' : 'חדש / שדרג מנוי'}
            </button>
          </>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: 'rgba(44,24,16,0.5)', marginBottom: 12, padding: '10px 14px', background: 'rgba(44,24,16,0.05)', borderRadius: 12 }}>
              אין מנוי פעיל
            </div>
            <button
              onClick={() => setShowPlanPicker(true)}
              className="btn-subscription-cta"
              style={{ border: 'none' }}
            >
              🛒 רכוש מנוי
            </button>
          </div>
        )}
      </div>

      {/* Plan picker */}
      {showPlanPicker && (
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
            onClick={handlePurchase}
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
              onClick={() => { setShowPlanPicker(false); setSelectedPlanId(null); setPurchaseError(null) }}
              style={{ width: '100%', background: 'none', border: 'none', marginTop: 10, fontSize: 13, color: 'rgba(44,24,16,0.4)', cursor: 'pointer', textAlign: 'center' }}
            >
              ביטול
            </button>
          )}
        </div>
      )}
    </div>
  )
}
