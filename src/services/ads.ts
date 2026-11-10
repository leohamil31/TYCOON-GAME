import mobileAds, {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
} from 'react-native-google-mobile-ads';
import { ADS } from '../constants';

let initialized = false;

export async function initAds(): Promise<void> {
  if (initialized) return;
  try {
    await mobileAds().initialize();
    initialized = true;
  } catch (e) {
    console.warn('[ads] initialize failed', e);
  }
}

/**
 * Loads and shows a rewarded ad.
 * Resolves `true` only if the user earned the reward; `false` on load error, timeout or early close.
 */
export function showRewardedAd(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const ad = RewardedAd.createForAdRequest(ADS.REWARDED_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });
    let earned = false;
    let settled = false;
    let showing = false;
    const unsubscribers: Array<() => void> = [];

    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribers.forEach((u) => u());
      resolve(result);
    };

    // Timeout only guards the loading phase; once shown, wait for CLOSED.
    const timeout = setTimeout(() => {
      if (!showing) finish(false);
    }, ADS.LOAD_TIMEOUT_MS);

    unsubscribers.push(
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        showing = true;
        ad.show().catch((e) => {
          console.warn('[ads] show failed', e);
          finish(false);
        });
      }),
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      ad.addAdEventListener(AdEventType.CLOSED, () => finish(earned)),
      ad.addAdEventListener(AdEventType.ERROR, (e) => {
        console.warn('[ads] error', e);
        finish(false);
      }),
    );

    try {
      ad.load();
    } catch (e) {
      console.warn('[ads] load threw', e);
      finish(false);
    }
  });
}
