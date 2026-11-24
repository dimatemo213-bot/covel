import { describe, expect, it } from "vitest";
import { builtinLlmToml, parseLlmConfig } from "../src/index.js";

const storySlot = (text: string) => parseLlmConfig(text).llmConfig.covel.story;

describe("builtinLlmToml", () => {
  it("uses URV AI as the default story slot", () => {
    expect(storySlot(builtinLlmToml())).toMatchObject({
      provider: "urv",
      model: "default",
      baseUrl: "https://perchance.org/urv-ai-chat",
      protocol: "openai-chat-v1",
    });
  });

  it("points at DEFAULT_BASE_URL with the default provider", () => {
    expect(
      storySlot(
        builtinLlmToml({
          baseUrl: "https://llm.example.com/v1",
          model: "some-model",
        }),
      ),
    ).toMatchObject({
      provider: "default",
      model: "some-model",
      baseUrl: "https://llm.example.com/v1",
    });
  });
});
