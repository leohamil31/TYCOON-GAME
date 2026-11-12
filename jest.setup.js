/* Mocks dos módulos nativos para os testes em Node. */
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
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
