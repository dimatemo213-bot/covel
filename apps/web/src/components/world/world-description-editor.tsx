import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Save, Sparkles, Wand2 } from "lucide-react";
import * as api from "@/services/api.js";
import type { WorldRecord } from "@/services/api.js";
import { getDataService } from "@/services/data-service.js";
import { Button } from "@/components/ui/button.js";
import {
  WorldGenerationStatus,
  type WorldGenerationPhase,
} from "./world-generation-status.js";

interface WorldDescriptionEditorProps {
  world: WorldRecord;
  description: string;
  onUpdated: (world: WorldRecord) => void;
}

const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_INSTRUCTION_LENGTH = 2000;

export function WorldDescriptionEditor({
  world,
  description,
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

  async function improveWithAi() {
    const request = instruction.trim();
    if (!request || working || saving) return;
    const run = ++runRef.current;
    setPhase("generating");
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const revisedDescription = await api.reviseWorldDescription(
        world,
        request,
        controller.signal,
      );
      if (run !== runRef.current) return;
      setPhase("saving");
      const updated = await getDataService().updateWorld(world.id, {
        description: revisedDescription,
      });
      if (run !== runRef.current) return;
      abortRef.current = null;
      setPhase("done");
      setInstruction("");
      setDraft(updated.description ?? "");
      onUpdated(updated);
    } catch (err) {
      if (run !== runRef.current || controller.signal.aborted) return;
      abortRef.current = null;
      setPhase("error");
      setError(err instanceof Error ? err.message : String(err));
    }
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
        {error && phase === "idle" && (
          <p role="alert" className="text-xs text-destructive">{error}</p>
        )}
      </div>

      {(
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
          {draft !== description && (
            <p className="text-xs text-muted-foreground">
              {t("world.descriptionAiSaveFirst", "Сначала сохраните ручные изменения, затем запускайте ИИ.")}
            </p>
          )}
          <div className="flex justify-end gap-2">
            {working && (
              <Button size="sm" variant="ghost" onClick={cancelAi}>
                {t("common.cancel", "Отмена")}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={working || saving || !instruction.trim() || draft !== description}
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
    </section>
  );
}
