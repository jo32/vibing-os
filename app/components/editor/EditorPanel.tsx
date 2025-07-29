'use client'

import React, { useState, useCallback, useEffect } from 'react'
import CodeEditor from './CodeEditor'
import FileTabs, { OpenFile } from './FileTabs'

interface EditorPanelProps {
  filesystem?: any // FileSystem instance
  onSave?: (path: string, content: string) => void
  theme?: 'light' | 'dark'
}

export default function EditorPanel({ filesystem, onSave, theme = 'dark' }: EditorPanelProps) {
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)

  // Get the language for a file based on its extension
  const getLanguage = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'tsx':
      case 'ts':
        return 'typescript'
      case 'jsx':
      case 'js':
        return 'javascript'
      case 'css':
        return 'css'
      case 'html':
        return 'html'
      case 'json':
        return 'json'
      case 'md':
        return 'markdown'
      default:
        return 'plaintext'
    }
  }

  // Open a file in the editor
  const openFile = useCallback(async (path: string) => {
    if (!filesystem) return

    try {
      const content = await filesystem.readFile(path, 'utf8')
      
      // Check if file is already open
      const existingFileIndex = openFiles.findIndex(f => f.path === path)
      
      if (existingFileIndex >= 0) {
        // File already open, just switch to it
        setActiveFile(path)
      } else {
        // Add new file to open files
        const newFile: OpenFile = {
          path,
          content,
          isDirty: false
        }
        setOpenFiles(prev => [...prev, newFile])
        setActiveFile(path)
      }
    } catch (error) {
      console.error('Failed to open file:', error)
    }
  }, [filesystem, openFiles])

  // Close a file
  const closeFile = useCallback((path: string) => {
    setOpenFiles(prev => {
      const filtered = prev.filter(f => f.path !== path)
      
      // If closing the active file, switch to another file
      if (path === activeFile) {
        const currentIndex = prev.findIndex(f => f.path === path)
        const nextFile = filtered[currentIndex] || filtered[currentIndex - 1] || null
        setActiveFile(nextFile?.path || null)
      }
      
      return filtered
    })
  }, [activeFile])

  // Handle file content change
  const handleContentChange = useCallback((value: string | undefined) => {
    if (!activeFile || value === undefined) return

    setOpenFiles(prev => prev.map(file => 
      file.path === activeFile 
        ? { ...file, content: value, isDirty: true }
        : file
    ))
  }, [activeFile])

  // Save file
  const handleSave = useCallback(async (content: string) => {
    if (!activeFile || !filesystem) return

    try {
      await filesystem.writeFile(activeFile, content)
      
      // Mark file as not dirty
      setOpenFiles(prev => prev.map(file => 
        file.path === activeFile 
          ? { ...file, isDirty: false }
          : file
      ))

      if (onSave) {
        onSave(activeFile, content)
      }
    } catch (error) {
      console.error('Failed to save file:', error)
    }
  }, [activeFile, filesystem, onSave])

  // Get current file content
  const currentFile = openFiles.find(f => f.path === activeFile)

  // Expose openFile method for external use
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).editorOpenFile = openFile
    }
  }, [openFile])

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <FileTabs
        openFiles={openFiles}
        activeFile={activeFile}
        onFileSelect={setActiveFile}
        onFileClose={closeFile}
      />
      
      <div className="flex-1 min-h-0">
        {currentFile ? (
          <CodeEditor
            value={currentFile.content}
            onChange={handleContentChange}
            language={getLanguage(currentFile.path)}
            theme={theme}
            onSave={handleSave}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-6xl mb-4">📝</div>
              <p className="text-lg">No file selected</p>
              <p className="text-sm mt-2">Open a file from the file explorer to start editing</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}