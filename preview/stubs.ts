// Web-preview-only stand-ins for native modules.
export const TestIds = { REWARDED: 'test' };
export const AdEventType = { CLOSED: 'closed', ERROR: 'error' };
export const RewardedAdEventType = { LOADED: 'loaded', EARNED_REWARD: 'earned' };

export class RewardedAd {
  private l: Record<string, Array<(e?: unknown) => void>> = {};
  static createForAdRequest() {
    return new RewardedAd();
  }
  addAdEventListener(t: string, f: (e?: unknown) => void) {
    (this.l[t] ||= []).push(f);
    return () => {};
  }
  load() {
    setTimeout(() => this.l.loaded?.forEach((f) => f()), 300);
  }
  async show() {
    window.alert('[PREVIEW] Anúncio simulado assistido');
    this.l.earned?.forEach((f) => f());
    this.l.closed?.forEach((f) => f());
  }
}

export default () => ({ initialize: async () => {} });

// react-native-iap stubs
export const initConnection = async () => true;
export const endConnection = async () => {};
export const finishTransaction = async () => {};
export const getAvailablePurchases = async () => [];
export const getProducts = async () => [];
export const purchaseUpdatedListener = () => ({ remove() {} });
export const purchaseErrorListener = () => ({ remove() {} });
export const requestPurchase = async () => {
  window.alert('[PREVIEW] Compra simulada');
};

// async-storage stub
export const asyncStorage = {
  getItem: async (k: string) => localStorage.getItem(k),
  setItem: async (k: string, v: string) => localStorage.setItem(k, v),
};
