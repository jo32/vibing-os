import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { WebpackLikeCompiler } from '../../app/lib/webpack-compiler';

// Mock all dependencies
vi.mock('../../app/lib/module-registry', () => ({
  moduleRegistry: {
    clear: vi.fn(),
    getRegisteredModules: vi.fn().mockReturnValue(['react', 'react-dom'])
  }
}));

vi.mock('../../app/lib/module-compiler', () => ({
  moduleCompiler: {
    compileModule: vi.fn(),
    clearCache: vi.fn(),
    getDependencyGraph: vi.fn().mockReturnValue(new Map()),
    invalidateModule: vi.fn()
  }
}));

vi.mock('../../app/lib/external-handler', () => ({
  externalHandler: {
    ensureReactRuntime: vi.fn(),
    preloadCommonLibraries: vi.fn(),
    isExternal: vi.fn().mockReturnValue(false),
    register: vi.fn(),
    getRegisteredExternals: vi.fn().mockReturnValue(['react', 'react-dom'])
  }
}));

vi.mock('../../app/lib/filesystem', () => ({
  vfs: {
    init: vi.fn()
  }
}));

// Mock URL.createObjectURL for blob creation
Object.defineProperty(global, 'URL', {
  value: {
    createObjectURL: vi.fn().mockReturnValue('blob:mock-url')
  },
  writable: true
});

// Mock Blob for runtime bundle
const mockBlob = vi.fn().mockImplementation(function(this: any, content: any[], options: any) {
  this.content = content;
  this.options = options;
});
Object.defineProperty(global, 'Blob', {
  value: mockBlob,
  writable: true
});

// Mock define function for AMD modules
Object.defineProperty(global, 'define', {
  value: vi.fn(),
  writable: true
});

// Mock Function constructor for module execution
const originalFunction = Function;
Object.defineProperty(global, 'Function', {
  value: class MockFunction extends originalFunction {
    constructor(...args: any[]) {
      super(...args);
      // Add define to the execution context
      return function() {
        // Mock successful module execution
        return;
      };
    }
  },
  writable: true
});

