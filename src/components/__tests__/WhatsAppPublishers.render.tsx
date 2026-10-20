import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WhatsAppPublishers from "../WhatsAppPublishers";

const mocks = vi.hoisted(() => ({ admin: true, rows: [] as { phone: string; enabled: boolean }[], save: vi.fn(), select: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "viewer" }, isAdmin: mocks.admin }) }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => mocks.save }));
vi.mock("@/lib/whatsappPublishers.functions", () => ({ saveWhatsAppPublisher: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: mocks.select }) } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const show = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><WhatsAppPublishers /></QueryClientProvider>);
beforeEach(() => { cleanup(); mocks.admin = true; mocks.rows = []; mocks.save.mockReset().mockResolvedValue(undefined); mocks.select.mockReset().mockImplementation(() => ({ order: async () => ({ data: mocks.rows, error: null }) })); });
describe("publisher management authorization", () => {
  it("non-admin never loads publishers or offers management", async () => {
    mocks.admin = false;
    show();
    await waitFor(() => expect(mocks.select).not.toHaveBeenCalled());
    expect(screen.queryByRole("form")).toBeNull();
    expect(screen.queryByRole("button", { name: "Toestaan" })).toBeNull();
  });
  it("empty default does not silently authorize anyone", async () => {
    show();
    await screen.findByText(/Geen afzenders toegestaan/);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("adds only the number explicitly submitted by the admin", async () => {
    show();
    await screen.findByText(/Geen afzenders toegestaan/);
    fireEvent.change(screen.getByRole("textbox", { name: "Internationaal telefoonnummer" }), { target: { value: "+31999999999" } });
    fireEvent.click(screen.getByRole("button", { name: "Toestaan" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ data: { phone: "+31999999999", enabled: true } }));
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
});