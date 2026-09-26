/**
 * A small preset set of simple avatars — an Israel/Birthright-themed icon on
 * one of the app's existing gradient tokens (see styles.css), backing onto
 * static images in public/avatars/. Stored as a short "avatar:<id>" string in
 * member_handles.avatar_url so it's trivially distinguishable from a real
 * uploaded-photo URL if that's added later.
 */

export type AvatarPreset = { id: string; image: string; grad: string };

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "hoopoe", image: "/avatars/hoopoe.png", grad: "var(--grad-deals)" },
  { id: "ibex", image: "/avatars/ibex.png", grad: "var(--grad-cloud)" },
  { id: "camel", image: "/avatars/camel.png", grad: "var(--grad-discover)" },
  { id: "hyrax", image: "/avatars/hyrax.png", grad: "var(--grad-sun)" },
  { id: "turtle", image: "/avatars/turtle.png", grad: "var(--grad-sky)" },
  { id: "jackal", image: "/avatars/jackal.png", grad: "var(--grad-social)" },
  { id: "gazelle", image: "/avatars/gazelle.png", grad: "var(--grad-wallet)" },
  { id: "falafel", image: "/avatars/falafel.png", grad: "var(--grad-travel)" },
  { id: "coffee", image: "/avatars/coffee.png", grad: "var(--grad-chag)" },
  { id: "ravkav", image: "/avatars/ravkav.png", grad: "var(--grad-night)" },
  { id: "cactus", image: "/avatars/cactus.png", grad: "var(--grad-haze)" },
  { id: "pomegranate", image: "/avatars/pomegranate.png", grad: "var(--grad-alert)" },
];

const AVATAR_PREFIX = "avatar:";

export function avatarPresetId(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl || !avatarUrl.startsWith(AVATAR_PREFIX)) return null;
  return avatarUrl.slice(AVATAR_PREFIX.length);
}

export function avatarUrlFor(presetId: string): string {
  return `${AVATAR_PREFIX}${presetId}`;
}

export function avatarPreset(avatarUrl: string | null | undefined): AvatarPreset | null {
  const id = avatarPresetId(avatarUrl);
  if (!id) return null;
  return AVATAR_PRESETS.find((a) => a.id === id) ?? null;
}
