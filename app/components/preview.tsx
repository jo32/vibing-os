'use client';

import React, { useEffect, useRef, useState } from 'react';
import { streamingCompiler } from '../lib/compiler';

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
      // Clear previous render
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      // Compile and execute the project directly
      await streamingCompiler.compileAndExecute({
        entryPoint,
        includeTailwind,
        includeRuntime
      }, containerRef.current || undefined);

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
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className={className}
        style={{
          margin: 0,
          padding: '16px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          width: '100%',
          height: '100%',
          overflow: 'auto'
        }}
      />
      <button
        onClick={compileAndPreview}
        className="absolute top-2 right-2 px-3 py-1 bg-blue-600 text-white text-sm rounded shadow hover:bg-blue-700 opacity-75 hover:opacity-100"
        title="Refresh Preview"
      >
        ↻
      </button>
    </div>
  );
}