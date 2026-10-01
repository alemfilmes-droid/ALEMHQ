"use client";

import { cleanVapidKey } from "@/lib/push-keys";

/** Web push no navegador: suporte, service worker e inscrição deste aparelho. */

export type PushSupport = "supported" | "needs-install" | "unsupported";

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIos(): boolean {
  const ua = window.navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

/** No iPhone o push só existe no app instalado na Tela de Início (iOS 16.4+). */
export function getPushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const hasApis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (hasApis) return "supported";
  if (isIos() && !isStandalone()) return "needs-install";
  return "unsupported";
}

export function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(() => navigator.serviceWorker.ready);
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  const registration = await registerServiceWorker();
  return registration.pushManager.getSubscription();
}

/** A inscrição foi feita com a chave pública atual do servidor? (Se a chave mudar, a Apple recusa.) */
export function matchesCurrentKey(subscription: PushSubscription): boolean {
  const current = cleanVapidKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const used = subscription.options.applicationServerKey;
  if (!current || !used) return true;
  const a = urlBase64ToUint8Array(current);
  const b = new Uint8Array(used);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Refaz a inscrição com a chave atual (permissão já concedida: não precisa de toque). */
export async function renewSubscription(old: PushSubscription): Promise<PushSubscription | null> {
  await old.unsubscribe().catch(() => undefined);
  return subscribeThisDevice();
}

/** Pede a permissão (precisa vir de um toque) e inscreve o aparelho. */
export async function subscribeThisDevice(): Promise<PushSubscription | null> {
  const publicKey = cleanVapidKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  if (!publicKey) throw new Error("Notificações ainda não configuradas no servidor.");
  const keyBytes = urlBase64ToUint8Array(publicKey);
  // Chave pública P-256 não comprimida: 65 bytes começando em 0x04.
  if (keyBytes.length !== 65 || keyBytes[0] !== 4) {
    throw new Error("A chave pública de notificações (NEXT_PUBLIC_VAPID_PUBLIC_KEY) está inválida na Vercel.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;
  const registration = await registerServiceWorker();
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
}

export function setAppBadge(count: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  if (count > 0) void nav.setAppBadge?.(count).catch(() => undefined);
  else void nav.clearAppBadge?.().catch(() => undefined);
}
