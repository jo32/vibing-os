'use client'

import React from 'react'

interface FileTabProps {
  fileName: string
  isActive: boolean
  isDirty: boolean
  onClick: () => void
  onClose: () => void
}

export default function FileTab({ fileName, isActive, isDirty, onClick, onClose }: FileTabProps) {
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClose()
  }

  return (
    <div
      className={`
        flex items-center px-3 py-2 border-r border-gray-600 cursor-pointer
        transition-colors duration-150 min-w-0 max-w-48
        ${isActive 
          ? 'bg-gray-800 text-white border-b-2 border-blue-500' 
          : 'bg-gray-700 text-gray-300 hover:bg-gray-650'
        }
      `}
      onClick={onClick}
    >
      <span className="truncate text-sm">
        {fileName}
        {isDirty && <span className="text-orange-400 ml-1">•</span>}
      </span>
      <button
        className="ml-2 p-1 rounded hover:bg-gray-600 opacity-60 hover:opacity-100"
        onClick={handleClose}
        aria-label={`Close ${fileName}`}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 4.586L10.293.293a1 1 0 011.414 1.414L7.414 6l4.293 4.293a1 1 0 01-1.414 1.414L6 7.414l-4.293 4.293a1 1 0 01-1.414-1.414L4.586 6 .293 1.707A1 1 0 011.707.293L6 4.586z"/>
        </svg>
      </button>
    </div>
  )
}