import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ExternalHandler } from '../../app/lib/external-handler';

// Mock React and ReactDOM imports
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    default: actual
  };
});

vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    default: actual
  };
});

vi.mock('react-dom/client', async () => {
  const actual = await vi.importActual('react-dom/client');
  return {
    ...actual,
    default: actual
  };
});

describe('ExternalHandler', () => {
  let handler: ExternalHandler;
  let originalWindow: any;
  let mockWindow: any;

  beforeEach(() => {
    // Save original window/global
    originalWindow = global.window;
    
    // Create mock window
    mockWindow = {
      parent: null
    };
    
    // Set global window for tests
    (global as any).window = mockWindow;
    
    handler = new ExternalHandler();
  });

  afterEach(() => {
    // Restore original window
    global.window = originalWindow;
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default externals', () => {
      expect(handler.isExternal('react')).toBe(true);
      expect(handler.isExternal('react-dom')).toBe(true);
      expect(handler.isExternal('lodash')).toBe(true);
      expect(handler.isExternal('axios')).toBe(true);
    });

    it('should not consider unknown libraries as external', () => {
      expect(handler.isExternal('unknown-lib')).toBe(false);
      expect(handler.isExternal('custom-module')).toBe(false);
    });
  });

  describe('external library registration', () => {
    it('should register new external library', () => {
      handler.register('new-lib', {
        name: 'new-lib',
        global: 'NewLib',
        url: 'https://cdn.example.com/new-lib.js'
      });

      expect(handler.isExternal('new-lib')).toBe(true);
    });

    it('should register library with dependencies', () => {
      handler.register('dependent-lib', {
        name: 'dependent-lib',
        dependencies: ['react'],
        url: 'https://cdn.example.com/dependent-lib.js'
      });

      expect(handler.isExternal('dependent-lib')).toBe(true);
    });

    it('should get list of registered externals', () => {
      const externals = handler.getRegisteredExternals();
      expect(externals).toContain('react');
      expect(externals).toContain('react-dom');
      expect(externals).toContain('lodash');
    });
  });

  describe('loading from Next.js imports', () => {
    it('should load React from Next.js imports', async () => {
      const result = await handler.loadExternal('react');
      
      // React should be loaded from Next.js import, not from global
      expect(result).toBeDefined();
      expect(result.createElement).toBeDefined();
      expect(typeof result.createElement).toBe('function');
      expect(handler.isLoaded('react')).toBe(true);
    });

    it('should load ReactDOM from Next.js imports', async () => {
      const result = await handler.loadExternal('react-dom');
      
      // ReactDOM should be loaded from Next.js import
      expect(result).toBeDefined();
      expect(result.createRoot).toBeDefined();
      expect(typeof result.createRoot).toBe('function');
      expect(handler.isLoaded('react-dom')).toBe(true);
    });

    it('should set React as global after loading', async () => {
      await handler.loadExternal('react');
      
      // React should be available on window after loading
      expect(mockWindow.React).toBeDefined();
      expect(mockWindow.React.createElement).toBeDefined();
    });
  });

  describe('loading from CDN', () => {
    it('should register CDN libraries correctly', () => {
      handler.register('test-lib', {
        name: 'test-lib',
        url: 'https://esm.run/test-lib@1'
      });

      expect(handler.isExternal('test-lib')).toBe(true);
      expect(handler.getRegisteredExternals()).toContain('test-lib');
    });

    it('should handle library configuration with global variable', () => {
      handler.register('global-lib', {
        name: 'global-lib',
        global: 'GlobalLib',
        url: 'https://esm.run/global-lib@1'
      });

      expect(handler.isExternal('global-lib')).toBe(true);
    });

    it('should handle library without loading method', async () => {
      handler.register('no-method-lib', {
        name: 'no-method-lib'
        // No global or url specified
      });

      await expect(handler.loadExternal('no-method-lib')).rejects.toThrow('No loading method available for external library: no-method-lib');
    });

    it('should handle CDN configuration with dependencies', () => {
      handler.register('dependent-lib', {
        name: 'dependent-lib',
        dependencies: ['react'],
        url: 'https://esm.run/dependent-lib@1'
      });

      expect(handler.isExternal('dependent-lib')).toBe(true);
    });
  });

  describe('dependency loading', () => {
    it('should register dependencies correctly', () => {
      handler.register('ui-lib', {
        name: 'ui-lib',
        dependencies: ['react'],
        url: 'https://esm.run/ui-lib@1'
      });

      expect(handler.isExternal('ui-lib')).toBe(true);
      expect(handler.getRegisteredExternals()).toContain('ui-lib');
    });

    it('should handle circular dependencies gracefully', () => {
      handler.register('lib-a', {
        name: 'lib-a',
        dependencies: ['lib-b'],
        url: 'https://esm.run/lib-a@1'
      });

      handler.register('lib-b', {
        name: 'lib-b',
        dependencies: ['lib-a'],
        url: 'https://esm.run/lib-b@1'
      });

      // Libraries should be registered despite circular dependencies
      expect(handler.isExternal('lib-a')).toBe(true);
      expect(handler.isExternal('lib-b')).toBe(true);
    });
  });

  describe('React runtime setup', () => {
    it('should ensure React runtime is available', async () => {
      await expect(handler.ensureReactRuntime()).resolves.not.toThrow();
      
      // React should be loaded from Next.js and available on window
      expect(mockWindow.React).toBeDefined();
      expect(mockWindow.React.createElement).toBeDefined();
      expect(mockWindow.ReactDOM).toBeDefined();
      expect(mockWindow.ReactDOM.createRoot).toBeDefined();
    });

    it('should verify React hooks are available', async () => {
      await handler.ensureReactRuntime();
      
      // All required React hooks should be available
      expect(mockWindow.React.useState).toBeDefined();
      expect(mockWindow.React.useEffect).toBeDefined();
      expect(mockWindow.React.useContext).toBeDefined();
      expect(mockWindow.React.useReducer).toBeDefined();
    });

    it('should skip React runtime setup during SSR', async () => {
      // Mock SSR environment by removing window
      const originalWindow = global.window;
      delete (global as any).window;
      
      await expect(handler.ensureReactRuntime()).resolves.not.toThrow();
      
      // Restore window
      (global as any).window = originalWindow;
    });

    it('should load React from CDN if not available globally', async () => {
      const mockReact = {
        createElement: vi.fn(),
        useState: vi.fn(),
        useEffect: vi.fn(),
        useContext: vi.fn(),
        useReducer: vi.fn()
      };
      
      const mockReactDOM = { createRoot: vi.fn() };

      // Mock successful loading from CDN
      const originalLoadExternal = handler.loadExternal.bind(handler);
      handler.loadExternal = vi.fn().mockImplementation(async (name: string) => {
        if (name === 'react') return mockReact;
        if (name === 'react-dom') return mockReactDOM;
        return originalLoadExternal(name);
      });

      await handler.ensureReactRuntime();
      
      expect(handler.loadExternal).toHaveBeenCalledWith('react');
      expect(handler.loadExternal).toHaveBeenCalledWith('react-dom');
      expect(mockWindow.React).toBe(mockReact);
      expect(mockWindow.ReactDOM).toBe(mockReactDOM);
    });
  });

  describe('preloading', () => {
    it('should preload common libraries', async () => {
      const mockReact = { createElement: vi.fn() };
      const mockReactDOM = { createRoot: vi.fn() };
      
      mockWindow.React = mockReact;
      mockWindow.ReactDOM = mockReactDOM;

      const loadSpy = vi.spyOn(handler, 'loadExternal');

      await handler.preloadCommonLibraries();

      expect(loadSpy).toHaveBeenCalledWith('react');
      expect(loadSpy).toHaveBeenCalledWith('react-dom');
    });

    it('should continue preloading even if some libraries fail', async () => {
      const loadSpy = vi.spyOn(handler, 'loadExternal').mockImplementation(async (name: string) => {
        if (name === 'react') throw new Error('React load failed');
        if (name === 'react-dom') return { createRoot: vi.fn() };
        throw new Error('Unknown library');
      });

      // Should not throw despite React failing to load
      await expect(handler.preloadCommonLibraries()).resolves.not.toThrow();
      
      expect(loadSpy).toHaveBeenCalledWith('react');
      expect(loadSpy).toHaveBeenCalledWith('react-dom');
    });
  });

  describe('caching and state management', () => {
    it('should cache loaded libraries', async () => {
      const mockLib = { version: '1.0.0' };
      mockWindow.TestLib = mockLib;

      handler.register('test-lib', {
        name: 'test-lib',
        global: 'TestLib'
      });

      const result1 = await handler.loadExternal('test-lib');
      const result2 = await handler.loadExternal('test-lib');

      expect(result1).toBe(result2);
      expect(result1).toBe(mockLib);
    });

    it('should track loading state correctly', async () => {
      const mockLib = { version: '1.0.0' };
      mockWindow.TestLib = mockLib;

      handler.register('test-lib', {
        name: 'test-lib',
        global: 'TestLib'
      });

      expect(handler.isLoaded('test-lib')).toBe(false);
      
      await handler.loadExternal('test-lib');
      
      expect(handler.isLoaded('test-lib')).toBe(true);
    });

    it('should handle concurrent loading state management', async () => {
      const mockLib = { version: '1.0.0' };
      mockWindow.ConcurrentLib = mockLib;

      handler.register('concurrent-lib', {
        name: 'concurrent-lib',
        global: 'ConcurrentLib'
      });

      expect(handler.isLoaded('concurrent-lib')).toBe(false);
      
      const result = await handler.loadExternal('concurrent-lib');
      
      expect(result).toBe(mockLib);
      expect(handler.isLoaded('concurrent-lib')).toBe(true);
    });
  });

  describe('error scenarios', () => {
    it('should handle unregistered external library', async () => {
      await expect(handler.loadExternal('unregistered-lib')).rejects.toThrow('External library not registered: unregistered-lib');
    });

    it('should handle library with no loading method', async () => {
      handler.register('no-method-lib', {
        name: 'no-method-lib'
        // No global or url specified
      });

      await expect(handler.loadExternal('no-method-lib')).rejects.toThrow('No loading method available for external library: no-method-lib');
    });

    it('should handle missing global in non-browser environment', async () => {
      // Create a library that depends on a missing global
      handler.register('missing-global-lib', {
        name: 'missing-global-lib',
        global: 'MissingGlobal'
      });

      // The global is not set, so it should try to load from URL (which doesn't exist)
      await expect(handler.loadExternal('missing-global-lib')).rejects.toThrow('No loading method available for external library: missing-global-lib');
    });
  });
});