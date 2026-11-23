import {
  WORLD_LOCALIZED_TEXT_KEY,
  WORLD_PACKAGE_INFO_KEY,
  packageInfoOf,
  resolveI18nText,
} from "@covel/shared";
import type { WorldRecord } from "@covel/store";

/**
 * Project a validated manifest into the common file/store world record. The
 * editions of a package (`WORLD_EDITIONS_KEY`) come from its files; the
 * loader passes them in `metadata`.
 */
export function worldRecordFromManifest(
  manifest: Readonly<Record<string, unknown>>,
  lore: string,
  metadata: Record<string, unknown> = {},
  now = new Date().toISOString(),
): WorldRecord {
  const locale = manifest.defaultLocale as string | undefined;
  // `name` and `description` below are one language, for stores and lists.
  // Keep the translations too: a session in another locale reads them.
  const isLocaleMap = (value: unknown) =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  const localizedText = {
    ...(isLocaleMap(manifest.name) ? { name: manifest.name } : {}),
    ...(isLocaleMap(manifest.summary) ? { description: manifest.summary } : {}),
  };
  const packageInfo = packageInfoOf(manifest);
  const nsfwEnabled = manifest.nsfwEnabled === true;
  const worldLore = nsfwEnabled
    ? `${lore}${lore.trim() ? "\n\n" : ""}<!-- narrator-only -->\nNSFW mode is enabled for this world. Adult themes, romance, and consensual intimate situations may occur only between clearly adult characters (18+). Keep all characters under 18 entirely outside sexual or erotic content. Respect consent and do not eroticize coercion or exploitation.\n<!-- /narrator-only -->`
    : lore;
  return {
    id: manifest.id as string,
    name:
      resolveI18nText(
        manifest.name as string | Record<string, string>,
        locale,
      ) ?? "",
    description:
      resolveI18nText(
        manifest.summary as string | Record<string, string>,
        locale,
      ) ?? "",
    lore: worldLore || undefined,
    tags: manifest.tags as string[] | undefined,
    locale,
    metadata: {
      plugins: manifest.plugins,
      ...(typeof manifest.nsfwEnabled === "boolean" ? { nsfwEnabled } : {}),
      pluginPitch: manifest.pluginPitch,
      pluginSettings: manifest.pluginSettings,
      worldDataPath: manifest.worldData,
      characterSchema: manifest.characterSchema,
      ...(manifest.defaultViewMode
        ? { defaultViewMode: manifest.defaultViewMode }
        : {}),
      ...(manifest.themeMusic ? { themeMusic: manifest.themeMusic } : {}),
      ...(manifest.cover ? { cover: manifest.cover } : {}),
      ...(manifest.accentColor ? { accentColor: manifest.accentColor } : {}),
      ...(Object.keys(localizedText).length
        ? { [WORLD_LOCALIZED_TEXT_KEY]: localizedText }
        : {}),
      // Version and credits, for the world's cards.
      ...(packageInfo ? { [WORLD_PACKAGE_INFO_KEY]: packageInfo } : {}),
      ...metadata,
    },
    createdAt: now,
    updatedAt: now,
  };
}
