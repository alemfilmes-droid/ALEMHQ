"use client";

import { useEffect } from "react";
import { registerPushSubscriptionAction } from "@/features/push/actions";
import { getCurrentSubscription, getPushSupport, setAppBadge } from "@/features/push/client";

/**
 * Sem interface. Ao abrir o sistema: registra o service worker e, se este aparelho já tem as
 * notificações ativas, confirma a inscrição para a pessoa logada (se outra pessoa entrou neste
 * aparelho, as notificações passam a ser dela). Também acerta o número no ícone do app.
 */
export function PushRegistrar({ unreadCount }: { unreadCount: number }) {
  useEffect(() => {
    if (getPushSupport() !== "supported" || Notification.permission !== "granted") return;
    let cancelled = false;
    getCurrentSubscription()
      .then((subscription) => {
        if (!subscription || cancelled) return;
        return registerPushSubscriptionAction(subscription.toJSON(), navigator.userAgent);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (getPushSupport() === "supported") setAppBadge(unreadCount);
  }, [unreadCount]);

  return null;
}
