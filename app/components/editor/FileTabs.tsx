'use client'

import React from 'react'
import FileTab from './FileTab'

export interface OpenFile {
  path: string
  content: string
  isDirty: boolean
}

interface FileTabsProps {
  openFiles: OpenFile[]
  activeFile: string | null
  onFileSelect: (path: string) => void
  onFileClose: (path: string) => void
}

export default function FileTabs({ openFiles, activeFile, onFileSelect, onFileClose }: FileTabsProps) {
  if (openFiles.length === 0) {
    return (
      <div className="h-10 bg-gray-800 border-b border-gray-600 flex items-center px-4">
        <span className="text-gray-400 text-sm">No files open</span>
      </div>
    )
  }

  return (
    <div className="h-10 bg-gray-800 border-b border-gray-600 flex overflow-x-auto scrollbar-thin">
      {openFiles.map((file) => (
        <FileTab
          key={file.path}
          fileName={file.path.split('/').pop() || file.path}
          isActive={file.path === activeFile}
          isDirty={file.isDirty}
          onClick={() => onFileSelect(file.path)}
          onClose={() => onFileClose(file.path)}
        />
      ))}
    </div>
  )
}