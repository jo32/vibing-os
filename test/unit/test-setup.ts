import { vi } from 'vitest';

// Mock browser APIs
Object.defineProperty(global, 'window', {
  value: {
    URL: {
      createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
      revokeObjectURL: vi.fn()
    },
    Blob: class MockBlob {
      constructor(public content: any[], public options: any) {}
    },
    localStorage: {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    },
    React: undefined,
    ReactDOM: undefined,
    parent: undefined,
    document: {
      createElement: vi.fn().mockReturnValue({
        setAttribute: vi.fn(),
        textContent: '',
        style: {}
      }),
      head: {
        appendChild: vi.fn()
      },
      getElementById: vi.fn(),
      body: {}
    }
  },
  writable: true
});

// Mock URL and Blob globally
Object.defineProperty(global, 'URL', {
  value: {
    createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
    revokeObjectURL: vi.fn()
  },
  writable: true
});

Object.defineProperty(global, 'Blob', {
  value: class MockBlob {
    constructor(public content: any[], public options: any) {}
  },
  writable: true
});

// Mock Function constructor for safe module execution
Object.defineProperty(global, 'Function', {
  value: class MockFunction extends Function {
    constructor(...args: any[]) {
      super(...args);
      // Mock function execution to avoid actual code execution
    }
  },
  writable: true
});

// Mock localStorage
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  },
  writable: true
});

// Mock console methods to avoid noise in tests (but allow them to be restored)
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error
};

// Mock React and ReactDOM globals
const mockReact = {
  createElement: vi.fn(),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useContext: vi.fn(),
  useReducer: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
  useRef: vi.fn()
};

const mockReactDOM = {
  createRoot: vi.fn().mockReturnValue({
    render: vi.fn()
  }),
  render: vi.fn()
};

// Set up globals
(global as any).React = mockReact;
(global as any).ReactDOM = mockReactDOM;

// Set up window globals
if (typeof window !== 'undefined') {
  (window as any).React = mockReact;
  (window as any).ReactDOM = mockReactDOM;
}

// Mock dynamic import function
(global as any).import = vi.fn().mockImplementation((url: string) => {
  return Promise.reject(new Error(`Mock import not implemented for: ${url}`));
});

// Export utilities for tests
export { originalConsole, mockReact, mockReactDOM };