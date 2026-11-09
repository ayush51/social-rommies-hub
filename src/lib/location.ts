// Shared helpers for location sharing. Nothing here touches geolocation until getPosition() is called from a tap or an active share.

export type Share = { precision: string; lat: number; lng: number; updated_at: string; expires_at: string; paused: boolean };

export const DURATIONS = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 240, label: "4 hours" },
  { minutes: 720, label: "12 hours" },
  { minutes: 1440, label: "24 hours" },
];

export const isActive = (s: { paused: boolean; expires_at: string } | null | undefined, now: number): boolean =>
  !!s && !s.paused && new Date(s.expires_at).getTime() > now;

// Tells the indicator and the /location page that something changed, so they re-read state right away.
export const notifyLocationChanged = () => window.dispatchEvent(new Event("location:changed"));

export function getPosition(precise: boolean): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("This device can't share its location."));
    navigator.geolocation.getCurrentPosition(resolve, (e) => reject(new Error(e.code === 1 ? "Location permission was denied. You can allow it in your browser or phone settings." : "Couldn't get your location. Try again.")), {
      enableHighAccuracy: precise,
      maximumAge: 30_000,
      timeout: 15_000,
    });
  });
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(km: number): string {
  if (km < 0.5) return "Nearby";
  const mi = km * 0.621371;
  return km < 10 ? `${km.toFixed(1)} km (${mi.toFixed(1)} mi)` : `${Math.round(km)} km (${Math.round(mi)} mi)`;
}

export function agoText(iso: string, now: number): string {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  return mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)}h ago`;
}
