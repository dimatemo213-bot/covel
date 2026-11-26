import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Braces,
  MapPin,
  Users,
  Zap,
  Clock,
  Coins,
  Building2,
  Palette,
  Gamepad2,
  Flag,
  FileText,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.js";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs.js";
import type { WorldDimensions } from "@covel/shared";
import {
  dimensionProblems,
  mergeDimensionDrafts,
  projectDimensionTemplates,
  type DimensionsState,
} from "./editor-helpers.js";
import { DimensionsJsonEditor } from "./dimensions-json-editor.js";
import type { WorldRecord, WorldSummary } from "@/services/api.js";
import { useWorldRecord } from "@/services/world-records.js";
import { getDataService } from "@/services/data-service.js";
import { requestConfirm } from "@/lib/confirm-channel.js";
import { onWorldListRequest } from "@/lib/nav-events.js";
import { GeographyTab } from "./tabs/geography-tab.js";
import { FactionsTab } from "./tabs/factions-tab.js";
import { PowerSystemTab } from "./tabs/power-system-tab.js";
import { HistoryTab } from "./tabs/history-tab.js";
import { EconomyTab } from "./tabs/economy-tab.js";
import { SocialStructureTab } from "./tabs/social-structure-tab.js";
import { ToneTab } from "./tabs/tone-tab.js";
import { MechanicsTab } from "./tabs/mechanics-tab.js";
import { StartingConditionsTab } from "./tabs/starting-conditions-tab.js";

interface WorldEditorProps {
  world: WorldRecord;
  onSave: (updated: WorldRecord) => void;
  onCancel: () => void;
  /** Leave for the world list (the topbar's World item); default `onCancel`. */
  onExit?: () => void;
}

interface TabDef {
  id: string;
  labelKey: string;
  label?: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  {
    id: "general",
    labelKey: "world.general",
    label: "General",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: "definitions",
    labelKey: "world.dimensionDefinitions",
    icon: <Braces className="h-4 w-4" />,
  },
  {
    id: "geography",
    labelKey: "world.geography",
    icon: <MapPin className="h-4 w-4" />,
  },
  {
    id: "factions",
    labelKey: "world.factions",
    icon: <Users className="h-4 w-4" />,
  },
  {
    id: "powerSystem",
    labelKey: "world.powerSystem",
    icon: <Zap className="h-4 w-4" />,
  },
  {
    id: "history",
    labelKey: "world.history",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    id: "economy",
    labelKey: "world.economy",
    icon: <Coins className="h-4 w-4" />,
  },
  {
    id: "socialStructure",
    labelKey: "world.socialStructure",
    icon: <Building2 className="h-4 w-4" />,
  },
  { id: "tone", labelKey: "world.tone", icon: <Palette className="h-4 w-4" /> },
  {
    id: "mechanics",
    labelKey: "world.mechanics",
    icon: <Gamepad2 className="h-4 w-4" />,
  },
  {
    id: "startingConditions",
    labelKey: "world.startingConditions",
    icon: <Flag className="h-4 w-4" />,
  },
];

interface WorldEditorLoaderProps {
  /** The list's summary; the editor opens on the full record. */
  world: WorldSummary;
  onSave: (updated: WorldRecord) => void;
  onCancel: () => void;
  onExit?: () => void;
}

/** Opens the editor once the world's full record (dimensions, lore) is here. */
export function WorldEditorLoader({
  world,
  onSave,
  onCancel,
  onExit,
}: WorldEditorLoaderProps) {
  const { t } = useTranslation();
  const record = useWorldRecord(world.id);
  const loaded = record.world !== null;
  const exit = useEffectEvent(() => (onExit ?? onCancel)());
  // While the record loads there is nothing to lose.
  useEffect(
    () => (loaded ? undefined : onWorldListRequest(() => exit())),
    [loaded],
  );
  if (!record.world) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p role="status">
          {record.status === "loading"
            ? t("common.loading")
            : t("common.error")}
        </p>
        <div className="flex gap-2">
          {record.status !== "loading" && (
            <Button variant="outline" onClick={record.retry}>
              {t("common.retry")}
            </Button>
          )}
          <Button variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <WorldEditor
      key={record.world.id}
      world={record.world}
      onSave={onSave}
      onCancel={onCancel}
      onExit={onExit}
    />
  );
}

