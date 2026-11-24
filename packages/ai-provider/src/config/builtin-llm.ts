/**
 * The model configuration used when no llm.toml is present.
 *
 * A fresh Covel install uses URV AI through the browser-side Perchance iframe
 * bridge. Set DEFAULT_BASE_URL and DEFAULT_MODEL to use a different
 * OpenAI-compatible provider instead. No API key is stored here.
 */
export const BUILTIN_LLM_PROVIDER = "urv";

const URV_BASE_URL = "https://perchance.org/urv-ai-chat";
const URV_MODEL = "default";

export interface BuiltinLlmSettings {
  baseUrl?: string;
  model?: string;
}

export const builtinLlmProvider = (settings: BuiltinLlmSettings = {}) =>
  settings.baseUrl ? "default" : BUILTIN_LLM_PROVIDER;

export function builtinLlmToml(settings: BuiltinLlmSettings = {}): string {
  const baseUrl = settings.baseUrl ?? URV_BASE_URL;
  const model = settings.model ?? URV_MODEL;
  return `
[covel.story]
provider = ${JSON.stringify(builtinLlmProvider(settings))}
model    = ${JSON.stringify(model)}
baseUrl  = ${JSON.stringify(baseUrl)}
protocol = "openai-chat-v1"
`;
}
