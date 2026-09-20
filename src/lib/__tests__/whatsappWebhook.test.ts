import { describe, expect, it } from "vitest";
import {
  maskWaId,
  parseIncomingMessages,
  previewFor,
  verifyChallenge,
  verifySignature,
} from "../whatsappWebhook";

const APP_SECRET = "test-app-secret";

async function sign(body: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return `sha256=${Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

function payload(message: Record<string, unknown>) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [{ wa_id: "31612345678", profile: { name: "Simone" } }],
              messages: [message],
            },
          },
        ],
      },
    ],
  };
}

describe("verifyChallenge", () => {
  const token = "verify-token";

  it("accepteert een geldige handshake", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": token,
      "hub.challenge": "12345",
    });
    expect(verifyChallenge(params, token)).toEqual({
      ok: true,
      challenge: "12345",
    });
  });

  it("weigert een verkeerd token", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "fout",
      "hub.challenge": "12345",
    });
    expect(verifyChallenge(params, token).ok).toBe(false);
  });

  it("weigert wanneer het secret ontbreekt", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": token,
      "hub.challenge": "12345",
    });
    expect(verifyChallenge(params, undefined).ok).toBe(false);
  });
});

describe("verifySignature", () => {
  const body = JSON.stringify({ hello: "world" });

  it("accepteert een correcte handtekening", async () => {
    const header = await sign(body, APP_SECRET);
    await expect(verifySignature(body, header, APP_SECRET)).resolves.toBe(true);
  });

  it("weigert een handtekening van een ander secret", async () => {
    const header = await sign(body, "ander-secret");
    await expect(verifySignature(body, header, APP_SECRET)).resolves.toBe(
      false,
    );
  });

  it("faalt gesloten zonder handtekening of zonder secret", async () => {
    await expect(verifySignature(body, null, APP_SECRET)).resolves.toBe(false);
    await expect(
      verifySignature(body, await sign(body, APP_SECRET), undefined),
    ).resolves.toBe(false);
    await expect(verifySignature(body, "sha256=xyz", APP_SECRET)).resolves.toBe(
      false,
    );
  });

  it("weigert een gewijzigde body", async () => {
    const header = await sign(body, APP_SECRET);
    await expect(
      verifySignature(
        JSON.stringify({ hello: "aangepast" }),
        header,
        APP_SECRET,
      ),
    ).resolves.toBe(false);
  });
});

describe("parseIncomingMessages", () => {
  it("leest een tekstbericht met profielnaam", () => {
    const [message] = parseIncomingMessages(
      payload({
        id: "wamid.1",
        from: "31612345678",
        type: "text",
        timestamp: "1750000000",
        text: { body: "Hallo BCD" },
      }),
    );
    expect(message).toMatchObject({
      waMessageId: "wamid.1",
      waId: "31612345678",
      profileName: "Simone",
      messageType: "text",
      body: "Hallo BCD",
    });
    expect(message?.sentAt).toBe(new Date(1750000000 * 1000).toISOString());
  });

  it("leest caption, media-id en mimetype van een afbeelding", () => {
    const [message] = parseIncomingMessages(
      payload({
        id: "wamid.2",
        from: "31612345678",
        type: "image",
        timestamp: "1750000100",
        image: {
          id: "media-1",
          mime_type: "image/jpeg",
          caption: "Foto gevel",
        },
      }),
    );
    expect(message).toMatchObject({
      messageType: "image",
      body: "Foto gevel",
      mediaId: "media-1",
      mediaMimeType: "image/jpeg",
    });
  });

  it("houdt een onbekend type herkenbaar zonder te crashen", () => {
    const [message] = parseIncomingMessages(
      payload({ id: "wamid.3", from: "31612345678", type: "location" }),
    );
    expect(message?.messageType).toBe("location");
    expect(message?.body).toBeNull();
    expect(previewFor(message!)).toBe("(location)");
  });

  it("negeert payloads zonder berichten en onvolledige regels", () => {
    expect(parseIncomingMessages({})).toEqual([]);
    expect(
      parseIncomingMessages({
        entry: [{ changes: [{ value: { statuses: [] } }] }],
      }),
    ).toEqual([]);
    expect(
      parseIncomingMessages(payload({ type: "text", text: { body: "x" } })),
    ).toEqual([]);
  });

  it("levert stabiele bericht-ids zodat retries idempotent zijn", () => {
    const body = payload({
      id: "wamid.4",
      from: "31612345678",
      type: "text",
      text: { body: "Herhaling" },
    });
    const first = parseIncomingMessages(body);
    const second = parseIncomingMessages(body);
    expect(first[0]?.waMessageId).toBe(second[0]?.waMessageId);
    expect(new Set([...first, ...second].map((m) => m.waMessageId)).size).toBe(
      1,
    );
  });
});

describe("maskWaId", () => {
  it("toont alleen de laatste vier cijfers", () => {
    expect(maskWaId("31612345678")).toBe("••••5678");
    expect(maskWaId("12")).toBe("••••");
  });
});

describe("interactive replies", () => {
  it("leest een knopantwoord", () => {
    const [message] = parseIncomingMessages(
      payload({
        id: "wamid.5",
        from: "31612345678",
        type: "interactive",
        interactive: {
          type: "button_reply",
          button_reply: { id: "ja", title: "Ja, ik kom" },
        },
      }),
    );
    expect(message).toMatchObject({
      messageType: "interactive",
      body: "Ja, ik kom",
    });
  });

  it("leest een lijstantwoord met omschrijving als titel ontbreekt", () => {
    const [message] = parseIncomingMessages(
      payload({
        id: "wamid.6",
        from: "31612345678",
        type: "interactive",
        interactive: {
          type: "list_reply",
          list_reply: { id: "a", description: "Optie A" },
        },
      }),
    );
    expect(message?.body).toBe("Optie A");
  });

  it("valt terug op de id wanneer er geen tekst is", () => {
    const [message] = parseIncomingMessages(
      payload({
        id: "wamid.7",
        from: "31612345678",
        type: "interactive",
        interactive: { type: "button_reply", button_reply: { id: "keuze-1" } },
      }),
    );
    expect(message?.body).toBe("keuze-1");
  });
});

describe("previewFor", () => {
  it("kort een lange tekst in tot een veilige preview", () => {
    const [message] = parseIncomingMessages(
      payload({
        id: "wamid.8",
        from: "31612345678",
        type: "text",
        text: { body: "a".repeat(500) },
      }),
    );
    expect(previewFor(message!).length).toBe(140);
  });
});
