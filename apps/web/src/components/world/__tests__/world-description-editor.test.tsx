import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import type { WorldRecord } from "@/services/api.js";

const dataService = vi.hoisted(() => ({ updateWorld: vi.fn() }));
const api = vi.hoisted(() => ({ reviseWorldDescription: vi.fn() }));
vi.mock("@/services/data-service.js", () => ({
  getDataService: vi.fn(() => dataService),
}));
vi.mock("@/services/api.js", () => api);

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
  api.reviseWorldDescription.mockReset();
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

  it("uses AI to revise and persist only the public description", async () => {
    const updated = { ...world, description: "A city of clocks ruled by makers." };
    api.reviseWorldDescription.mockResolvedValue(updated.description);
    dataService.updateWorld.mockResolvedValue(updated);
    const onUpdated = vi.fn();
    render(
      <WorldDescriptionEditor
        world={world}
        description={world.description}
        onUpdated={onUpdated}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Как изменить описание с ИИ" }), {
      target: { value: "Добавь сведения о часовщиках." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Изменить с помощью ИИ" }));

    await waitFor(() =>
      expect(api.reviseWorldDescription).toHaveBeenCalledWith(
        world,
        "Добавь сведения о часовщиках.",
        expect.any(AbortSignal),
      ),
    );
    await waitFor(() =>
      expect(dataService.updateWorld).toHaveBeenCalledWith("clockwork", {
        description: updated.description,
      }),
    );
    expect(onUpdated).toHaveBeenCalledWith(updated);
  });
});
