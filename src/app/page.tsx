'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import Plans from '@/components/Plans'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'

export default function Home() {
  const [selectedPlan, setSelectedPlan] = useState('')

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Plans onSelectPlan={setSelectedPlan} />
        <Contact selectedPlan={selectedPlan} />
      </main>
      <Footer />
    </>
  )
}
