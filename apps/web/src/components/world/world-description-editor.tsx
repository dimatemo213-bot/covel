import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Save, Sparkles, Wand2 } from "lucide-react";
import * as api from "@/services/api.js";
import type { GenerateWorldEvent, WorldRecord } from "@/services/api.js";
import { getDataService, getStorageMode } from "@/services/data-service.js";
import { Button } from "@/components/ui/button.js";
import {
  WorldGenerationStatus,
  type WorldGenerationPhase,
} from "./world-generation-status.js";

interface WorldDescriptionEditorProps {
  world: WorldRecord;
  description: string;
  canUseAi: boolean;
  onUpdated: (world: WorldRecord) => void;
}

const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_INSTRUCTION_LENGTH = 2000;

export function WorldDescriptionEditor({
  world,
  description,
  canUseAi,
  onUpdated,
}: WorldDescriptionEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(description);
  const [instruction, setInstruction] = useState("");
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState<WorldGenerationPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runRef = useRef(0);

  useEffect(() => {
    setDraft(description);
  }, [description, world.id]);

  useEffect(
    () => () => {
      runRef.current += 1;
      abortRef.current?.abort();
    },
    [],
  );

  const working =
    phase === "generating" || phase === "validating" || phase === "saving";

  async function saveDescription() {
    if (saving || working || draft === description) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await getDataService().updateWorld(world.id, {
        description: draft,
      });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function cancelAi() {
    runRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("idle");
  }

  function improveWithAi() {
    const request = instruction.trim();
    if (!request || working || saving || !canUseAi) return;
    const run = ++runRef.current;
    const local = getStorageMode() === "local";
    const expectedWorld = structuredClone(world);
    setPhase("generating");
    setError(null);
    const fail = (message: string) => {
      if (run !== runRef.current) return;
      abortRef.current = null;
      setPhase("error");
      setError(message);
    };
    const prompt =
      "Edit only the world's short public description. Keep it concise and " +
      "accurate to the existing world. Follow this request: " +
      request +
      " Preserve the world's lore, history, characters, factions, mechanics, " +
      "dimensions, and all other world data; do not invent unrelated changes.";
    abortRef.current = api.reviseWorld(
      world.id,
      prompt,
      (event: GenerateWorldEvent) => {
        if (run !== runRef.current) return;
        if (event.type === "progress") {
          setPhase(event.phase);
          return;
        }
        if (event.type === "error") {
          fail(event.message);
          return;
        }
        void (async () => {
          try {
            const revised = local
              ? await getDataService().saveGeneratedWorld(event.world, {
                  expectedWorld,
                })
              : event.world;
            if (run !== runRef.current) return;
            abortRef.current = null;
            setPhase("done");
            setInstruction("");
            setDraft(revised.description ?? "");
            onUpdated(revised);
          } catch (err) {
            fail(err instanceof Error ? err.message : String(err));
          }
        })();
      },
      (err) => fail(err.message),
      local ? { world: expectedWorld } : undefined,
    );
  }

  return (
    <section
      aria-label={t("world.descriptionEditorTitle", "Описание мира")}
      className="max-w-3xl space-y-4 rounded-(--radius-card) border border-border bg-card p-4"
    >
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Wand2 className="h-4 w-4 text-primary" />
          {t("world.descriptionEditorTitle", "Описание мира")}
        </h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t(
            "world.descriptionEditorHint",
            "Измените описание вручную или попросите ИИ переписать его по вашей инструкции.",
          )}
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="world-description-draft"
          className="text-sm font-medium"
        >
          {t("world.descriptionField", "Описание")}
        </label>
        <textarea
          id="world-description-draft"
          value={draft}
          maxLength={MAX_DESCRIPTION_LENGTH}
          rows={5}
          disabled={saving || working}
          onChange={(event) => setDraft(event.target.value)}
          className="w-full resize-y rounded-(--radius-control) border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary disabled:opacity-60"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {draft.length}/{MAX_DESCRIPTION_LENGTH}
          </span>
          <Button
            size="sm"
            onClick={() => void saveDescription()}
            disabled={saving || working || draft === description}
          >
            <Save className="mr-1.5 h-4 w-4" />
            {saving
              ? t("common.saving", "Сохранение…")
              : t("common.save", "Сохранить")}
          </Button>
        </div>
      </div>

      {canUseAi && (
        <div className="space-y-2 border-t border-border pt-4">
          <label htmlFor="world-description-ai" className="text-sm font-medium">
            {t("world.descriptionAiInstruction", "Как изменить описание с ИИ")}
          </label>
          <textarea
            id="world-description-ai"
            value={instruction}
            maxLength={MAX_INSTRUCTION_LENGTH}
            rows={2}
            disabled={working || saving}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder={t(
              "world.descriptionAiPlaceholder",
              "Например: сделай описание более атмосферным и добавь информацию о главном конфликте.",
            )}
            className="w-full resize-y rounded-(--radius-control) border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
          />
          <div className="flex justify-end gap-2">
            {working && (
              <Button size="sm" variant="ghost" onClick={cancelAi}>
                {t("common.cancel", "Отмена")}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={working || saving || !instruction.trim()}
              onClick={improveWithAi}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {working
                ? t("world.revising", "ИИ редактирует…")
                : t("world.descriptionAiAction", "Изменить с помощью ИИ")}
            </Button>
          </div>
          <WorldGenerationStatus
            phase={phase}
            error={error}
            t={t}
            doneLabel={t(
              "world.descriptionAiDone",
              "Описание обновлено.",
            )}
          />
        </div>
      )}
      {!canUseAi && (
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          {t(
            "world.descriptionAiUnavailable",
            "ИИ-редактирование доступно для миров, созданных генератором Covel. Описание можно изменить вручную.",
          )}
        </p>
      )}
    </section>
  );
}
