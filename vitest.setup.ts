// vitest.setup.ts
// In-memory localStorage mock for unit tests
// Uses a Map to simulate localStorage without touching the real one

const createMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  };
};

// Global mock storage for unit tests
const mockStorage = createMemoryStorage();

// Override global localStorage
Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
  configurable: true,
});

// Helper for integration tests that need real localStorage with test prefix
export const TEST_STORAGE_PREFIX = 'shos_test_';

export const createTestStorage = () => {
  const testStore = new Map<string, string>();
  return {
    getItem: (key: string) => testStore.get(TEST_STORAGE_PREFIX + key) ?? null,
    setItem: (key: string, value: string) => testStore.set(TEST_STORAGE_PREFIX + key, value),
    removeItem: (key: string) => testStore.delete(TEST_STORAGE_PREFIX + key),
    clear: () => {
      for (const key of testStore.keys()) {
        if (key.startsWith(TEST_STORAGE_PREFIX)) {
          testStore.delete(key);
        }
      }
    },
    get length() {
      let count = 0;
      for (const key of testStore.keys()) {
        if (key.startsWith(TEST_STORAGE_PREFIX)) count++;
      }
      return count;
    },
    key: (index: number) => {
      const keys = Array.from(testStore.keys()).filter(k => k.startsWith(TEST_STORAGE_PREFIX));
      return keys[index]?.replace(TEST_STORAGE_PREFIX, '') ?? null;
    },
    // Cleanup all test keys
    cleanup: () => {
      for (const key of testStore.keys()) {
        if (key.startsWith(TEST_STORAGE_PREFIX)) {
          testStore.delete(key);
        }
      }
    },
  };
};

// Cleanup function for afterAll hooks
export const cleanupTestStorage = () => {
  const testStore = createTestStorage();
  testStore.cleanup();
};