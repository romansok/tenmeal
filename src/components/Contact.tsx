'use client'

import { useState, useEffect } from 'react'
import { PLANS, WHATSAPP_NUMBER } from '@/lib/constants'

interface ContactProps {
  selectedPlan: string
}

export default function Contact({ selectedPlan }: ContactProps) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    message: '',
    plan: selectedPlan || '',
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  useEffect(() => {
    if (selectedPlan) {
      setForm((prev) => ({ ...prev, plan: selectedPlan }))
    }
  }, [selectedPlan])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setStatus('success')
        setForm({ name: '', phone: '', email: '', message: '', plan: '' })
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  const whatsappUrl =
    WHATSAPP_NUMBER !== 'PLACEHOLDER'
      ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('שלום, אני מתעניין בארוחת 10')}`
      : '#'

  return (
    <section id="contact" className="py-24 px-6" style={{ backgroundColor: '#F5EDD9' }}>
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black text-deep-espresso mb-3">
            יש לכם שאלות?
          </h2>
          <p className="text-deep-espresso/50 text-lg">
            נשמח לענות ולעזור לכם להתחיל
          </p>
        </div>

        <div className="glass-contact p-8">
          {status === 'success' ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-black text-deep-espresso mb-2">
                ההודעה נשלחה בהצלחה!
              </h3>
              <p className="text-deep-espresso/50 text-sm">
                ניצור איתכם קשר בהקדם האפשרי.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-deep-espresso mb-1.5">
                  שם מלא <span className="text-sunrise-orange">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="ישראל ישראלי"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-deep-espresso mb-1.5">
                  טלפון <span className="text-sunrise-orange">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  placeholder="050-0000000"
                  dir="ltr"
                  className="input-field text-right"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-deep-espresso mb-1.5">
                  אימייל
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  dir="ltr"
                  className="input-field text-right"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-deep-espresso mb-1.5">
                  חבילה
                </label>
                <select
                  name="plan"
                  value={form.plan}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="">בחר חבילה (אופציונלי)</option>
                  {PLANS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} — ₪{p.price}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-deep-espresso mb-1.5">
                  הודעה
                </label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  rows={4}
                  placeholder="שאלות, בקשות מיוחדות..."
                  className="input-field resize-none"
                />
              </div>

              {status === 'error' && (
                <p className="text-error text-sm font-semibold text-center bg-error/5 py-2 rounded-lg">
                  אירעה שגיאה. אנא נסו שוב או פנו אלינו בוואטסאפ.
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="btn-primary w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? 'שולח...' : 'שלח הודעה'}
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-warm-amber/20 text-center">
            <p className="text-deep-espresso/40 text-sm mb-3">
              או צרו קשר ישירות
            </p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white font-bold text-sm px-6 py-3 rounded-xl hover:bg-[#1ebe5a] transition-colors duration-150"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.109.549 4.09 1.509 5.814L0 24l6.335-1.492A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.652-.51-5.17-1.395l-.37-.22-3.762.886.948-3.653-.242-.376A9.964 9.964 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
              וואטסאפ
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
