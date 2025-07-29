'use client'

import React, { useEffect, useState } from 'react'
import IDELayout from '../components/layout/IDELayout'
import { vfs } from '../lib/filesystem'

export default function IDEPage() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadFixtures = async () => {
      try {
        // Load fixture files into virtual filesystem for testing
        const mainTsx = await fetch('/test/fixtures/main.tsx').then(r => r.text())
        const customTsx = await fetch('/test/fixtures/custom.tsx').then(r => r.text())
        const globalCss = await fetch('/test/fixtures/global.css').then(r => r.text())

        await vfs.writeFile('/main.tsx', mainTsx)
        await vfs.writeFile('/custom.tsx', customTsx)
        await vfs.writeFile('/global.css', globalCss)

        console.log('✅ Test fixtures loaded for IDE')
      } catch (error) {
        console.error('❌ Failed to load fixtures:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadFixtures()
  }, [])

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading VibingOS IDE...</p>
        </div>
      </div>
    )
  }

  return <IDELayout />
}