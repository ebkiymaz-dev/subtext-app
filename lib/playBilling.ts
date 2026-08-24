"use client";

export type PlayBillingStatus = "loading" | "ready" | "purchased" | "pending" | "unavailable" | "error";

export interface PlayBillingState {
  android: boolean;
  status: PlayBillingStatus;
  entitled: boolean;
  price?: string;
  message?: string;
}

interface SubtextBillingBridge {
  getState(): string;
  purchaseAnswerCoach(): void;
  restorePurchases(): void;
  manageSubscription(): void;
}

declare global {
  interface Window {
    SubtextBilling?: SubtextBillingBridge;
  }
}

export const PLAY_BILLING_EVENT = "subtext:billing";

const WEB_STATE: PlayBillingState = {
  android: false,
  status: "unavailable",
  entitled: false,
  message: "Answer Coach subscriptions are available in the Android app.",
};

function parseState(raw: string): PlayBillingState {
  try {
    const value = JSON.parse(raw) as Partial<PlayBillingState>;
    return {
      android: true,
      status: value.status ?? "loading",
      entitled: value.entitled === true,
      price: value.price,
      message: value.message,
    };
  } catch {
    return { android: true, status: "error", entitled: false, message: "Could not read Google Play billing status." };
  }
}

export function readPlayBillingState(): PlayBillingState {
  if (typeof window === "undefined" || !window.SubtextBilling) return WEB_STATE;
  return parseState(window.SubtextBilling.getState());
}

export function requestPlayPurchase(): boolean {
  if (!window.SubtextBilling) return false;
  window.SubtextBilling.purchaseAnswerCoach();
  return true;
}

export function restorePlayPurchases(): boolean {
  if (!window.SubtextBilling) return false;
  window.SubtextBilling.restorePurchases();
  return true;
}

export function managePlaySubscription(): boolean {
  if (!window.SubtextBilling) return false;
  window.SubtextBilling.manageSubscription();
  return true;
}

export function stateFromBillingEvent(event: Event): PlayBillingState | null {
  const detail = (event as CustomEvent<PlayBillingState>).detail;
  return detail && typeof detail.entitled === "boolean" ? detail : null;
}
