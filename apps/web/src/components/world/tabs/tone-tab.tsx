import { useState } from "react";
import { Label } from "@/components/ui/label.js";
import {
  inputCls,
  textareaCls,
  type TabProps,
} from "../editor-helpers.js";
import type { WorldTone } from "@covel/shared";
import { fieldProblems } from "./field-problems.js";

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ToneTab({ dimensions, onChange, t, problems }: TabProps) {
  const tone: WorldTone = dimensions.tone
    ? { ...dimensions.tone, contentRating: "mature" }
    : {
        genres: [],
        contentRating: "mature",
      };
  const problem = fieldProblems(problems);
  // The two lists as the player types them. A field that showed the list
  // built from its text would drop a comma, or a space after a word, on the
  // key press that types it: neither is part of an entry yet.
  const [genresText, setGenresText] = useState(() => tone.genres.join(", "));
  const [themesText, setThemesText] = useState(() =>
    (tone.themes ?? []).join(", "),
  );

  function setTone(next: WorldTone) {
    onChange({
      ...dimensions,
      tone: { ...next, contentRating: "mature" },
    });
  }

  return (
    <div className="space-y-6">
      {/* Genres (comma-separated) */}
      <div className="space-y-1">
        <Label htmlFor="world-tone-genres">{t("world.genres")}</Label>
        <input
          id="world-tone-genres"
          className={inputCls}
          value={genresText}
          onChange={(e) => {
            setGenresText(e.target.value);
            setTone({ ...tone, genres: splitList(e.target.value) });
          }}
        />
        {problem.at("genres")}
      </div>

      {/* Narrative Style */}
      <div className="space-y-1">
        <Label htmlFor="world-tone-narrative-style">
          {t("world.narrativeStyle")}
        </Label>
        <textarea
          id="world-tone-narrative-style"
          className={textareaCls}
          value={
            typeof tone.narrativeStyle === "string" ? tone.narrativeStyle : ""
          }
          onChange={(e) => setTone({ ...tone, narrativeStyle: e.target.value })}
        />
        {problem.at("narrativeStyle")}
      </div>

      {/* Themes (comma-separated) */}
      <div className="space-y-1">
        <Label htmlFor="world-tone-themes">{t("world.themes")}</Label>
        <input
          id="world-tone-themes"
          className={inputCls}
          value={themesText}
          onChange={(e) => {
            setThemesText(e.target.value);
            setTone({ ...tone, themes: splitList(e.target.value) });
          }}
        />
        {problem.at("themes")}
      </div>
      {problem.rest()}
    </div>
  );
}
