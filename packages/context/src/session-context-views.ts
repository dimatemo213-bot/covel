/**
 * View adapters for `buildSessionContextSnapshot`.
 *
 * Extracted from `session-context.ts` so the loader stays focused on store
 * I/O and guard semantics.
 */

import {
  WORLD_LOCALIZED_TEXT_KEY,
  WORLD_PACKAGE_INFO_KEY,
  localizedWorldText,
  modelFacingJson,
  resolveI18nDeep,
} from "@covel/shared";
import type { DimensionSnapshot } from "@covel/shared";
import type { WorldRecord } from "./session-context-store.js";
import type { WorldContextView } from "./types.js";

export interface BuildViewInput {
  readonly worldId?: string;
  readonly worldRecord: WorldRecord | null;
  readonly schemaMap: Record<string, unknown> | undefined;
  readonly entriesMap: Record<string, unknown> | undefined;
  readonly dimensions?: DimensionSnapshot;
  readonly dimensionProviderPluginId?: string;
  /** Session locale — used to localize i18n dimensions before injection. */
  readonly locale?: string;
}

export function buildWorldContextView(input: BuildViewInput): WorldContextView {
  const worldRecord = input.worldRecord;
  const id = input.worldId ?? worldRecord?.id ?? "";

  const entriesArray = input.entriesMap
    ? Object.entries(input.entriesMap).map(([key, content]) => ({
        key,
        content,
      }))
    : [];

  let extra: Record<string, unknown> | undefined;

  const metadata =
    worldRecord?.metadata && typeof worldRecord.metadata === "object"
      ? (worldRecord.metadata as Record<string, unknown>)
      : undefined;
  if (metadata) {
    // Surface remaining metadata keys through the open `extra` record.
    for (const [k, v] of Object.entries(metadata)) {
      if (k === "dimensions" || k === WORLD_LOCALIZED_TEXT_KEY) continue;
      // Credits are the package author's own text, for cards only. Keeping
      // them out of prompt templates means that text never reaches a model.
      if (k === WORLD_PACKAGE_INFO_KEY) continue;
      extra = extra ?? {};
      extra[k] = v;
    }
  }

  // World-level adult-content mode is passed as an explicit narrator
  // instruction, without mutating the authored lore (which revisions reuse).
  if (metadata?.nsfwEnabled === true) {
    extra = extra ?? {};
    extra.narrativeModeInstructions =
      "NSFW mode is enabled. Adult themes, romance, and consensual intimate situations may occur only between clearly adult characters (18+). Keep all characters under 18 entirely outside sexual or erotic content. Respect consent and do not eroticize coercion or exploitation.";
  }

  const dimensions = structuredClone(input.dimensions ?? {});
  // Content rating is no longer a player-facing world setting. Normalize
  // legacy worlds too, so an old "all-ages" value cannot silently constrain
  // the narrator after this setting has been removed from the editor.
  const tone = dimensions.tone;
  if (tone && typeof tone === "object" && !Array.isArray(tone)) {
    dimensions.tone = {
      ...(tone as Record<string, unknown>),
      contentRating: "mature",
    };
  }

  return {
    id,
    // The session's language, when the world ships that translation.
    ...localizedWorldText(worldRecord, input.locale),
    tags: worldRecord?.tags,
    lore: worldRecord?.lore,
    dimensions,
    dimensionProviderPluginId: input.dimensionProviderPluginId,
    // Localize i18n leaves in the schema too (e.g. attribute `name` /
    // `description` records) so prompt-injected `<world-schema>` shows one
    // language, mirroring how dimensions are resolved above. The record's
    // session ID and times are not part of what a prompt shows.
    schema:
      input.schemaMap !== undefined
        ? (modelFacingJson(
            resolveI18nDeep(input.schemaMap, input.locale),
          ) as Record<string, unknown>)
        : undefined,
    entries: entriesArray,
    extra,
  };
}
