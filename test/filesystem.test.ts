import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VirtualFileSystem } from '../app/lib/filesystem';

// Mock @zenfs/core
vi.mock('@zenfs/core', () => ({
  configure: vi.fn().mockResolvedValue(undefined),
  fs: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    exists: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
  },
}));

describe('VirtualFileSystem', () => {
  let vfs: VirtualFileSystem;

  beforeEach(() => {
    vfs = new VirtualFileSystem();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with IndexedDB backend', async () => {
      const { configure } = await import('@zenfs/core');
      
      await vfs.init();
      
      expect(configure).toHaveBeenCalledWith({
        fs: "IndexedDB",
        options: {
          storeName: 'vibing-os-files'
        }
      });
    });

    it('should not reinitialize if already initialized', async () => {
      const { configure } = await import('@zenfs/core');
      
      await vfs.init();
      await vfs.init(); // Call again
      
      expect(configure).toHaveBeenCalledTimes(1);
    });
  });

  describe('file operations', () => {
    beforeEach(async () => {
      await vfs.init();
    });

    it('should write file successfully', async () => {
      const { fs } = await import('@zenfs/core');
      (fs.writeFile as any).mockImplementation((path: string, content: string, callback: Function) => {
        callback(null);
      });

      await expect(vfs.writeFile('/test.txt', 'hello world')).resolves.toBeUndefined();
      expect(fs.writeFile).toHaveBeenCalledWith('/test.txt', 'hello world', expect.any(Function));
    });

    it('should read file successfully', async () => {
      const { fs } = await import('@zenfs/core');
      const expectedContent = 'hello world';
      (fs.readFile as any).mockImplementation((path: string, encoding: string, callback: Function) => {
        callback(null, expectedContent);
      });

      const content = await vfs.readFile('/test.txt');
      expect(content).toBe(expectedContent);
      expect(fs.readFile).toHaveBeenCalledWith('/test.txt', 'utf8', expect.any(Function));
    });

    it('should check file existence', async () => {
      const { fs } = await import('@zenfs/core');
      (fs.exists as any).mockImplementation((path: string, callback: Function) => {
        callback(true);
      });

      const exists = await vfs.exists('/test.txt');
      expect(exists).toBe(true);
      expect(fs.exists).toHaveBeenCalledWith('/test.txt', expect.any(Function));
    });

    it('should create directories recursively', async () => {
      const { fs } = await import('@zenfs/core');
      (fs.mkdir as any).mockImplementation((path: string, options: any, callback: Function) => {
        callback(null);
      });

      await expect(vfs.mkdir('/project/src')).resolves.toBeUndefined();
      expect(fs.mkdir).toHaveBeenCalledWith('/project/src', { recursive: true }, expect.any(Function));
    });

    it('should list directory contents', async () => {
      const { fs } = await import('@zenfs/core');
      const expectedFiles = ['file1.txt', 'file2.js'];
      (fs.readdir as any).mockImplementation((path: string, callback: Function) => {
        callback(null, expectedFiles);
      });

      const files = await vfs.readdir('/project');
      expect(files).toEqual(expectedFiles);
      expect(fs.readdir).toHaveBeenCalledWith('/project', expect.any(Function));
    });

    it('should get file stats', async () => {
      const { fs } = await import('@zenfs/core');
      const expectedStats = { size: 100, isFile: () => true };
      (fs.stat as any).mockImplementation((path: string, callback: Function) => {
        callback(null, expectedStats);
      });

      const stats = await vfs.stat('/test.txt');
      expect(stats).toEqual(expectedStats);
      expect(fs.stat).toHaveBeenCalledWith('/test.txt', expect.any(Function));
    });

    it('should delete files', async () => {
      const { fs } = await import('@zenfs/core');
      (fs.unlink as any).mockImplementation((path: string, callback: Function) => {
        callback(null);
      });

      await expect(vfs.unlink('/test.txt')).resolves.toBeUndefined();
      expect(fs.unlink).toHaveBeenCalledWith('/test.txt', expect.any(Function));
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await vfs.init();
    });

    it('should handle write errors', async () => {
      const { fs } = await import('@zenfs/core');
      const error = new Error('Write failed');
      (fs.writeFile as any).mockImplementation((path: string, content: string, callback: Function) => {
        callback(error);
      });

      await expect(vfs.writeFile('/test.txt', 'content')).rejects.toThrow('Write failed');
    });

    it('should handle read errors', async () => {
      const { fs } = await import('@zenfs/core');
      const error = new Error('File not found');
      (fs.readFile as any).mockImplementation((path: string, encoding: string, callback: Function) => {
        callback(error);
      });

      await expect(vfs.readFile('/nonexistent.txt')).rejects.toThrow('File not found');
    });
  });
});