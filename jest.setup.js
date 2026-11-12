/* Mocks dos módulos nativos para os testes em Node. */
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-native-async-storage/async-storage', () => {
  const mem = new Map();
  const api = {
    getItem: async (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: async (k, v) => void mem.set(k, v),
    removeItem: async (k) => void mem.delete(k),
    clear: async () => mem.clear(),
  };
  return { __esModule: true, default: api, ...api };
});
jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: () => ({ initialize: async () => {} }),
  TestIds: { REWARDED: 'test' },
  AdEventType: { CLOSED: 'closed', ERROR: 'error' },
  RewardedAdEventType: { LOADED: 'loaded', EARNED_REWARD: 'earned' },
  RewardedAd: { createForAdRequest: () => ({ addAdEventListener: () => () => {}, load: () => {}, show: async () => {} }) },
}));
jest.mock('react-native-iap', () => ({
  initConnection: async () => true,
  endConnection: async () => {},
  finishTransaction: async () => {},
  getAvailablePurchases: async () => [],
  getProducts: async () => [],
  purchaseUpdatedListener: () => ({ remove() {} }),
  purchaseErrorListener: () => ({ remove() {} }),
  requestPurchase: async () => {},
}));
// Testes não falam com o servidor: força o modo demonstração.
jest.mock('./src/services/supabase', () => ({ supabase: null, SUPABASE_URL: '', SUPABASE_KEY: '', ensureSession: async () => {} }));
