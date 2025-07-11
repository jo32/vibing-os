'use client';

import { configure, fs } from '@zenfs/core';
import { IndexedDB } from '@zenfs/dom';

export class VirtualFileSystem {
  private initialized = false;

  async init() {
    if (this.initialized) return;
    
    try {
      await configure({
        fs: "IndexedDB",
        options: {
          storeName: 'vibing-os-files'
        }
      });
      this.initialized = true;
      console.log('Virtual filesystem initialized with IndexedDB');
    } catch (error) {
      console.error('Failed to initialize filesystem:', error);
      throw error;
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      fs.writeFile(path, content, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async readFile(path: string): Promise<string> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      fs.readFile(path, 'utf8', (err, data) => {
        if (err) reject(err);
        else resolve(data as string);
      });
    });
  }

  async exists(path: string): Promise<boolean> {
    await this.ensureInitialized();
    return new Promise((resolve) => {
      fs.exists(path, (exists) => {
        resolve(exists);
      });
    });
  }

  async mkdir(path: string): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      fs.mkdir(path, { recursive: true }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async readdir(path: string): Promise<string[]> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      fs.readdir(path, (err, files) => {
        if (err) reject(err);
        else resolve(files as string[]);
      });
    });
  }

  async stat(path: string): Promise<any> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      fs.stat(path, (err, stats) => {
        if (err) reject(err);
        else resolve(stats);
      });
    });
  }

  async unlink(path: string): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      fs.unlink(path, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }
}

export const vfs = new VirtualFileSystem();