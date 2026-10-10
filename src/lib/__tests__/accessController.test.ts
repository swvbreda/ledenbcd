import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAccessController,
  deriveAccess,
  singleFlight,
  IDLE_ACCESS,
  type AccessSnapshot,
  type AccessState,
} from "../accessController";
import { assertSyncSessionMatches } from "../syncStateScope";

const ADMIN: AccessSnapshot = { roles: ["admin"], memberIds: [7], isBoard: true };
const NONE: AccessSnapshot = { roles: [], memberIds: [], isBoard: false };

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function setup(load: (id: string) => Promise<AccessSnapshot>, timeoutMs = 20_000) {
  const states: AccessState[] = [];
  const c = createAccessController({ load, timeoutMs, onChange: (s) => states.push(s) });
  return { c, states, last: () => c.getState() };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("rechten laden: single-flight en generatiebewaking", () => {
  it("bootstrap + INITIAL_SESSION voor dezelfde gebruiker starten één controle", async () => {
    const d = deferred<AccessSnapshot>();
    const load = vi.fn(() => d.promise);
    const { c, last } = setup(load);
    const a = c.ensure("u1"); // getSession-bootstrap
    const b = c.ensure("u1"); // INITIAL_SESSION
    expect(load).toHaveBeenCalledTimes(1);
    d.resolve(ADMIN);
    await Promise.all([a, b]);
    expect(last()).toEqual({ status: "ready", userId: "u1", access: ADMIN });
    // TOKEN_REFRESHED daarna: geen nieuwe controle
    await c.ensure("u1");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("oude timeout wist geen rechten nadat een actuele controle geslaagd is", async () => {
    const d = deferred<AccessSnapshot>();
    const { c, last } = setup(() => d.promise, 20_000);
    const p = c.ensure("u1");
    vi.advanceTimersByTime(5_000);
    d.resolve(ADMIN);
    await p;
    vi.advanceTimersByTime(30_000); // timer van dezelfde poging mag niets meer doen
    expect(last()).toEqual({ status: "ready", userId: "u1", access: ADMIN });
  });

  it("timeout geeft fout zonder rechten; nieuwe poging herstelt; late oude uitkomst wordt genegeerd", async () => {
    const slow = deferred<AccessSnapshot>();
    const fast = deferred<AccessSnapshot>();
    const load = vi.fn().mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
    const { c, last } = setup(load, 20_000);
    void c.ensure("u1");
    vi.advanceTimersByTime(20_000);
    expect(last().status).toBe("error");
    expect(deriveAccess({ sessionPending: false, userId: "u1", access: last() }).isAdmin).toBe(false);

    const retry = c.ensure("u1"); // timed-out poging wordt niet hergebruikt
    expect(load).toHaveBeenCalledTimes(2);
    fast.resolve(ADMIN);
    await retry;
    expect(last()).toEqual({ status: "ready", userId: "u1", access: ADMIN });

    slow.resolve(NONE); // oude, trage controle mag de actuele niet overschrijven
    await vi.runAllTimersAsync();
    expect(last()).toEqual({ status: "ready", userId: "u1", access: ADMIN });
  });

  it("late ensure_member_link na timeout zonder nieuwere poging herstelt naar geverifieerde rechten", async () => {
    const d = deferred<AccessSnapshot>();
    const { c, last } = setup(() => d.promise, 20_000);
    const p = c.ensure("u1");
    vi.advanceTimersByTime(20_000);
    expect(last().status).toBe("error");
    d.resolve(ADMIN); // ledenkoppeling kwam alsnog binnen
    await p;
    expect(last()).toEqual({ status: "ready", userId: "u1", access: ADMIN });
  });

  it("oude fout overschrijft geen nieuwere geslaagde controle", async () => {
    const first = deferred<AccessSnapshot>();
    const second = deferred<AccessSnapshot>();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { c, last } = setup(load, 1_000);
    void c.ensure("u1");
    vi.advanceTimersByTime(1_000);
    const p2 = c.ensure("u1");
    second.resolve(ADMIN);
    await p2;
    first.reject(new Error("504"));
    await vi.runAllTimersAsync();
    expect(last()).toEqual({ status: "ready", userId: "u1", access: ADMIN });
  });

  it("na uitloggen of gebruikerswissel telt een late uitkomst niet", async () => {
    const a = deferred<AccessSnapshot>();
    const b = deferred<AccessSnapshot>();
    const load = vi.fn((id: string) => (id === "u1" ? a.promise : b.promise));
    const { c, last } = setup(load);
    void c.ensure("u1");
    void c.ensure("u2");
    a.resolve(ADMIN);
    await vi.advanceTimersByTimeAsync(0);
    expect(last()).toEqual({ status: "loading", userId: "u2" });
    b.resolve(NONE);
    await vi.advanceTimersByTimeAsync(0);
    expect(last()).toEqual({ status: "ready", userId: "u2", access: NONE });

    c.reset();
    expect(last()).toEqual(IDLE_ACCESS);
  });

  it("achtergrondcontrole die faalt laat geverifieerde rechten staan; geslaagde vervangt ze", async () => {
    const load = vi.fn()
      .mockResolvedValueOnce(ADMIN)
      .mockRejectedValueOnce(new Error("netwerk"))
      .mockResolvedValueOnce(NONE);
    const { c, last } = setup(load);
    await c.ensure("u1");
    await c.ensure("u1", { force: true });
    expect(last()).toEqual({ status: "ready", userId: "u1", access: ADMIN });
    await c.ensure("u1", { force: true });
    expect(last()).toEqual({ status: "ready", userId: "u1", access: NONE });
  });
});

describe("deriveAccess", () => {
  it("bekende gebruiker zonder geverifieerde rechten blijft laden en krijgt niets", () => {
    const r = deriveAccess({ sessionPending: false, userId: "u1", access: IDLE_ACCESS });
    expect(r).toMatchObject({ loading: true, isAdmin: false, isBoard: false, accessError: null });
  });
  it("rechten van een andere gebruiker tellen niet", () => {
    const r = deriveAccess({
      sessionPending: false,
      userId: "u2",
      access: { status: "ready", userId: "u1", access: ADMIN },
    });
    expect(r.isAdmin).toBe(false);
    expect(r.loading).toBe(true);
  });
  it("geverifieerde rechten van de huidige gebruiker gelden", () => {
    const r = deriveAccess({
      sessionPending: false,
      userId: "u1",
      access: { status: "ready", userId: "u1", access: ADMIN },
    });
    expect(r).toMatchObject({ loading: false, isAdmin: true, isBoard: true, linkedMemberIds: [7] });
  });
});

describe("singleFlight (refreshSession)", () => {
  it("gelijktijdige aanroepen gebruiken één refresh", async () => {
    const d = deferred<string>();
    const fn = vi.fn(() => d.promise);
    const once = singleFlight(fn);
    const a = once();
    const b = once();
    expect(fn).toHaveBeenCalledTimes(1);
    d.resolve("ok");
    expect(await a).toBe("ok");
    expect(await b).toBe("ok");
    void once();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("synclog alleen met sessie van dezelfde gebruiker", () => {
  it("anoniem of andere gebruiker gooit (geen stille lege log)", () => {
    expect(() => assertSyncSessionMatches(null, "u1")).toThrow();
    expect(() => assertSyncSessionMatches("u2", "u1")).toThrow();
    expect(() => assertSyncSessionMatches("u1", "u1")).not.toThrow();
  });
});
