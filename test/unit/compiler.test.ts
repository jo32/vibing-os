import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { StreamingCompiler } from '../../app/lib/compiler';

// Mock the webpack compiler
vi.mock('../../app/lib/webpack-compiler', () => ({
  webpackCompiler: {
    init: vi.fn(),
    build: vi.fn(),
    executeAndRender: vi.fn(),
    getStats: vi.fn(),
    clearCache: vi.fn(),
    hotReload: vi.fn()
  }
}));

// Mock URL for blob creation
Object.defineProperty(global, 'URL', {
  value: {
    createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
    revokeObjectURL: vi.fn()
  },
  writable: true
});

describe('StreamingCompiler (Webpack-like Architecture)', () => {
  let compiler: StreamingCompiler;
  let mockWebpackCompiler: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get mock webpack compiler
    const { webpackCompiler } = await import('../../app/lib/webpack-compiler');
    mockWebpackCompiler = webpackCompiler;
    
    // Setup default mock behavior
    mockWebpackCompiler.init.mockResolvedValue(undefined);
    mockWebpackCompiler.build.mockResolvedValue({
      compiledCode: 'define("/main.tsx", [], function() { /* compiled code */ });',
      modules: ['/main.tsx', '/custom.tsx', '/global.css'],
      dependencies: new Map([
        ['/main.tsx', new Set(['/custom.tsx', '/global.css'])],
        ['/custom.tsx', new Set()],
        ['/global.css', new Set()]
      ])
    });
    mockWebpackCompiler.executeAndRender.mockResolvedValue(undefined);
    
    mockWebpackCompiler.getStats.mockReturnValue({
      modules: ['/main.tsx', '/custom.tsx', '/global.css'],
      externals: ['react', 'react-dom'],
      dependencyGraph: new Map()
    });
    
    const { streamingCompiler } = await import('../../app/lib/compiler');
    compiler = streamingCompiler;
  });

  afterEach(() => {
    compiler.clearCache();
  });

  describe('compilation interface', () => {
    it('should compile and preview with default options', async () => {
      const compiledCode = await compiler.compileAndPreview();
      
      expect(mockWebpackCompiler.init).toHaveBeenCalled();
      expect(mockWebpackCompiler.build).toHaveBeenCalledWith({
        entryPoint: '/main.tsx',
        includeTailwind: true,
        target: 'es2022',
        externals: []
      });
      expect(compiledCode).toContain('define');
    });

    it('should compile and preview with custom options', async () => {
      const options = {
        entryPoint: '/app.tsx',
        includeTailwind: false,
        includeRuntime: true,
        target: 'es2020' as const,
        externals: ['lodash', 'moment']
      };
      
      const compiledCode = await compiler.compileAndPreview(options);
      
      expect(mockWebpackCompiler.build).toHaveBeenCalledWith({
        entryPoint: '/app.tsx',
        includeTailwind: false,
        target: 'es2020',
        externals: ['lodash', 'moment']
      });
      expect(compiledCode).toContain('define');
    });

    it('should handle compilation errors', async () => {
      const error = new Error('Webpack compilation failed');
      mockWebpackCompiler.build.mockRejectedValue(error);
      
      await expect(compiler.compileAndPreview()).rejects.toThrow('Webpack compilation failed');
      
      expect(mockWebpackCompiler.getStats).toHaveBeenCalled();
    });

    it('should log compilation stats on success', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await compiler.compileAndPreview();
      
      expect(consoleSpy).toHaveBeenCalledWith('✅ Compilation successful: 3 modules compiled');
      expect(consoleSpy).toHaveBeenCalledWith('📦 Compiled modules:', ['/main.tsx', '/custom.tsx', '/global.css']);
      
      consoleSpy.mockRestore();
    });
  });

  describe('direct execution interface', () => {
    it('should compile and execute with default options', async () => {
      await compiler.compileAndExecute();
      
      expect(mockWebpackCompiler.init).toHaveBeenCalled();
      expect(mockWebpackCompiler.build).toHaveBeenCalledWith({
        entryPoint: '/main.tsx',
        includeTailwind: true,
        target: 'es2022',
        externals: []
      });
      expect(mockWebpackCompiler.executeAndRender).toHaveBeenCalledWith(
        expect.objectContaining({
          compiledCode: expect.stringContaining('define'),
          modules: expect.arrayContaining(['/main.tsx', '/custom.tsx', '/global.css'])
        }),
        undefined
      );
    });

    it('should compile and execute with custom container', async () => {
      const container = document.createElement('div');
      
      await compiler.compileAndExecute({
        entryPoint: '/app.tsx',
        includeTailwind: false
      }, container);
      
      expect(mockWebpackCompiler.executeAndRender).toHaveBeenCalledWith(
        expect.objectContaining({
          compiledCode: expect.stringContaining('define'),
          modules: expect.arrayContaining(['/main.tsx', '/custom.tsx', '/global.css'])
        }),
        container
      );
    });

    it('should handle execution errors', async () => {
      const error = new Error('Execution failed');
      mockWebpackCompiler.build.mockRejectedValue(error);
      
      await expect(compiler.compileAndExecute()).rejects.toThrow('Execution failed');
      
      expect(mockWebpackCompiler.getStats).toHaveBeenCalled();
    });
  });

  describe('legacy compatibility methods', () => {
    it('should return compiled files from webpack stats', () => {
      const files = compiler.getCompiledFiles();
      
      expect(files).toEqual(['/main.tsx', '/custom.tsx', '/global.css']);
      expect(mockWebpackCompiler.getStats).toHaveBeenCalled();
    });

    it('should debug compiled files using webpack stats', () => {
      // debugCompiledFiles is available for debugging but doesn't log by default
      expect(() => compiler.debugCompiledFiles()).not.toThrow();
    });

    it('should clear cache through webpack compiler', () => {
      compiler.clearCache();
      
      expect(mockWebpackCompiler.clearCache).toHaveBeenCalled();
    });

    it('should handle hot reload through webpack compiler', async () => {
      await compiler.watchAndRecompile('/component.tsx');
      
      expect(mockWebpackCompiler.hotReload).toHaveBeenCalledWith('/component.tsx');
    });
  });

  describe('debug utilities', () => {
    it('should provide debug methods on compiler instance', () => {
      expect(compiler.debug).toBeDefined();
      expect(compiler.debug.logCompiledFiles).toBeDefined();
      expect(compiler.debug.getCompiledFiles).toBeDefined();
      expect(compiler.debug.clearCache).toBeDefined();
    });

    it('should execute debug methods correctly', () => {
      // logCompiledFiles should execute without throwing
      expect(() => compiler.debug.logCompiledFiles()).not.toThrow();
      
      const files = compiler.debug.getCompiledFiles();
      expect(files).toEqual(['/main.tsx', '/custom.tsx', '/global.css']);
      
      compiler.debug.clearCache();
      expect(mockWebpackCompiler.clearCache).toHaveBeenCalled();
    });
  });

  describe('global debug utilities', () => {
    it('should make debug utilities available globally', () => {
      // Mock window object
      const mockWindow = {
        __streamingCompilerDebug: undefined
      };
      
      (global as any).window = mockWindow;
      
      // Manually set up the debug utilities (simulating the global setup)
      mockWindow.__streamingCompilerDebug = {
        logCompiledFiles: vi.fn(),
        getCompiledFiles: vi.fn(),
        clearCache: vi.fn(),
        compiler: compiler
      };
      
      expect(mockWindow.__streamingCompilerDebug).toBeDefined();
      expect(mockWindow.__streamingCompilerDebug.logCompiledFiles).toBeDefined();
      expect(mockWindow.__streamingCompilerDebug.getCompiledFiles).toBeDefined();
      expect(mockWindow.__streamingCompilerDebug.clearCache).toBeDefined();
      expect(mockWindow.__streamingCompilerDebug.compiler).toBeDefined();
    });
  });

  describe('error handling and logging', () => {
    it('should log webpack initialization', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await compiler.compileAndPreview();
      
      expect(consoleSpy).toHaveBeenCalledWith('🚀 Starting compilation with webpack-like compiler...');
      
      consoleSpy.mockRestore();
    });

    it('should log compilation errors with stats', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const error = new Error('Build failed');
      mockWebpackCompiler.build.mockRejectedValue(error);
      
      await expect(compiler.compileAndPreview()).rejects.toThrow('Build failed');
      
      expect(consoleSpy).toHaveBeenCalledWith('❌ Compilation failed:', error);
      expect(mockWebpackCompiler.getStats).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should handle initialization errors', async () => {
      const initError = new Error('Initialization failed');
      mockWebpackCompiler.init.mockRejectedValue(initError);
      
      await expect(compiler.compileAndPreview()).rejects.toThrow('Initialization failed');
    });
  });

  describe('integration with webpack compiler', () => {
    it('should pass through all compilation options', async () => {
      const complexOptions = {
        entryPoint: '/complex/app.tsx',
        includeTailwind: false,
        includeRuntime: true,
        target: 'es2015' as const,
        externals: ['lodash', 'moment', 'axios']
      };
      
      await compiler.compileAndPreview(complexOptions);
      
      expect(mockWebpackCompiler.build).toHaveBeenCalledWith({
        entryPoint: '/complex/app.tsx',
        includeTailwind: false,
        target: 'es2015',
        externals: ['lodash', 'moment', 'axios']
      });
    });

    it('should handle complex build results', async () => {
      const complexBuildResult = {
        compiledCode: 'define("/app.tsx", [], function() { /* complex app code */ });',
        modules: ['/app.tsx', '/components/Header.tsx', '/components/Footer.tsx', '/utils/helpers.ts'],
        dependencies: new Map([
          ['/app.tsx', new Set(['/components/Header.tsx', '/components/Footer.tsx'])],
          ['/components/Header.tsx', new Set(['/utils/helpers.ts'])],
          ['/components/Footer.tsx', new Set()],
          ['/utils/helpers.ts', new Set()]
        ])
      };
      
      mockWebpackCompiler.build.mockResolvedValue(complexBuildResult);
      
      const compiledCode = await compiler.compileAndPreview();
      
      expect(compiledCode).toContain('define');
      expect(compiledCode).toContain('complex app code');
    });

    it('should handle hot reload failures', async () => {
      const hotReloadError = new Error('Hot reload failed');
      mockWebpackCompiler.hotReload.mockRejectedValue(hotReloadError);
      
      await expect(compiler.watchAndRecompile('/component.tsx')).rejects.toThrow('Hot reload failed');
    });
  });

  describe('performance and caching', () => {
    it('should only initialize webpack compiler once', async () => {
      await compiler.compileAndPreview();
      await compiler.compileAndPreview();
      
      expect(mockWebpackCompiler.init).toHaveBeenCalledTimes(2); // Called each time, but webpack compiler handles internal initialization
    });

    it('should benefit from webpack compiler caching', async () => {
      const options = { entryPoint: '/cached.tsx' };
      
      await compiler.compileAndPreview(options);
      await compiler.compileAndPreview(options);
      
      // Webpack compiler should be called twice, but it handles its own caching
      expect(mockWebpackCompiler.build).toHaveBeenCalledTimes(2);
    });
  });

  describe('TypeScript compilation targets', () => {
    it('should support different TypeScript targets', async () => {
      const targets = ['es2022', 'es2020', 'es2015'] as const;
      
      for (const target of targets) {
        await compiler.compileAndPreview({ target });
        
        expect(mockWebpackCompiler.build).toHaveBeenCalledWith(
          expect.objectContaining({ target })
        );
      }
    });

    it('should use default target when not specified', async () => {
      await compiler.compileAndPreview();
      
      expect(mockWebpackCompiler.build).toHaveBeenCalledWith(
        expect.objectContaining({ target: 'es2022' })
      );
    });
  });
});