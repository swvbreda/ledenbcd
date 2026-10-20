import { describe, expect, it, vi } from "vitest";
import { processAttachment, readLimited, MAX_MEDIA_BYTES } from "../whatsappMedia";

function deps(responses: Response[]) {
  const queue = [...responses];
  return {
    fetch: vi.fn(async () => queue.shift()!) as unknown as typeof fetch,
    headers: { Authorization: "Bearer x", "X-Connection-Api-Key": "y" },
    upload: vi.fn(async () => {}),
    complete: vi.fn(async () => {}),
    fail: vi.fn(async () => {}),
  };
}
const meta = (size: number) => new Response(JSON.stringify({ url: "https://lookaside.example/x", file_size: size }));

describe("processAttachment", () => {
  it("publishes a complete pdf exactly once after upload", async () => {
    const d = deps([meta(4), new Response(new Uint8Array([1, 2, 3, 4]))]);
    await processAttachment({ wa_message_id: "wamid.1", media_id: "123", media_mime: "application/pdf" }, d);
    expect(d.upload).toHaveBeenCalledTimes(1);
    expect(d.complete).toHaveBeenCalledTimes(1);
    expect((d.complete.mock.calls[0] as unknown[])[3]).toBe(4);
    expect(d.fail).not.toHaveBeenCalled();
  });

  it("never publishes files above 20 MB", async () => {
    const d = deps([meta(MAX_MEDIA_BYTES + 1)]);
    await processAttachment({ wa_message_id: "wamid.2", media_id: "123", media_mime: "image/png" }, d);
    expect(d.complete).not.toHaveBeenCalled();
    expect(d.fail).toHaveBeenCalledWith("wamid.2", "too_large", true);
  });

  it("keeps failed downloads retryable and unpublished", async () => {
    const d = deps([meta(10), new Response("no", { status: 502 })]);
    await processAttachment({ wa_message_id: "wamid.3", media_id: "123", media_mime: "image/jpeg" }, d);
    expect(d.complete).not.toHaveBeenCalled();
    expect(d.fail).toHaveBeenCalledWith("wamid.3", "download_502", false);
  });

  it("rejects unsupported types without fetching", async () => {
    const d = deps([]);
    await processAttachment({ wa_message_id: "wamid.4", media_id: "123", media_mime: "video/mp4" }, d);
    expect(d.fetch).not.toHaveBeenCalled();
    expect(d.fail).toHaveBeenCalledWith("wamid.4", "unsupported_media", true);
  });

  it("aborts streams that exceed the limit", async () => {
    await expect(readLimited(new Response(new Uint8Array(11)).body, 10)).rejects.toThrow("too_large");
  });
});
