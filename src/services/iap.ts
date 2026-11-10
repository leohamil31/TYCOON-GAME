import {
  endConnection,
  finishTransaction,
  getAvailablePurchases,
  getProducts,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Product,
  type ProductPurchase,
  type PurchaseError,
} from 'react-native-iap';
import { IAP } from '../constants';

type Subscription = { remove: () => void };

let updateSub: Subscription | null = null;
let errorSub: Subscription | null = null;

export interface IapCallbacks {
  onRemoveAdsOwned: () => void;
  onError?: (message: string) => void;
}

/** Call once on app start. Sets up listeners and restores any prior purchase. */
export async function initIap(cb: IapCallbacks): Promise<void> {
  try {
    await initConnection();
  } catch (e) {
    console.warn('[iap] initConnection failed', e);
    cb.onError?.('Store unavailable.');
    return;
  }

  updateSub?.remove();
  errorSub?.remove();

  updateSub = purchaseUpdatedListener(async (purchase: ProductPurchase) => {
    if (purchase.productId !== IAP.REMOVE_ADS_SKU || !purchase.transactionReceipt) return;
    try {
      // TODO: validate the receipt on your backend before granting the entitlement in production.
      await finishTransaction({ purchase, isConsumable: false });
      cb.onRemoveAdsOwned();
    } catch (e) {
      console.warn('[iap] finishTransaction failed', e);
      cb.onError?.('Could not complete the purchase.');
    }
  });

  errorSub = purchaseErrorListener((err: PurchaseError) => {
    if (err.code === 'E_USER_CANCELLED') return;
    console.warn('[iap] purchase error', err);
    cb.onError?.(err.message ?? 'Purchase failed.');
  });

  await restorePurchases(cb, true);
}

export async function restorePurchases(cb: IapCallbacks, silent = false): Promise<boolean> {
  try {
    const purchases = await getAvailablePurchases();
    const owned = purchases.some((p) => p.productId === IAP.REMOVE_ADS_SKU);
    if (owned) cb.onRemoveAdsOwned();
    return owned;
  } catch (e) {
    console.warn('[iap] restore failed', e);
    if (!silent) cb.onError?.('Could not restore purchases.');
    return false;
  }
}

export async function fetchRemoveAdsProduct(): Promise<Product | null> {
  try {
    const products = await getProducts({ skus: [IAP.REMOVE_ADS_SKU] });
    return products[0] ?? null;
  } catch (e) {
    console.warn('[iap] getProducts failed', e);
    return null;
  }
}

export async function buyRemoveAds(onError?: (m: string) => void): Promise<void> {
  try {
    await requestPurchase({ sku: IAP.REMOVE_ADS_SKU });
  } catch (e) {
    console.warn('[iap] requestPurchase failed', e);
    onError?.('Could not start the purchase.');
  }
}

export async function disposeIap(): Promise<void> {
  updateSub?.remove();
  errorSub?.remove();
  updateSub = null;
  errorSub = null;
  try {
    await endConnection();
  } catch {
    /* ignore */
  }
}
