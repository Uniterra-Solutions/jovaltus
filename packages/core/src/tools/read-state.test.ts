import { describe, expect, it } from 'vitest';

import { createReadState } from './read-state.js';

describe('ReadState', () => {
  describe('createReadState', () => {
    it('starts empty', () => {
      const state = createReadState('/root');
      expect(state.getReadFiles()).toEqual([]);
    });

    it('marks a file as read', () => {
      const state = createReadState('/root');
      state.markRead('/root/foo.ts');
      expect(state.hasRead('/root/foo.ts')).toBe(true);
    });

    it('returns false for files that have not been read', () => {
      const state = createReadState('/root');
      expect(state.hasRead('/root/never.ts')).toBe(false);
    });

    it('normalises paths so relative and absolute lookups match', () => {
      const state = createReadState('/workspace');
      state.markRead('./src/index.ts');
      // Resolved: /workspace/src/index.ts
      expect(state.hasRead('/workspace/src/index.ts')).toBe(true);
    });

    it('normalises trailing slashes', () => {
      const state = createReadState('/root');
      state.markRead('/root/dir');
      // With trailing slash should also match
      expect(state.hasRead('/root/dir/')).toBe(true);
    });

    it('returns a snapshot via getReadFiles', () => {
      const state = createReadState('/root');
      state.markRead('/root/a.ts');
      state.markRead('/root/b.ts');

      const snapshot = state.getReadFiles();
      expect(snapshot).toContain('/root/a.ts');
      expect(snapshot).toContain('/root/b.ts');
    });

    it('reset clears all tracked files', () => {
      const state = createReadState('/root');
      state.markRead('/root/a.ts');
      state.reset();
      expect(state.getReadFiles()).toEqual([]);
      expect(state.hasRead('/root/a.ts')).toBe(false);
    });

    it('uses process.cwd() when workspace root is not provided', () => {
      const state = createReadState();
      // Should not throw
      state.markRead('./package.json');
      expect(state.hasRead('./package.json')).toBe(true);
    });
  });
});
