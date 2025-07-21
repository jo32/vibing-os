'use client';

import { webpackCompiler } from './webpack-compiler';

interface CompileOptions {
  entryPoint?: string;
  includeTailwind?: boolean;
  includeRuntime?: boolean;
  target?: 'es2022' | 'es2020' | 'es2015';
  externals?: string[];
}

export class StreamingCompiler {
  async compileAndExecute(options: CompileOptions = {}, container?: HTMLElement): Promise<void> {
    const { 
      entryPoint = '/main.tsx',
      includeTailwind = true,
      includeRuntime = true,
      target = 'es2022',
      externals = []
    } = options;

    try {
      console.log('🚀 Starting compilation with webpack-like compiler...');
      
      // Initialize the webpack compiler
      await webpackCompiler.init();

      // Build the application bundle
      const buildResult = await webpackCompiler.build({
        entryPoint,
        includeTailwind,
        target,
        externals
      });

      console.log(`✅ Compilation successful: ${buildResult.modules.length} modules compiled`);
      console.log('📦 Compiled modules:', buildResult.modules);
      
      // Execute the compiled code and render the application
      await webpackCompiler.executeAndRender(buildResult, container);
      
    } catch (error) {
      console.error('❌ Compilation failed:', error);
      
      // Log webpack compiler stats for debugging
      const stats = webpackCompiler.getStats();
      
      throw error;
    }
  }

  // Legacy method for backward compatibility - now just returns compiled code
  async compileAndPreview(options: CompileOptions = {}): Promise<string> {
    const { 
      entryPoint = '/main.tsx',
      includeTailwind = true,
      includeRuntime = true,
      target = 'es2022',
      externals = []
    } = options;

    try {
      console.log('🚀 Starting compilation with webpack-like compiler...');
      
      // Initialize the webpack compiler
      await webpackCompiler.init();

      // Build the application bundle
      const buildResult = await webpackCompiler.build({
        entryPoint,
        includeTailwind,
        target,
        externals
      });

      console.log(`✅ Compilation successful: ${buildResult.modules.length} modules compiled`);
      console.log('📦 Compiled modules:', buildResult.modules);
      
      // Return the compiled code directly instead of blob URL
      return buildResult.compiledCode;
      
    } catch (error) {
      console.error('❌ Compilation failed:', error);
      
      // Log webpack compiler stats for debugging
      const stats = webpackCompiler.getStats();
      
      throw error;
    }
  }

  // Legacy methods for compatibility
  getCompiledFiles() {
    return webpackCompiler.getStats().modules;
  }

  debugCompiledFiles() {
  }

  clearCache() {
    webpackCompiler.clearCache();
  }

  // Hot reload functionality
  async watchAndRecompile(filePath: string): Promise<void> {
    await webpackCompiler.hotReload(filePath);
  }
}

export const streamingCompiler = new StreamingCompiler();

// Add debug utilities for easy access
(streamingCompiler as any).debug = {
  logCompiledFiles: () => streamingCompiler.debugCompiledFiles(),
  getCompiledFiles: () => streamingCompiler.getCompiledFiles(),
  clearCache: () => streamingCompiler.clearCache()
};

// Make debugging globally available in development
if (typeof window !== 'undefined') {
  (window as any).__streamingCompilerDebug = {
    logCompiledFiles: () => streamingCompiler.debugCompiledFiles(),
    getCompiledFiles: () => streamingCompiler.getCompiledFiles(),
    clearCache: () => streamingCompiler.clearCache(),
    compiler: streamingCompiler
  };
}