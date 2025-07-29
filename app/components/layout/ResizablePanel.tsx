'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'

interface ResizablePanelProps {
  children: React.ReactNode
  direction: 'horizontal' | 'vertical'
  initialSize?: number
  minSize?: number
  maxSize?: number
  onSizeChange?: (size: number) => void
  className?: string
}

export default function ResizablePanel({
  children,
  direction,
  initialSize = 50,
  minSize = 10,
  maxSize = 90,
  onSizeChange,
  className = ''
}: ResizablePanelProps) {
  const [size, setSize] = useState(initialSize)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    let newSize: number

    if (direction === 'horizontal') {
      const containerWidth = containerRect.width
      const mouseX = e.clientX - containerRect.left
      newSize = (mouseX / containerWidth) * 100
    } else {
      const containerHeight = containerRect.height
      const mouseY = e.clientY - containerRect.top
      newSize = (mouseY / containerHeight) * 100
    }

    // Clamp size within bounds
    newSize = Math.max(minSize, Math.min(maxSize, newSize))
    
    setSize(newSize)
    onSizeChange?.(newSize)
  }, [isDragging, direction, minSize, maxSize, onSizeChange])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, handleMouseMove, handleMouseUp, direction])

  const panelStyle = direction === 'horizontal' 
    ? { width: `${size}%` }
    : { height: `${size}%` }

  const resizerClass = direction === 'horizontal'
    ? 'w-1 h-full cursor-col-resize hover:bg-blue-500 bg-gray-300'
    : 'h-1 w-full cursor-row-resize hover:bg-blue-500 bg-gray-300'

  return (
    <div
      ref={containerRef}
      className={`flex ${direction === 'horizontal' ? 'flex-row' : 'flex-col'} ${className}`}
    >
      <div
        style={panelStyle}
        className="overflow-hidden"
      >
        {children}
      </div>
      
      <div
        className={`${resizerClass} ${isDragging ? 'bg-blue-500' : ''} transition-colors`}
        onMouseDown={handleMouseDown}
      />
    </div>
  )
}