'use client';

interface ExternalLibraryConfig {
  name: string;
  global?: string;
  url?: string;
  version?: string;
  dependencies?: string[];
}

export class ExternalHandler {
  private externals = new Map<string, ExternalLibraryConfig>();
  private loadedLibraries = new Set<string>();
  private loadingPromises = new Map<string, Promise<any>>();

  constructor() {
    this.setupDefaultExternals();
  }

  private setupDefaultExternals() {
    // React and ReactDOM are available through Next.js
    this.register('react', {
      name: 'react',
      global: 'React',
      version: '18'
    });

    this.register('react-dom', {
      name: 'react-dom',
      global: 'ReactDOM',
      version: '18',
      dependencies: ['react']
    });

    // Other common libraries can be loaded from CDN
    this.register('lodash', {
      name: 'lodash',
      global: '_',
      url: 'https://esm.run/lodash@4'
    });

    this.register('axios', {
      name: 'axios',
      global: 'axios',
      url: 'https://esm.run/axios@1'
    });

    this.register('dayjs', {
      name: 'dayjs',
      url: 'https://esm.run/dayjs@1'
    });
  }

  register(name: string, config: ExternalLibraryConfig) {
    this.externals.set(name, config);
    console.log(`📦 Registered external library: ${name}`);
  }

  isExternal(name: string): boolean {
    return this.externals.has(name);
  }

  async loadExternal(name: string): Promise<any> {
    if (this.loadedLibraries.has(name)) {
      return this.getLibraryExports(name);
    }

    if (this.loadingPromises.has(name)) {
      return this.loadingPromises.get(name);
    }

    const loadPromise = this.doLoadExternal(name);
    this.loadingPromises.set(name, loadPromise);

    try {
      const result = await loadPromise;
      this.loadingPromises.delete(name);
      this.loadedLibraries.add(name);
      return result;
    } catch (error) {
      this.loadingPromises.delete(name);
      throw error;
    }
  }

  private async doLoadExternal(name: string): Promise<any> {
    const config = this.externals.get(name);
    if (!config) {
      throw new Error(`External library not registered: ${name}`);
    }

    console.log(`🔄 Loading external library: ${name}`);

    // Load dependencies first
    if (config.dependencies) {
      await Promise.all(config.dependencies.map(dep => this.loadExternal(dep)));
    }

    // For React/ReactDOM, use Next.js modules directly
    if (name === 'react') {
      try {
        console.log(`🔄 Using Next.js React directly...`);
        // Import React from Next.js environment
        const React = await import('react');
        const reactExports = React.default || React;
        
        // Set as global for compatibility
        if (typeof window !== 'undefined') {
          (window as any).React = reactExports;
        }
        
        console.log(`✅ Loaded React from Next.js`);
        return reactExports;
      } catch (error) {
        console.error(`❌ Failed to load React from Next.js:`, error);
      }
    }

    if (name === 'react-dom') {
      try {
        console.log(`🔄 Using Next.js ReactDOM directly...`);
        // Import ReactDOM from Next.js environment - use client entry point
        const ReactDOM = await import('react-dom/client');
        const reactDOMExports = ReactDOM.default || ReactDOM;
        
        // Set as global for compatibility
        if (typeof window !== 'undefined') {
          (window as any).ReactDOM = reactDOMExports;
        }
        
        console.log(`✅ Loaded ReactDOM from Next.js`);
        return reactDOMExports;
      } catch (error) {
        console.error(`❌ Failed to load ReactDOM from Next.js:`, error);
        // Fallback to main react-dom
        try {
          const ReactDOM = await import('react-dom');
          const reactDOMExports = ReactDOM.default || ReactDOM;
          if (typeof window !== 'undefined') {
            (window as any).ReactDOM = reactDOMExports;
          }
          console.log(`✅ Loaded ReactDOM fallback from Next.js`);
          return reactDOMExports;
        } catch (fallbackError) {
          console.error(`❌ Failed to load ReactDOM fallback:`, fallbackError);
        }
      }
    }

    // Try to get from global first (for other libraries)
    if (config.global) {
      const globalLib = this.getFromGlobal(config.global);
      if (globalLib) {
        console.log(`✅ Found ${name} in global scope as ${config.global}`);
        return globalLib;
      }
    }

    // Load from URL if provided
    if (config.url) {
      try {
        console.log(`📡 Loading ${name} from ${config.url}`);
        const module = await import(config.url);
        const exports = module.default || module;
        
        // Optionally set as global
        if (config.global && typeof window !== 'undefined') {
          (window as any)[config.global] = exports;
        }
        
        console.log(`✅ Loaded ${name} from CDN`);
        return exports;
      } catch (error) {
        console.error(`❌ Failed to load ${name} from ${config.url}:`, error);
        throw error;
      }
    }

    throw new Error(`No loading method available for external library: ${name}`);
  }

  private getFromGlobal(globalName: string): any {
    if (typeof window === 'undefined') return null;

    // Try window first
    if ((window as any)[globalName]) {
      return (window as any)[globalName];
    }

    // Try parent window
    if (window.parent && (window.parent as any)[globalName]) {
      return (window.parent as any)[globalName];
    }

    return null;
  }

  private getLibraryExports(name: string): any {
    const config = this.externals.get(name);
    if (!config) return null;

    if (config.global) {
      return this.getFromGlobal(config.global);
    }

    return null;
  }

  async ensureReactRuntime(): Promise<void> {
    console.log('🔧 Ensuring React runtime is available...');

    try {
      // Skip React runtime setup during SSR - React is already available through Next.js
      if (typeof window === 'undefined') {
        console.log('✅ Skipping React runtime setup during SSR');
        return;
      }

      // Load React first
      const react = await this.loadExternal('react');
      if (!react || typeof react.createElement !== 'function') {
        throw new Error('React.createElement not available');
      }

      // Load ReactDOM
      const reactDOM = await this.loadExternal('react-dom');
      if (!reactDOM || typeof reactDOM.createRoot !== 'function') {
        throw new Error('ReactDOM.createRoot not available');
      }

      // Ensure hooks are available
      const requiredHooks = ['useState', 'useEffect', 'useContext', 'useReducer'];
      const missingHooks = requiredHooks.filter(hook => typeof react[hook] !== 'function');
      
      if (missingHooks.length > 0) {
        throw new Error(`React hooks not available: ${missingHooks.join(', ')}`);
      }

      // Set globals for compatibility
      (window as any).React = react;
      (window as any).ReactDOM = reactDOM;

      console.log('✅ React runtime is ready');
    } catch (error) {
      console.error('❌ Failed to setup React runtime:', error);
      throw error;
    }
  }

  getRegisteredExternals(): string[] {
    return Array.from(this.externals.keys());
  }

  isLoaded(name: string): boolean {
    return this.loadedLibraries.has(name);
  }

  // Method to preload commonly used externals
  async preloadCommonLibraries(): Promise<void> {
    // Skip preloading during SSR
    if (typeof window === 'undefined') {
      console.log('✅ Skipping library preload during SSR');
      return;
    }

    const commonLibs = ['react', 'react-dom'];
    await Promise.all(commonLibs.map(lib => this.loadExternal(lib).catch(err => 
      console.warn(`Failed to preload ${lib}:`, err)
    )));
  }
}

export const externalHandler = new ExternalHandler();