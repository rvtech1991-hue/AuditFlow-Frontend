import { getPushPublicKey, registerPushSubscription, unregisterPushSubscription } from "../services/notifications";

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(base64Url: string): BufferSource {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0))).buffer;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration("/sw.js")) ?? navigator.serviceWorker.register("/sw.js");
}

/** Requests notification permission and subscribes this browser to Web Push. Must be called
 * from a user gesture (a toggle click) — browsers reject/ignore permission prompts triggered
 * on page load. Throws if the user denies permission or the browser doesn't support push. */
export async function subscribeToPush(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("This browser doesn't support desktop notifications.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await getRegistration();
  const publicKey = await getPushPublicKey();

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  const json = subscription.toJSON();
  await registerPushSubscription({
    endpoint: subscription.endpoint,
    p256dhKey: json.keys?.p256dh ?? "",
    authKey: json.keys?.auth ?? "",
    userAgent: navigator.userAgent,
  });
}

/** Unsubscribes this browser from Web Push and removes the subscription server-side. Safe to
 * call even if the browser was never subscribed. */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await unregisterPushSubscription(endpoint);
}
