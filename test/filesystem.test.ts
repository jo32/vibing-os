import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VirtualFileSystem } from '../app/lib/filesystem';

// Mock @zenfs/core
vi.mock('@zenfs/core', () => ({
  configureSingle: vi.fn().mockResolvedValue(undefined),
}));

// Mock @zenfs/dom
vi.mock('@zenfs/dom', () => ({
  IndexedDB: vi.fn(),
}));

// Mock @zenfs/core/promises
vi.mock('@zenfs/core/promises', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  unlink: vi.fn(),
}));

describe('VirtualFileSystem', () => {
  let vfs: VirtualFileSystem;

  beforeEach(() => {
    vfs = new VirtualFileSystem();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with IndexedDB backend', async () => {
      const { configureSingle } = await import('@zenfs/core');
      const { IndexedDB } = await import('@zenfs/dom');
      
      await vfs.init();
      
      expect(configureSingle).toHaveBeenCalledWith({ backend: IndexedDB });
    });

    it('should not reinitialize if already initialized', async () => {
      const { configureSingle } = await import('@zenfs/core');
      
      await vfs.init();
      await vfs.init(); // Call again
      
      expect(configureSingle).toHaveBeenCalledTimes(1);
    });
  });

  describe('file operations', () => {
    beforeEach(async () => {
      await vfs.init();
    });

    it('should write file successfully', async () => {
      const zenfsPromises = await import('@zenfs/core/promises');
      (zenfsPromises.writeFile as any).mockResolvedValue(undefined);

      await expect(vfs.writeFile('/test.txt', 'hello world')).resolves.toBeUndefined();
      expect(zenfsPromises.writeFile).toHaveBeenCalledWith('/test.txt', 'hello world');
    });

    it('should read file successfully', async () => {
      const zenfsPromises = await import('@zenfs/core/promises');
      const expectedContent = 'hello world';
      (zenfsPromises.readFile as any).mockResolvedValue(expectedContent);

      const content = await vfs.readFile('/test.txt');
      expect(content).toBe(expectedContent);
      expect(zenfsPromises.readFile).toHaveBeenCalledWith('/test.txt', 'utf8');
    });

    it('should check file existence', async () => {
      const zenfsPromises = await import('@zenfs/core/promises');
      (zenfsPromises.exists as any).mockResolvedValue(true);

      const exists = await vfs.exists('/test.txt');
      expect(exists).toBe(true);
      expect(zenfsPromises.exists).toHaveBeenCalledWith('/test.txt');
    });

    it('should create directories recursively', async () => {
      const zenfsPromises = await import('@zenfs/core/promises');
      (zenfsPromises.mkdir as any).mockResolvedValue(undefined);

      await expect(vfs.mkdir('/project/src')).resolves.toBeUndefined();
      expect(zenfsPromises.mkdir).toHaveBeenCalledWith('/project/src', { recursive: true });
    });

    it('should list directory contents', async () => {
      const zenfsPromises = await import('@zenfs/core/promises');
      const expectedFiles = ['file1.txt', 'file2.js'];
      (zenfsPromises.readdir as any).mockResolvedValue(expectedFiles);

      const files = await vfs.readdir('/project');
      expect(files).toEqual(expectedFiles);
      expect(zenfsPromises.readdir).toHaveBeenCalledWith('/project');
    });

    it('should get file stats', async () => {
      const zenfsPromises = await import('@zenfs/core/promises');
      const expectedStats = { size: 100, isFile: () => true };
      (zenfsPromises.stat as any).mockResolvedValue(expectedStats);

      const stats = await vfs.stat('/test.txt');
      expect(stats).toEqual(expectedStats);
      expect(zenfsPromises.stat).toHaveBeenCalledWith('/test.txt');
    });

    it('should delete files', async () => {
      const zenfsPromises = await import('@zenfs/core/promises');
      (zenfsPromises.unlink as any).mockResolvedValue(undefined);

      await expect(vfs.unlink('/test.txt')).resolves.toBeUndefined();
      expect(zenfsPromises.unlink).toHaveBeenCalledWith('/test.txt');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await vfs.init();
    });

    it('should handle write errors', async () => {
      const zenfsPromises = await import('@zenfs/core/promises');
      const error = new Error('Write failed');
      (zenfsPromises.writeFile as any).mockRejectedValue(error);

      await expect(vfs.writeFile('/test.txt', 'content')).rejects.toThrow('Write failed');
    });

    it('should handle read errors', async () => {
      const zenfsPromises = await import('@zenfs/core/promises');
      const error = new Error('File not found');
      (zenfsPromises.readFile as any).mockRejectedValue(error);

      await expect(vfs.readFile('/nonexistent.txt')).rejects.toThrow('File not found');
    });
  });
});