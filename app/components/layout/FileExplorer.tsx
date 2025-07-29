'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { vfs } from '../../lib/filesystem'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  isExpanded?: boolean
}

interface FileExplorerProps {
  onFileSelect?: (path: string) => void
  onFileCreate?: (path: string) => void
  onFileDelete?: (path: string) => void
  className?: string
}

export default function FileExplorer({ 
  onFileSelect, 
  onFileCreate, 
  onFileDelete,
  className = '' 
}: FileExplorerProps) {
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const getFileIcon = (fileName: string, isDirectory: boolean) => {
    if (isDirectory) return '📁'
    
    const ext = fileName.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'tsx':
      case 'ts': return '📘'
      case 'jsx':
      case 'js': return '📙'
      case 'css': return '🎨'
      case 'json': return '📋'
      case 'md': return '📝'
      default: return '📄'
    }
  }

  const loadFileTree = useCallback(async () => {
    setIsLoading(true)
    try {
      await vfs.init()
      const rootFiles = await buildFileTree('/')
      setFileTree(rootFiles)
    } catch (error) {
      console.error('Failed to load file tree:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const buildFileTree = async (dirPath: string): Promise<FileNode[]> => {
    try {
      const entries = await vfs.readdir(dirPath)
      const nodes: FileNode[] = []

      for (const entry of entries) {
        const fullPath = dirPath === '/' ? `/${entry}` : `${dirPath}/${entry}`
        
        try {
          const stats = await vfs.stat(fullPath)
          const isDirectory = stats.isDirectory?.() || false

          const node: FileNode = {
            name: entry,
            path: fullPath,
            type: isDirectory ? 'directory' : 'file',
            isExpanded: false
          }

          if (isDirectory) {
            node.children = []
          }

          nodes.push(node)
        } catch (statError) {
          console.warn(`Failed to stat ${fullPath}:`, statError)
        }
      }

      return nodes.sort((a, b) => {
        // Directories first, then files
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
    } catch (error) {
      console.error(`Failed to read directory ${dirPath}:`, error)
      return []
    }
  }

  const toggleDirectory = async (node: FileNode) => {
    if (node.type !== 'directory') return

    const updateNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(n => {
        if (n.path === node.path) {
          return { ...n, isExpanded: !n.isExpanded }
        }
        if (n.children) {
          return { ...n, children: updateNode(n.children) }
        }
        return n
      })
    }

    setFileTree(prev => updateNode(prev))

    // Load children if expanding and not already loaded
    if (!node.isExpanded && (!node.children || node.children.length === 0)) {
      try {
        const children = await buildFileTree(node.path)
        
        const updateNodeChildren = (nodes: FileNode[]): FileNode[] => {
          return nodes.map(n => {
            if (n.path === node.path) {
              return { ...n, children }
            }
            if (n.children) {
              return { ...n, children: updateNodeChildren(n.children) }
            }
            return n
          })
        }

        setFileTree(prev => updateNodeChildren(prev))
      } catch (error) {
        console.error('Failed to load directory children:', error)
      }
    }
  }

  const handleFileClick = (node: FileNode) => {
    if (node.type === 'directory') {
      toggleDirectory(node)
    } else {
      setSelectedPath(node.path)
      onFileSelect?.(node.path)
    }
  }

  const renderFileNode = (node: FileNode, depth = 0) => {
    const isSelected = selectedPath === node.path
    const paddingLeft = depth * 16 + 8

    return (
      <div key={node.path}>
        <div
          className={`
            flex items-center py-1 px-2 cursor-pointer hover:bg-gray-700 text-sm
            ${isSelected ? 'bg-blue-600 text-white' : 'text-gray-300'}
          `}
          style={{ paddingLeft }}
          onClick={() => handleFileClick(node)}
        >
          <span className="mr-2 text-xs">
            {node.type === 'directory' ? (node.isExpanded ? '📂' : '📁') : getFileIcon(node.name, false)}
          </span>
          <span className="truncate">{node.name}</span>
        </div>
        
        {node.type === 'directory' && node.isExpanded && node.children && (
          <div>
            {node.children.map(child => renderFileNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  useEffect(() => {
    loadFileTree()
  }, [loadFileTree])

  if (isLoading) {
    return (
      <div className={`bg-gray-800 ${className}`}>
        <div className="p-4 text-center text-gray-400">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto mb-2"></div>
          Loading files...
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-gray-800 text-gray-300 overflow-y-auto ${className}`}>
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-200">Explorer</h3>
      </div>
      
      <div className="py-2">
        {fileTree.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No files found
          </div>
        ) : (
          fileTree.map(node => renderFileNode(node))
        )}
      </div>
    </div>
  )
}