/**
 * Phone push — the browser side: is it possible here, what's the state, and
 * turning it on or off for this device.
 *
 * The states are what the Settings screen needs to say something useful rather
 * than a dead switch:
 *   unsupported    this browser can't do web push at all
 *   needs-install  iPhone/iPad in Safari: push only works once Shekk is added to
 *                  the home screen and opened from there
 *   not-configured the server has no push keys yet
 *   denied         the member (or the browser) blocked notifications
 *   off / on       available, and whether this device is subscribed
 */

import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { removePushSubscription, savePushSubscription } from "./push.functions";
import { useApp } from "./store";

export type PushStatus = "loading" | "unsupported" | "needs-install" | "not-configured" | "denied" | "off" | "on";

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? "";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detect(): PushStatus {
  if (typeof window === "undefined") return "loading";
  const capable = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!capable) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  if (!VAPID_PUBLIC_KEY) return "not-configured";
  if (Notification.permission === "denied") return "denied";
  return "off";
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  return reg ? reg.pushManager.getSubscription() : null;
}

function toPayload(sub: PushSubscription) {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
    userAgent: navigator.userAgent.slice(0, 300),
  };
}

export function usePush() {
  const { signedIn } = useApp();
  const save = useServerFn(savePushSubscription);
  const remove = useServerFn(removePushSubscription);
  const [status, setStatus] = useState<PushStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Work out the state on load, and quietly re-attach an existing subscription
  // to whoever is signed in now (a shared device may have changed hands).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const base = detect();
      if (base !== "off") return !cancelled && setStatus(base);
      try {
        const sub = await currentSubscription();
        if (cancelled) return;
        if (sub && Notification.permission === "granted") {
          setStatus("on");
          if (signedIn) void save({ data: toPayload(sub) }).catch(() => undefined);
        } else {
          setStatus("off");
        }
      } catch {
        if (!cancelled) setStatus("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, save]);

  const enable = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));
      await save({ data: toPayload(sub) });
      setStatus("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn on notifications");
    } finally {
      setBusy(false);
    }
  }, [save]);

  const disable = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await remove({ data: { endpoint: sub.endpoint } }).catch(() => undefined);
        await sub.unsubscribe();
      }
      setStatus("off");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn off notifications");
    } finally {
      setBusy(false);
    }
  }, [remove]);

  return { status, busy, error, enable, disable };
}

/** Best-effort: stop this device receiving the signed-out member's notifications. */
export async function detachThisDevice() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const sub = await currentSubscription();
    if (!sub) return;
    const { removePushSubscription: removeFn } = await import("./push.functions");
    await removeFn({ data: { endpoint: sub.endpoint } }).catch(() => undefined);
    await sub.unsubscribe();
  } catch {
    /* signing out must never fail because of this */
  }
}
