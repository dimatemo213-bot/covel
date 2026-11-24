import { describe, expect, it } from "vitest";
import {
  projectDimensionSnapshot,
  type DimensionSnapshot,
} from "@covel/shared";
import { buildWorldContextView } from "../src/session-context-views.js";

const dimensions: DimensionSnapshot = {
  factions: {
    name: "Factions",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string", "x-i18n": true },
        },
      },
    },
    // Session state holds one language: the world's locale maps were
    // resolved when the world was imported.
    value: [{ id: "salt-fangs", name: "盐牙会" }],
    version: 3,
  },
  codes: {
    name: "Codes",
    schema: { type: "object", additionalProperties: { type: "string" } },
    value: { "zh-CN": "business-a", "en-US": "business-b" },
    version: 1,
  },
};
function view(locale: string) {
  return buildWorldContextView({
    worldRecord: {
      id: "w1",
      name: "W",
      description: "Summary",
      tags: ["fog"],
      createdAt: "2026-01-01T00:00:00Z",
    },
    schemaMap: undefined,
    entriesMap: undefined,
    dimensions,
    locale,
  });
}
describe("buildWorldContextView frozen dimensions", () => {
  it("keeps the same versioned raw public values, with a detached snapshot", () => {
    const current = view("zh-CN");
    expect(current.dimensions).toEqual(dimensions);
    expect(current.dimensions).not.toBe(dimensions);
    expect(current.name).toBe("W");
    expect(current.tags).toEqual(["fog"]);
  });
  it("passes enabled NSFW mode to the narrator without changing world lore", () => {
    const worldRecord = {
      id: "w1",
      name: "W",
      description: "Summary",
      lore: "Authored world lore.",
      metadata: { nsfwEnabled: true },
      createdAt: "2026-01-01T00:00:00Z",
    };
    const current = buildWorldContextView({
      worldRecord,
      schemaMap: undefined,
      entriesMap: undefined,
      dimensions: {},
      locale: "en-US",
    });

    expect(current.lore).toBe("Authored world lore.");
    expect(current.extra).toMatchObject({
      nsfwEnabled: true,
      narrativeModeInstructions: expect.stringContaining("clearly adult characters (18+)"),
    });
  });

  it("normalizes legacy all-ages ratings in the gameplay context", () => {
    const current = buildWorldContextView({
      worldRecord: {
        id: "w1",
        name: "W",
        description: "Summary",
        createdAt: "2026-01-01T00:00:00Z",
      },
      schemaMap: undefined,
      entriesMap: undefined,
      dimensions: {
        tone: {
          name: "Tone",
          schema: { type: "object" },
          value: { genres: ["slice-of-life"], contentRating: "all-ages" },
          version: 1,
        },
      },
      locale: "en-US",
    });

    expect(current.dimensions?.tone?.value).toMatchObject({
      genres: ["slice-of-life"],
      contentRating: "mature",
    });
  });

  it("projects stored values as they are, whatever the request language", () => {
    for (const locale of ["zh-CN", "ja-JP"]) {
      const projection = projectDimensionSnapshot(
        view(locale).dimensions!,
        locale,
      );
      expect(projection).toContain("盐牙会");
      expect(projection).toContain("salt-fangs");
      // Ordinary data keyed by language codes is not translatable text.
      expect(projection).toContain("business-a");
      expect(projection).toContain("business-b");
    }
  });
});
