'use client';

import React, { useEffect, useRef, useState } from 'react';
import { webpackCompiler } from '../lib/webpack-compiler';

interface PreviewProps {
  entryPoint?: string;
  includeTailwind?: boolean;
  includeRuntime?: boolean;
  onError?: (error: Error) => void;
  className?: string;
}

export function Preview({ 
  entryPoint = '/main.tsx',
  includeTailwind = true,
  includeRuntime = true,
  onError,
  className = 'w-full h-full border border-gray-300'
}: PreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compileAndPreview = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Clear previous render and reset React root
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
        // Clear any existing React root
        if ((window as any).__reactRoot) {
          delete (window as any).__reactRoot;
        }
      }

      // Initialize compiler if needed
      await webpackCompiler.init();

      // Build the application
      const buildResult = await webpackCompiler.build({
        entryPoint,
        includeTailwind
      });

      // Execute and render the application in the container
      const container = containerRef.current;
      if (!container) {
        console.warn('Preview container not ready, retrying...');
        // Retry after a short delay
        setTimeout(() => compileAndPreview(), 100);
        return;
      }
      
      await webpackCompiler.executeAndRender(buildResult, container);

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial compilation
  useEffect(() => {
    compileAndPreview();
  }, [entryPoint, includeTailwind, includeRuntime]);

  // Expose refresh method
  useEffect(() => {
    (window as any).refreshPreview = compileAndPreview;
  }, []);

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-red-50`}>
        <div className="text-center p-4">
          <div className="text-red-600 font-semibold mb-2">Compilation Error</div>
          <div className="text-red-500 text-sm font-mono whitespace-pre-wrap">{error}</div>
          <button 
            onClick={compileAndPreview}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-50`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <div className="text-gray-600">Compiling...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-white">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{
          margin: 0,
          padding: 0,
          width: '100%',
          height: '100%',
          overflow: 'auto',
          backgroundColor: 'white',
          display: 'block',
          position: 'relative'
        }}
      />
      <button
        onClick={compileAndPreview}
        className="absolute top-2 right-2 px-3 py-1 bg-blue-600 text-white text-sm rounded shadow hover:bg-blue-700 opacity-75 hover:opacity-100 z-10"
        title="Refresh Preview"
      >
        ↻
      </button>
    </div>
  );
}