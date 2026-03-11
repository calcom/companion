import { vi } from "vitest";

export interface MockFsState {
  files: Map<string, string>;
  directories: Set<string>;
}

export function createMockFs() {
  const state: MockFsState = {
    files: new Map(),
    directories: new Set(),
  };

  const mockFs = {
    existsSync: vi.fn((path: string) => {
      return state.files.has(path) || state.directories.has(path);
    }),
    readFileSync: vi.fn((path: string, _encoding?: string) => {
      const content = state.files.get(path);
      if (content === undefined) {
        const error = new Error(`ENOENT: no such file or directory, open '${path}'`) as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      return content;
    }),
    writeFileSync: vi.fn((path: string, data: string, _options?: object) => {
      state.files.set(path, data);
    }),
    mkdirSync: vi.fn((path: string, _options?: object) => {
      state.directories.add(path);
    }),
  };

  return { mockFs, state };
}

export function setupMockFs(state: MockFsState) {
  return {
    setFile: (path: string, content: string) => {
      state.files.set(path, content);
    },
    setDirectory: (path: string) => {
      state.directories.add(path);
    },
    clear: () => {
      state.files.clear();
      state.directories.clear();
    },
  };
}
