/**
 * A small preset set of simple avatars — an emoji on one of the app's
 * existing gradient tokens (see styles.css). Stored as a short "avatar:<id>"
 * string in member_handles.avatar_url so it's trivially distinguishable from
 * a real uploaded-photo URL if that's added later.
 */

export type AvatarPreset = { id: string; emoji: string; grad: string };

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "fox", emoji: "🦊", grad: "var(--grad-deals)" },
  { id: "koala", emoji: "🐨", grad: "var(--grad-cloud)" },
  { id: "turtle", emoji: "🐢", grad: "var(--grad-discover)" },
  { id: "lion", emoji: "🦁", grad: "var(--grad-sun)" },
  { id: "penguin", emoji: "🐧", grad: "var(--grad-sky)" },
  { id: "butterfly", emoji: "🦋", grad: "var(--grad-social)" },
  { id: "cactus", emoji: "🌵", grad: "var(--grad-wallet)" },
  { id: "wave", emoji: "🌊", grad: "var(--grad-travel)" },
  { id: "star", emoji: "⭐", grad: "var(--grad-chag)" },
  { id: "moon", emoji: "🌙", grad: "var(--grad-night)" },
  { id: "sunflower", emoji: "🌻", grad: "var(--grad-haze)" },
  { id: "pomegranate", emoji: "🍎", grad: "var(--grad-alert)" },
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
