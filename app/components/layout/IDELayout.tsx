'use client'

import React, { useState, useCallback } from 'react'
import ResizablePanel from './ResizablePanel'
import FileExplorer from './FileExplorer'
import EditorPanel from '../editor/EditorPanel'
import { Preview } from '../preview'
import { vfs } from '../../lib/filesystem'

interface IDELayoutProps {
  className?: string
}

export default function IDELayout({ className = '' }: IDELayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState(20)
  const [editorHeight, setEditorHeight] = useState(60)
  const [rightPanelView, setRightPanelView] = useState<'files' | 'preview'>('files')

  const handleFileSelect = useCallback(async (path: string) => {
    // Open file in editor
    if (typeof window !== 'undefined' && (window as any).editorOpenFile) {
      try {
        await (window as any).editorOpenFile(path)
      } catch (error) {
        console.error('Failed to open file:', error)
      }
    }
  }, [])

  const handleFileSave = useCallback(async (path: string, content: string) => {
    // Refresh preview after save
    if (typeof window !== 'undefined' && (window as any).refreshPreview) {
      setTimeout(() => {
        (window as any).refreshPreview()
      }, 100)
    }
  }, [])

  return (
    <div className={`h-screen bg-gray-900 flex ${className}`}>
      {/* Left Sidebar */}
      <div className="bg-gray-800 border-r border-gray-600" style={{ width: `${sidebarWidth}%` }}>
        <FileExplorer
          onFileSelect={handleFileSelect}
          className="h-full"
        />
      </div>

      {/* Resize Handle */}
      <div
        className="w-1 bg-gray-600 cursor-col-resize hover:bg-blue-500 transition-colors"
        onMouseDown={(e) => {
          e.preventDefault()
          const startX = e.clientX
          const startWidth = sidebarWidth

          const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - startX
            const containerWidth = window.innerWidth
            const deltaPercent = (deltaX / containerWidth) * 100
            const newWidth = Math.max(15, Math.min(40, startWidth + deltaPercent))
            setSidebarWidth(newWidth)
          }

          const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
          }

          document.addEventListener('mousemove', handleMouseMove)
          document.addEventListener('mouseup', handleMouseUp)
          document.body.style.cursor = 'col-resize'
          document.body.style.userSelect = 'none'
        }}
      />

      {/* Main Area: Editor + Bottom Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Editor Panel */}
        <div className="bg-gray-900" style={{ height: `${editorHeight}%` }}>
          <EditorPanel
            filesystem={vfs}
            onSave={handleFileSave}
            theme="dark"
          />
        </div>

        {/* Vertical Resize Handle */}
        <div
          className="h-1 bg-gray-600 cursor-row-resize hover:bg-blue-500 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault()
            const startY = e.clientY
            const startHeight = editorHeight

            const handleMouseMove = (e: MouseEvent) => {
              const deltaY = e.clientY - startY
              const containerHeight = window.innerHeight
              const deltaPercent = (deltaY / containerHeight) * 100
              const newHeight = Math.max(30, Math.min(80, startHeight + deltaPercent))
              setEditorHeight(newHeight)
            }

            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove)
              document.removeEventListener('mouseup', handleMouseUp)
              document.body.style.cursor = ''
              document.body.style.userSelect = ''
            }

            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = 'row-resize'
            document.body.style.userSelect = 'none'
          }}
        />

        {/* Bottom Panel with Toggle */}
        <div className="flex-1 bg-white flex flex-col">
          {/* Panel Header with Toggle */}
          <div className="h-10 bg-gray-100 border-b border-gray-300 flex items-center justify-between px-4 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">
                {rightPanelView === 'files' ? 'Files' : 'Preview'}
              </span>
            </div>
            
            {/* Toggle Buttons */}
            <div className="flex items-center bg-gray-200 rounded-md p-1">
              <button
                onClick={() => setRightPanelView('files')}
                className={`p-1.5 rounded transition-colors ${
                  rightPanelView === 'files' 
                    ? 'bg-white shadow-sm text-gray-900' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Show Files"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1.75 2.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V5.5a.25.25 0 0 0-.25-.25H9.586a.25.25 0 0 1-.177-.073L7.823 3.591A.25.25 0 0 0 7.646 3.5H1.75zM0 2.75C0 1.784.784 1 1.75 1h5.896c.464 0 .909.184 1.237.513L10.469 3.1c.328.328.772.513 1.237.513h2.544A1.75 1.75 0 0 1 16 5.25v7.75A1.75 1.75 0 0 1 14.25 14.5H1.75A1.75 1.75 0 0 1 0 12.75V2.75z"/>
                </svg>
              </button>
              
              <button
                onClick={() => setRightPanelView('preview')}
                className={`p-1.5 rounded transition-colors ${
                  rightPanelView === 'preview' 
                    ? 'bg-white shadow-sm text-gray-900' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Show Preview"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 2C4.5 2 1.5 4.5 0 8c1.5 3.5 4.5 6 8 6s6.5-2.5 8-6c-1.5-3.5-4.5-6-8-6zm0 10c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
              </button>
            </div>
          </div>
          
          {/* Panel Content */}
          <div className="flex-1 min-h-0">
            {rightPanelView === 'files' ? (
              <div className="h-full bg-gray-800">
                <FileExplorer
                  onFileSelect={handleFileSelect}
                  className="h-full"
                />
              </div>
            ) : (
              <div className="h-full p-4 bg-gray-50">
                <div className="h-full bg-white rounded-lg shadow-lg border border-gray-200 p-4">
                  <div className="h-full border border-gray-300 rounded overflow-auto bg-white">
                    <Preview
                      entryPoint="/main.tsx"
                      includeTailwind={true}
                      className="w-full h-full"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}