import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import type { WorldRecord } from "@/services/api.js";

const dataService = vi.hoisted(() => ({ updateWorld: vi.fn() }));
vi.mock("@/services/data-service.js", () => ({
  getDataService: vi.fn(() => dataService),
  getStorageMode: vi.fn(() => "server"),
}));
vi.mock("@/services/api.js", () => ({ reviseWorld: vi.fn() }));

const { WorldDescriptionEditor } = await import("../world-description-editor.js");

const world = {
  id: "clockwork",
  name: "Clockwork",
  description: "A city of clocks.",
  createdAt: "2026-10-04T00:00:00.000Z",
  updatedAt: "2026-10-04T00:00:00.000Z",
} as WorldRecord;

beforeEach(async () => {
  await i18n.changeLanguage("en-US");
  dataService.updateWorld.mockReset();
});

afterEach(() => cleanup());

describe("WorldDescriptionEditor", () => {
  it("saves a manually edited description and returns the updated world", async () => {
    const updated = { ...world, description: "A city ruled by clockmakers." };
    dataService.updateWorld.mockResolvedValue(updated);
    const onUpdated = vi.fn();
    render(
      <WorldDescriptionEditor
        world={world}
        description={world.description}
        canUseAi={false}
        onUpdated={onUpdated}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Описание" }), {
      target: { value: updated.description },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(dataService.updateWorld).toHaveBeenCalledWith("clockwork", {
        description: updated.description,
      }),
    );
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
  });

  it("shows the AI editing controls only when AI revision is available", () => {
    const { rerender } = render(
      <WorldDescriptionEditor
        world={world}
        description={world.description}
        canUseAi={false}
        onUpdated={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Как изменить описание с ИИ")).toBeNull();

    rerender(
      <WorldDescriptionEditor
        world={world}
        description={world.description}
        canUseAi
        onUpdated={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Как изменить описание с ИИ")).toBeTruthy();
  });
});