export function WorldEditor({
  world,
  onSave,
  onCancel,
  onExit,
}: WorldEditorProps) {
  const { t } = useTranslation();
  // The definitions as loaded, or as the JSON editor last applied them.
  const [general, setGeneral] = useState(() => ({
    name: world.name,
    description: world.description ?? "",
    lore: world.lore ?? "",
    tags: (world.tags ?? []).join("\n"),
  }));
  const [dimensions, setDimensions] = useState<WorldDimensions>(() =>
    structuredClone(world.dimensions ?? {}),
  );
  // What the form tabs edit. A draft may be incomplete while the player
  // types: nothing checks it before the save.
  const [drafts, setDrafts] = useState<DimensionsState>(() =>
    projectDimensionTemplates(dimensions),
  );
  // Keep incomplete form values and unapplied JSON in the dirty check.
  // Merged definitions alone can omit an unnamed or duplicate resource row.
  const snapshot = JSON.stringify({ dimensions, drafts, general });
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const [jsonDrafts, setJsonDrafts] = useState<
    Record<string, { value: string; original: string }>
  >({});
  const dirty =
    snapshot !== savedSnapshot ||
    Object.values(jsonDrafts).some(({ value, original }) => value !== original);
  const [confirming, setConfirming] = useState(false);
  // The router keeps the guard of an earlier render until the next one
  // commits, so the guard reads whether a dialog is open from a ref.
  const confirmingRef = useRef(false);
  const editorRef = useRef<object | null>(null);

  useEffect(() => {
    const editor = {};
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, [world.id]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  const [activeTab, setActiveTab] = useState("definitions");
  // Set by a save that found problems. From then on the problems follow the
  // edits, so a message goes when its field is put right.
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const merged = useMemo(
    () => mergeDimensionDrafts(dimensions, drafts, t),
    [dimensions, drafts, t],
  );
  const problems = useMemo(
    () => (checking ? dimensionProblems(merged, drafts, t) : undefined),
    [checking, merged, drafts, t],
  );
  const blocked =
    problems &&
    (Object.keys(problems.tabs).length > 0
      ? t("world.fixMarkedFields", "Fix the marked fields before saving.")
      : problems.other[0]);

  // The JSON editor replaced the definitions, which is a new load: the tabs
  // get their drafts from it again. A dimension whose value the player left
  // as it was keeps its draft, which can hold more than the JSON shows (a
  // list that still needs its first entry, two resources with one name).
  function applyDefinitions(next: WorldDimensions) {
    const untouched = Object.entries(drafts).filter(
      ([id]) =>
        JSON.stringify(next[id]?.initialValue) ===
        JSON.stringify(merged[id]?.initialValue),
    );
    setDimensions(next);
    setDrafts({
      ...projectDimensionTemplates(next),
      ...Object.fromEntries(untouched),
    });
    setJsonDrafts((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([id]) => id !== activeTab),
      ),
    );
  }
  const templateComponents = {
    geography: GeographyTab,
    factions: FactionsTab,
    powerSystem: PowerSystemTab,
    history: HistoryTab,
    economy: EconomyTab,
    socialStructure: SocialStructureTab,
    tone: ToneTab,
    mechanics: MechanicsTab,
    startingConditions: StartingConditionsTab,
  };

  async function handleSave() {
    if (!general.name.trim()) {
      setError(t("world.nameRequired", "World name is required."));
      setActiveTab("general");
      return;
    }
    const found = dimensionProblems(merged, drafts, t);
    const problemTab = TABS.find((tab) => found.tabs[tab.id]);
    if (problemTab || found.other.length > 0) {
      setChecking(true);
      setError(null);
      // Bring a problem into view, unless the open tab already shows one.
      if (problemTab && !found.tabs[activeTab]) setActiveTab(problemTab.id);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await getDataService().updateWorld(world.id, {
        name: general.name.trim(),
        description: general.description,
        lore: general.lore,
        tags: general.tags
          .split("\n")
          .map((tag) => tag.trim())
          .filter(Boolean),
        dimensions: merged,
      });
      setSavedSnapshot(snapshot);
      onSave(updated);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("world.saveFailed");
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmLeave(): Promise<boolean> {
    if (saving || confirmingRef.current) return false;
    if (!dirty) return true;
    const editor = editorRef.current;
    confirmingRef.current = true;
    setConfirming(true);
    try {
      const discard = await requestConfirm({
        title: t("world.discardChangesTitle"),
        message: t("world.discardChangesMessage"),
        confirmLabel: t("world.discardChanges"),
        cancelLabel: t("world.keepEditing"),
        destructive: true,
      });
      return editorRef.current === editor && discard;
    } finally {
      confirmingRef.current = false;
      if (editorRef.current === editor) setConfirming(false);
    }
  }

  useBlocker({
    shouldBlockFn: async () => !(await confirmLeave()),
    // The editor owns its native unload guard as well as this router guard.
    enableBeforeUnload: false,
  });

  async function handleCancel() {
    if (saving || confirming) return;
    if (!dirty || (await confirmLeave())) onCancel();
  }

  // The topbar's World item does not change the route, so the router guard
  // above never sees it: ask here, as Cancel does.
  const leaveForList = useEffectEvent(async () => {
    if (saving || confirming) return;
    if (!dirty || (await confirmLeave())) (onExit ?? onCancel)();
  });
  useEffect(() => onWorldListRequest(() => void leaveForList()), []);

  return (
    <div className="h-full overflow-hidden bg-background p-3 sm:p-5 md:p-8">
      <Card className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden">
        <CardHeader className="sticky top-0 z-10 flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b border-border bg-card pb-4">
          <CardTitle>{t("world.editTitle", "Edit world")}</CardTitle>
          <div className="flex items-center gap-2">
            {(blocked || error) && (
              <span role="alert" className="text-sm text-destructive">
                {blocked || error}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={saving || confirming}
            >
              <X className="mr-1 h-4 w-4" />
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || confirming}
            >
              <Save className="mr-1 h-4 w-4" />
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 overflow-hidden pt-4">
          <fieldset disabled={saving || confirming} className="contents">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex flex-col h-full"
            >
              <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto overscroll-x-contain">
                {TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    aria-label={t(tab.labelKey, { defaultValue: tab.label ?? tab.labelKey })}
                    className="shrink-0 gap-1.5"
                  >
                    {tab.icon}
                    <span aria-hidden="true" className="hidden sm:inline">
                      {t(tab.labelKey)}
                    </span>
                    {problems?.tabs[tab.id] && (
                      <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-destructive"
                      />
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {TABS.map((tab) => {
                  if (tab.id === "general") {
                    return (
                      <TabsContent value="general" key="general">
                        <div className="mx-auto max-w-3xl space-y-5">
                          <div className="space-y-2">
                            <label htmlFor="world-name" className="text-sm font-medium">
                              {t("world.name", "World name")}
                            </label>
                            <input
                              id="world-name"
                              value={general.name}
                              maxLength={160}
                              onChange={(event) =>
                                setGeneral((current) => ({ ...current, name: event.target.value }))
                              }
                              className="w-full rounded-(--radius-control) border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                            />
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="world-description" className="text-sm font-medium">
                              {t("world.description", "Short description")}
                            </label>
                            <textarea
                              id="world-description"
                              value={general.description}
                              maxLength={4000}
                              rows={4}
                              onChange={(event) =>
                                setGeneral((current) => ({ ...current, description: event.target.value }))
                              }
                              className="w-full resize-y rounded-(--radius-control) border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary"
                            />
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="world-lore" className="text-sm font-medium">
                              {t("world.lore", "World lore")}
                            </label>
                            <textarea
                              id="world-lore"
                              value={general.lore}
                              rows={10}
                              onChange={(event) =>
                                setGeneral((current) => ({ ...current, lore: event.target.value }))
                              }
                              className="w-full resize-y rounded-(--radius-control) border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary"
                            />
                            <p className="text-xs text-muted-foreground">
                              {t("world.loreEditHint", "This changes the saved world record. It does not rewrite the original package files.")}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="world-tags" className="text-sm font-medium">
                              {t("world.tags", "Tags")}
                            </label>
                            <textarea
                              id="world-tags"
                              value={general.tags}
                              rows={3}
                              onChange={(event) =>
                                setGeneral((current) => ({ ...current, tags: event.target.value }))
                              }
                              className="w-full resize-y rounded-(--radius-control) border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary"
                            />
                            <p className="text-xs text-muted-foreground">
                              {t("world.tagsEditHint", "Enter one tag per line.")}
                            </p>
                          </div>
                        </div>
                      </TabsContent>
                    );
                  }
                  const id = tab.id as keyof typeof templateComponents;
                  const Component =
                    tab.id === "definitions"
                      ? undefined
                      : templateComponents[id];
                  // A tab is a form when its dimension is new or fitted the
                  // template as loaded, which is when it got its draft. The
                  // draft is not checked again here: a value that is incomplete
                  // in the middle of an edit must not swap the form for JSON
                  // under the player's cursor.
                  const hasForm = !dimensions[id] || drafts[id] !== undefined;
                  return (
                    <TabsContent value={tab.id} key={tab.id}>
                      {Component && hasForm ? (
                        <Component
                          dimensions={drafts}
                          onChange={setDrafts}
                          t={t}
                          problems={problems?.tabs[tab.id]}
                        />
                      ) : (
                        <DimensionsJsonEditor
                          dimensions={merged}
                          onChange={applyDefinitions}
                          draft={
                            jsonDrafts[tab.id]?.value ??
                            JSON.stringify(merged, null, 2)
                          }
                          onDraftChange={(value) =>
                            setJsonDrafts((current) => ({
                              ...current,
                              [tab.id]: {
                                value,
                                original:
                                  current[tab.id]?.original ??
                                  JSON.stringify(merged, null, 2),
                              },
                            }))
                          }
                        />
                      )}
                    </TabsContent>
                  );
                })}
              </div>
            </Tabs>
          </fieldset>
        </CardContent>
      </Card>
    </div>
  );
}
