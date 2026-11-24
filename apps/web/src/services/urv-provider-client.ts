/**
 * Browser client for the URV AI iframe bridge.
 *
 * The iframe is deliberately isolated from Covel's server. The server asks
 * the browser relay to perform a chat request; this module forwards it to the
 * URV page and returns the generated text.
 */
export interface UrvMessage {
  role: string;
  content: unknown;
}

export interface UrvChatOptions {
  model?: string;
  apiKey?: string;
  timeoutMs?: number;
  onChunk?: (delta: string) => void;
}

interface UrvPending {
  resolve(value: string): void;
  reject(error: Error): void;
  onChunk?: (delta: string) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface UrvProviderClient {
  chat(messages: UrvMessage[], options?: UrvChatOptions): Promise<string>;
  dispose(): void;
}

const URV_IFRAME_URL = "https://perchance.org/urv-ai-chat";
const URV_MODEL_ID = "default";

export function createUrvProviderClient(
  options: { iframeUrl?: string; timeoutMs?: number } = {},
): UrvProviderClient {
  const iframeUrl = options.iframeUrl ?? URV_IFRAME_URL;
  const iframeOrigin = new URL(iframeUrl).origin;
  const timeoutMs = options.timeoutMs ?? 90_000;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute(
    "style",
    "position:absolute;width:1px;height:1px;left:-9999px;top:0;border:0;visibility:hidden;",
  );
  iframe.src = iframeUrl;
  document.documentElement.appendChild(iframe);

  let sequence = 0;
  let infoReady = false;
  let disposed = false;
  const pending = new Map<string, UrvPending>();
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  const readyTimeout = window.setTimeout(() => {
    if (!infoReady) rejectReady(new Error("URV iframe did not become ready within 30 seconds."));
  }, 30_000);

  const readyTimer = window.setInterval(() => {
    if (disposed || infoReady) return;
    try {
      iframe.contentWindow?.postMessage(
        { type: "urv-provider:info", id: `ping${++sequence}` },
        iframeOrigin,
      );
    } catch {
      // The iframe may not have finished loading yet.
    }
  }, 1_000);

  const onMessage = (event: MessageEvent<unknown>) => {
    if (event.source !== iframe.contentWindow || event.origin !== iframeOrigin)
      return;
    if (!event.data || typeof event.data !== "object") return;
    const data = event.data as Record<string, unknown>;
    if (
      data.type === "urv-provider:info-result" ||
      data.type === "urv-provider:models-result"
    ) {
      if (!infoReady) {
        infoReady = true;
        window.clearInterval(readyTimer);
        resolveReady();
      }
      return;
    }

    if (typeof data.id !== "string") return;
    const request = pending.get(data.id);
    if (!request) return;
    if (data.type === "urv-provider:chunk") {
      if (typeof data.delta === "string") request.onChunk?.(data.delta);
      return;
    }
    if (data.type === "urv-provider:done") {
      pending.delete(data.id);
      window.clearTimeout(request.timer);
      request.resolve(typeof data.text === "string" ? data.text : "");
      return;
    }
    if (data.type === "urv-provider:error") {
      pending.delete(data.id);
      window.clearTimeout(request.timer);
      request.reject(
        new Error(
          typeof data.error === "string" ? data.error : "URV provider error",
        ),
      );
    }
  };
  window.addEventListener("message", onMessage);

  return {
    async chat(messages, chatOptions = {}) {
      if (disposed) throw new Error("URV provider client has been disposed.");
      await ready;
      return new Promise<string>((resolve, reject) => {
        const id = `r${++sequence}_${crypto.randomUUID()}`;
        const timer = window.setTimeout(() => {
          pending.delete(id);
          reject(new Error("URV provider request timed out."));
        }, chatOptions.timeoutMs ?? timeoutMs);
        pending.set(id, {
          resolve,
          reject,
          onChunk: chatOptions.onChunk,
          timer,
        });
        try {
          iframe.contentWindow?.postMessage(
            {
              type: "urv-provider:request",
              id,
              messages,
              model: chatOptions.model ?? URV_MODEL_ID,
              stream: Boolean(chatOptions.onChunk),
              ...(chatOptions.apiKey ? { key: chatOptions.apiKey } : {}),
            },
            iframeOrigin,
          );
        } catch (error) {
          pending.delete(id);
          window.clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      window.clearInterval(readyTimer);
      window.removeEventListener("message", onMessage);
      iframe.remove();
      const error = new Error("URV provider client disposed.");
      for (const request of pending.values()) {
        window.clearTimeout(request.timer);
        request.reject(error);
      }
      pending.clear();
      if (!infoReady) rejectReady(error);
    },
  };
}
