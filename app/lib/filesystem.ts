'use client';

export class VirtualFileSystem {
  private initialized = false;
  private zenfs: any = null;

  async init() {
    if (this.initialized) return;
    
    // Only initialize in browser environment
    if (typeof window === 'undefined') {
      console.warn('VirtualFileSystem can only be used in browser environment');
      return;
    }
    
    try {
      // Use proper ZenFS imports as shown in their documentation
      const { configureSingle } = await import('@zenfs/core');
      const { IndexedDB } = await import('@zenfs/dom');
      
      // Configure with IndexedDB backend
      await configureSingle({ backend: IndexedDB });
      
      // Import the promises API which should be more reliable
      const zenfsPromises = await import('@zenfs/core/promises');
      this.zenfs = zenfsPromises;
      this.initialized = true;
      console.log('Virtual filesystem initialized with IndexedDB');
    } catch (error) {
      console.error('Failed to initialize filesystem:', error);
      throw error;
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.ensureInitialized();
    return this.zenfs.writeFile(path, content);
  }

  async readFile(path: string): Promise<string> {
    await this.ensureInitialized();
    return this.zenfs.readFile(path, 'utf8');
  }

  async exists(path: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.zenfs.exists(path);
  }

  async mkdir(path: string): Promise<void> {
    await this.ensureInitialized();
    return this.zenfs.mkdir(path, { recursive: true });
  }

  async readdir(path: string): Promise<string[]> {
    await this.ensureInitialized();
    return this.zenfs.readdir(path);
  }

  async stat(path: string): Promise<any> {
    await this.ensureInitialized();
    return this.zenfs.stat(path);
  }

  async unlink(path: string): Promise<void> {
    await this.ensureInitialized();
    return this.zenfs.unlink(path);
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }
}

export const vfs = new VirtualFileSystem();