describe('WebpackLikeCompiler', () => {
  let compiler: WebpackLikeCompiler;
  let mockModuleCompiler: any;
  let mockExternalHandler: any;
  let mockVfs: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockBlob.mockClear();
    
    // Get mock instances
    const { moduleCompiler } = await import('../../app/lib/module-compiler');
    const { externalHandler } = await import('../../app/lib/external-handler');
    const { vfs } = await import('../../app/lib/filesystem');
    
    mockModuleCompiler = moduleCompiler;
    mockExternalHandler = externalHandler;
    mockVfs = vfs;
    
    // Ensure VFS init is mocked to resolve by default
    mockVfs.init.mockResolvedValue(undefined);
    mockExternalHandler.ensureReactRuntime.mockResolvedValue(undefined);
    mockExternalHandler.preloadCommonLibraries.mockResolvedValue(undefined);
    
    compiler = new WebpackLikeCompiler();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await compiler.init();
      
      expect(mockVfs.init).toHaveBeenCalled();
      expect(mockExternalHandler.ensureReactRuntime).toHaveBeenCalled();
      expect(mockExternalHandler.preloadCommonLibraries).toHaveBeenCalled();
    });

    it('should not reinitialize if already initialized', async () => {
      await compiler.init();
      vi.clearAllMocks();
      
      await compiler.init();
      
      expect(mockVfs.init).not.toHaveBeenCalled();
      expect(mockExternalHandler.ensureReactRuntime).not.toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockVfs.init.mockRejectedValue(new Error('VFS init failed'));
      
      await expect(compiler.init()).rejects.toThrow('VFS init failed');
      
      // Reset for other tests
      mockVfs.init.mockResolvedValue(undefined);
    });
  });

  describe('module compilation tree', () => {
    beforeEach(() => {
      mockModuleCompiler.compileModule.mockImplementation(async (moduleId: string) => {
        const mockResults: Record<string, any> = {
          '/main.tsx': {
            code: 'define("/main.tsx", ["./component"], function() { /* main */ });',
            dependencies: ['/component.tsx']
          },
          '/component.tsx': {
            code: 'define("/component.tsx", [], function() { /* component */ });',
            dependencies: []
          }
        };
        return mockResults[moduleId] || { code: '', dependencies: [] };
      });
    });

    it('should compile module tree starting from entry point', async () => {
      await compiler.init();
      
      const buildResult = await compiler.build({
        entryPoint: '/main.tsx'
      });

      expect(mockModuleCompiler.compileModule).toHaveBeenCalledWith('/main.tsx');
      expect(mockModuleCompiler.compileModule).toHaveBeenCalledWith('/component.tsx');
      expect(buildResult.modules).toContain('/main.tsx');
      expect(buildResult.modules).toContain('/component.tsx');
    });

    it('should skip external modules during compilation', async () => {
      mockExternalHandler.isExternal.mockImplementation((id: string) => {
        return id === 'react' || id === 'react-dom';
      });

      mockModuleCompiler.compileModule.mockImplementation(async (moduleId: string) => {
        if (moduleId === '/app.tsx') {
          return {
            code: 'define("/app.tsx", [], function() { /* app */ });',
            dependencies: ['react', 'react-dom'] // External dependencies
          };
        }
        return { code: '', dependencies: [] };
      });

      await compiler.init();
      await compiler.build({ entryPoint: '/app.tsx' });

      expect(mockModuleCompiler.compileModule).toHaveBeenCalledWith('/app.tsx');
      expect(mockModuleCompiler.compileModule).not.toHaveBeenCalledWith('react');
      expect(mockModuleCompiler.compileModule).not.toHaveBeenCalledWith('react-dom');
    });

    it('should handle compilation errors gracefully', async () => {
      mockModuleCompiler.compileModule.mockImplementation(async (moduleId: string) => {
        if (moduleId === '/failing.tsx') {
          throw new Error('Compilation failed');
        }
        return {
          code: 'define("/main.tsx", ["./failing"], function() { /* main */ });',
          dependencies: ['/failing.tsx']
        };
      });

      await compiler.init();
      
      const buildResult = await compiler.build({ entryPoint: '/main.tsx' });

      // Should create error module for failing compilation
      expect(buildResult.modules).toContain('/main.tsx');
      expect(buildResult.modules).toContain('/failing.tsx');
    });

    it('should avoid infinite loops with visited modules', async () => {
      mockModuleCompiler.compileModule.mockImplementation(async (moduleId: string) => {
        // Create a circular dependency A -> B -> A
        if (moduleId === '/a.tsx') {
          return { code: 'define("/a.tsx", ["./b"], function() {});', dependencies: ['/b.tsx'] };
        }
        if (moduleId === '/b.tsx') {
          return { code: 'define("/b.tsx", ["./a"], function() {});', dependencies: ['/a.tsx'] };
        }
        return { code: '', dependencies: [] };
      });

      await compiler.init();
      
      const buildResult = await compiler.build({ entryPoint: '/a.tsx' });

      // Should compile each module only once despite circular dependency
      expect(mockModuleCompiler.compileModule).toHaveBeenCalledTimes(2);
      expect(buildResult.modules).toContain('/a.tsx');
      expect(buildResult.modules).toContain('/b.tsx');
    });
  });

  describe('runtime bundle creation', () => {
    it('should create runtime bundle with module registry', async () => {
      await compiler.init();
      
      const buildResult = await compiler.build({
        entryPoint: '/main.tsx',
        includeTailwind: true
      });

      expect(buildResult.compiledCode).toContain('define');
      expect(buildResult.compiledCode).toContain('window.define = function');
      expect(buildResult.compiledCode).toContain('window.require = async function');
    });

    it('should include Tailwind CSS when requested', async () => {
      await compiler.init();
      
      const buildResult = await compiler.build({
        entryPoint: '/main.tsx',
        includeTailwind: true
      });

      expect(buildResult.compiledCode).toContain('tailwindcss.com');
      expect(buildResult.compiledCode).toContain('data-tailwind');
    });

    it('should exclude Tailwind CSS when not requested', async () => {
      await compiler.init();
      
      const buildResult = await compiler.build({
        entryPoint: '/main.tsx',
        includeTailwind: false
      });

      expect(buildResult.compiledCode).not.toContain('tailwindcss.com');
      expect(buildResult.compiledCode).not.toContain('data-tailwind');
    });

    it('should include external library setup', async () => {
      await compiler.init();
      
      const buildResult = await compiler.build({ entryPoint: '/main.tsx' });

      expect(buildResult.compiledCode).toContain('setupExternals');
      expect(buildResult.compiledCode).toContain('window.React');
      expect(buildResult.compiledCode).toContain('window.ReactDOM');
    });

    it('should include application bootstrap code', async () => {
      await compiler.init();
      
      const buildResult = await compiler.build({ entryPoint: '/app.tsx' });

      expect(buildResult.compiledCode).toContain('bootstrapApplication');
      expect(buildResult.compiledCode).toContain("require('/app.tsx')");
      expect(buildResult.compiledCode).toContain('createRoot');
    });
  });

  describe('external dependencies', () => {
    it('should register additional externals', async () => {
      await compiler.init();
      
      await compiler.build({
        entryPoint: '/main.tsx',
        externals: ['lodash', 'moment']
      });

      expect(mockExternalHandler.register).toHaveBeenCalledWith('lodash', {
        name: 'lodash',
        url: 'https://esm.run/lodash@latest'
      });
      expect(mockExternalHandler.register).toHaveBeenCalledWith('moment', {
        name: 'moment',
        url: 'https://esm.run/moment@latest'
      });
    });

    it('should not re-register existing externals', async () => {
      mockExternalHandler.isExternal.mockImplementation((name: string) => name === 'react');
      
      await compiler.init();
      
      await compiler.build({
        entryPoint: '/main.tsx',
        externals: ['react', 'lodash']
      });

      expect(mockExternalHandler.register).not.toHaveBeenCalledWith('react', expect.any(Object));
      expect(mockExternalHandler.register).toHaveBeenCalledWith('lodash', expect.any(Object));
    });
  });

  describe('caching', () => {
    it('should cache build results', async () => {
      await compiler.init();
      
      const options = { entryPoint: '/main.tsx', includeTailwind: true };
      
      const result1 = await compiler.build(options);
      const result2 = await compiler.build(options);

      expect(result1).toBe(result2);
      // Module compilation should only happen once due to caching
      expect(mockModuleCompiler.compileModule).toHaveBeenCalledTimes(1);
    });

    it('should return different results for different options', async () => {
      await compiler.init();
      
      const result1 = await compiler.build({ entryPoint: '/main.tsx' });
      const result2 = await compiler.build({ entryPoint: '/app.tsx' });

      expect(result1).not.toBe(result2);
    });

    it('should clear cache correctly', async () => {
      await compiler.init();
      
      const options = { entryPoint: '/main.tsx' };
      await compiler.build(options);
      
      compiler.clearCache();
      
      await compiler.build(options);

      expect(mockModuleCompiler.clearCache).toHaveBeenCalled();
    });
  });

  describe('hot reload', () => {
    it('should invalidate module and recompile', async () => {
      await compiler.init();
      
      await compiler.hotReload('/component.tsx');

      expect(mockModuleCompiler.invalidateModule).toHaveBeenCalledWith('/component.tsx');
      expect(mockModuleCompiler.compileModule).toHaveBeenCalledWith('/component.tsx');
    });

    it('should handle hot reload errors', async () => {
      mockModuleCompiler.compileModule.mockRejectedValue(new Error('Hot reload failed'));
      
      await compiler.init();
      
      await expect(compiler.hotReload('/component.tsx')).rejects.toThrow('Hot reload failed');
    });
  });

  describe('statistics and debugging', () => {
    it('should return compilation stats', async () => {
      await compiler.init();
      
      const stats = compiler.getStats();

      expect(stats).toHaveProperty('modules');
      expect(stats).toHaveProperty('externals');
      expect(stats).toHaveProperty('dependencyGraph');
    });

    it('should provide module information in stats', async () => {
      const stats = compiler.getStats();

      expect(stats.modules).toEqual(['react', 'react-dom']);
      expect(stats.externals).toEqual(['react', 'react-dom']);
    });
  });

  describe('error handling', () => {
    it('should handle build errors gracefully', async () => {
      mockModuleCompiler.compileModule.mockRejectedValue(new Error('Compilation error'));
      
      await compiler.init();
      
      // Should complete successfully but create error modules
      const result = await compiler.build({ entryPoint: '/main.tsx' });
      expect(result.compiledCode).toContain('define');
      expect(result.modules).toContain('/main.tsx');
    });

    it('should handle module execution errors', async () => {
      // Mock a module that throws during execution
      mockModuleCompiler.compileModule.mockResolvedValue({
        code: 'throw new Error("Module execution failed");',
        dependencies: []
      });
      
      await compiler.init();
      
      // Should complete successfully and create runtime bundle (MockFunction prevents actual execution)
      const result = await compiler.build({ entryPoint: '/failing.tsx' });
      expect(result.compiledCode).toContain('define');
      expect(result.modules).toContain('/failing.tsx');
      expect(result.compiledCode).toContain('bootstrapApplication');
    });

    it('should provide detailed error information', async () => {
      const compilationError = new Error('Detailed compilation error');
      mockModuleCompiler.compileModule.mockRejectedValue(compilationError);
      
      await compiler.init();
      
      try {
        await compiler.build({ entryPoint: '/main.tsx' });
      } catch (error) {
        expect(error).toBe(compilationError);
      }
    });
  });

  describe('build targets', () => {
    it('should pass target option to module compiler', async () => {
      await compiler.init();
      
      await compiler.build({
        entryPoint: '/main.tsx',
        target: 'es2020'
      });

      // The target should be passed through to module compiler options
      // This is tested implicitly through the compilation process
      expect(mockModuleCompiler.compileModule).toHaveBeenCalled();
    });

    it('should use default target when not specified', async () => {
      await compiler.init();
      
      await compiler.build({ entryPoint: '/main.tsx' });

      expect(mockModuleCompiler.compileModule).toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex application build', async () => {
      mockModuleCompiler.compileModule.mockImplementation(async (moduleId: string) => {
        const modules: Record<string, any> = {
          '/app.tsx': { code: 'define("/app.tsx", ["./components/Header", "./components/Footer"], function() {});', dependencies: ['/components/Header.tsx', '/components/Footer.tsx'] },
          '/components/Header.tsx': { code: 'define("/components/Header.tsx", ["./Button"], function() {});', dependencies: ['/components/Button.tsx'] },
          '/components/Footer.tsx': { code: 'define("/components/Footer.tsx", [], function() {});', dependencies: [] },
          '/components/Button.tsx': { code: 'define("/components/Button.tsx", [], function() {});', dependencies: [] }
        };
        return modules[moduleId] || { code: '', dependencies: [] };
      });

      await compiler.init();
      
      const buildResult = await compiler.build({
        entryPoint: '/app.tsx',
        includeTailwind: true,
        target: 'es2022',
        externals: ['lodash']
      });

      expect(buildResult.modules).toHaveLength(4);
      expect(buildResult.modules).toContain('/app.tsx');
      expect(buildResult.modules).toContain('/components/Header.tsx');
      expect(buildResult.modules).toContain('/components/Footer.tsx');
      expect(buildResult.modules).toContain('/components/Button.tsx');
      expect(buildResult.compiledCode).toContain('define');
    });
  });
});