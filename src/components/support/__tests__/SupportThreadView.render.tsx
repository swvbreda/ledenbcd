import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { rpc, from, createSignedUrl, sendWa } = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), createSignedUrl: vi.fn(), sendWa: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "admin-u" } }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc, from, storage: { from: () => ({ createSignedUrl, upload: vi.fn() }) } },
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => sendWa, createServerFn: () => ({}) }));
vi.mock("@/lib/supportWhatsApp.functions", () => ({ sendSupportWhatsAppReply: {} }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import SupportThreadView, { WA_TRANSPORT_UNKNOWN } from "@/components/support/SupportThreadView";

const chain = (data: unknown) => {
  const c: any = { select: () => c, eq: () => c, order: () => Promise.resolve({ data, error: null }), then: (r: any) => r({ data, error: null }) };
  return c;
};
const thread = (id: string) => ({
  id, subject: "s", status: "nieuw", channel: "whatsapp", admin_unread: false, last_activity_at: new Date().toISOString(),
  member_id: 1, link_active: true,
}) as any;
const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

beforeEach(() => {
  rpc.mockReset(); createSignedUrl.mockReset(); sendWa.mockReset();
  from.mockImplementation((t: string) => t === "support_attachments"
    ? chain([{ id: "a1", message_id: "m1", path: "t1/u/x.pdf", file_name: "brief.pdf", mime: "application/pdf", size: 1 }])
    : chain([{ id: "m1", thread_id: "t1", author_kind: "member", channel: "app", body: "hoi", sent_at: new Date().toISOString() }]));
});
afterEach(cleanup);

describe("SupportThreadView", () => {
  it("transport failure shows unknown status (not 'niets verstuurd') and retries with the same clientKey", async () => {
    sendWa.mockRejectedValue(new Error("network"));
    wrap(<SupportThreadView thread={thread("t1")} mode="admin" />);
    fireEvent.change(screen.getByLabelText("Antwoord"), { target: { value: "antwoord" } });
    fireEvent.click(screen.getByText("Verstuur als WhatsApp-bericht"));
    expect(await screen.findByRole("alert")).toHaveTextContent(WA_TRANSPORT_UNKNOWN);
    expect(screen.queryByText(/niets verstuurd/i)).toBeNull();
    expect((screen.getByLabelText("Antwoord") as HTMLTextAreaElement).value).toBe("antwoord");
    await waitFor(() => expect(screen.getByText("Verstuur als WhatsApp-bericht").closest("button")).not.toBeDisabled());
    fireEvent.click(screen.getByText("Verstuur als WhatsApp-bericht"));
    await waitFor(() => expect(sendWa).toHaveBeenCalledTimes(2));
    expect(sendWa.mock.calls[0][0].data.clientKey).toBe(sendWa.mock.calls[1][0].data.clientKey);
  });

  it("does not mint signed URLs on load; only on explicit click, and shows unavailable on denial", async () => {
    wrap(<SupportThreadView thread={thread("t1")} mode="member" />);
    const btn = await screen.findByText(/Bijlage ophalen: brief.pdf/);
    expect(createSignedUrl).not.toHaveBeenCalled();
    createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: "denied" } });
    fireEvent.click(btn);
    expect(await screen.findByText("Bijlage niet beschikbaar.")).toBeTruthy();
    createSignedUrl.mockResolvedValueOnce({ data: { signedUrl: "https://signed/x" }, error: null });
    fireEvent.click(screen.getByText(/Bijlage ophalen: brief.pdf/));
    const a = await screen.findByText(/Open brief.pdf/);
    expect(a.closest("a")?.getAttribute("href")).toBe("https://signed/x");
    expect(createSignedUrl).toHaveBeenLastCalledWith("t1/u/x.pdf", 60);
  });

  it("draft does not survive switching threads when keyed by thread id", async () => {
    const { rerender } = wrap(<SupportThreadView key="t1" thread={thread("t1")} mode="admin" />);
    fireEvent.change(screen.getByLabelText("Antwoord"), { target: { value: "geheim concept" } });
    rerender(<QueryClientProvider client={new QueryClient()}><SupportThreadView key="t2" thread={thread("t2")} mode="admin" /></QueryClientProvider>);
    expect((screen.getByLabelText("Antwoord") as HTMLTextAreaElement).value).toBe("");
  });
});
