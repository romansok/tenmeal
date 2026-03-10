'use client'

import { PLANS } from '@/lib/constants'

interface PlansProps {
  onSelectPlan: (planId: string) => void
}

export default function Plans({ onSelectPlan }: PlansProps) {
  const scrollToContact = (planId: string) => {
    onSelectPlan(planId)
    setTimeout(() => {
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  return (
    <section id="plans" className="py-24 px-6 bg-[#FFF8F0]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-black text-deep-espresso mb-3">
            בחרו את החבילה המתאימה
          </h2>
          <p className="text-deep-espresso/50 text-lg">
            ארוחות טריות מוכנות לילד שלכם — בלי לחץ בבוקר
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              onClick={() => scrollToContact(plan.id)}
              className={`relative cursor-pointer rounded-2xl p-8 text-center transition-all duration-200 hover:-translate-y-1 ${
                plan.recommended
                  ? 'glass-plan-featured shadow-2xl shadow-sunrise-orange/25 md:scale-105'
                  : 'card-outline hover:shadow-lg'
              }`}
            >
              {plan.recommended && (
                <span className="absolute -top-3 right-1/2 translate-x-1/2 inline-block bg-sunrise-orange text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
                  הכי פופולרי ⭐
                </span>
              )}

              <div className={`text-6xl font-black mb-1 ${plan.recommended ? 'text-deep-espresso' : 'text-deep-espresso'}`}>
                {plan.meals}
              </div>
              <div className={`text-base font-semibold mb-6 ${plan.recommended ? 'text-deep-espresso/60' : 'text-deep-espresso/50'}`}>
                ארוחות
              </div>

              <div className={`text-4xl font-black mb-1 ${plan.recommended ? 'text-sunrise-orange' : 'text-sunrise-orange'}`}>
                ₪{plan.price}
              </div>
              <div className={`text-sm mb-8 ${plan.recommended ? 'text-deep-espresso/40' : 'text-deep-espresso/40'}`}>
                ₪{(plan.price / plan.meals).toFixed(0)} לארוחה
              </div>

              <button
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-150 ${
                  plan.recommended
                    ? 'bg-deep-espresso text-white hover:bg-[#3d2015]'
                    : 'bg-deep-espresso text-white hover:bg-[#3d2015]'
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  scrollToContact(plan.id)
                }}
              >
                בחר חבילה
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
