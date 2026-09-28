export interface SignupRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
}

export interface SignupDependencies {
  findAllowedMember(normalizedEmail: string): Promise<{ memberId: number } | null>;
  createUser(input: { email: string; password: string; memberId: number }): Promise<AuthUser>;
  linkProfile(userId: string, memberId: number): Promise<void>;
  assignMemberRole(userId: string): Promise<void>;
  unlinkProfile(userId: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  log(event: string, reference: string, details?: Record<string, unknown>): void;
  reference(): string;
}

export type AuthFailureKind =
  | "existing_account"
  | "weak_password"
  | "invalid_email"
  | "validation_failed"
  | "rate_limited"
  | "unknown";

export class SignupFailure extends Error {
  constructor(readonly kind: AuthFailureKind | "internal", message: string = kind) {
    super(message);
  }
}

export interface SignupResult {
  status: number;
  body: { success?: true; error?: string; reference?: string };
}

export function normalizeSignupEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** Validates untrusted parsed JSON before any auth or database call. */
export function parseSignupInput(raw: unknown): SignupRequest | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const { email, password } = raw as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") return null;
  return { email, password };
}

export function invalidRequest(reference: string): SignupResult {
  return {
    status: 400,
    body: { error: `Ongeldig registratieverzoek (referentie ${reference}).`, reference },
  };
}

export async function registerAllowedMember(
  raw: unknown,
  dependencies: SignupDependencies,
): Promise<SignupResult> {
  const reference = dependencies.reference();
  const input = parseSignupInput(raw);
  if (!input) {
    dependencies.log("invalid_signup_request", reference);
    return invalidRequest(reference);
  }
  const email = normalizeSignupEmail(input.email);

  if (!email || !input.password) {
    return { status: 400, body: { error: `E-mail en wachtwoord zijn verplicht (referentie ${reference}).`, reference } };
  }
  if (input.password.length < 8) {
    return { status: 400, body: { error: `Wachtwoord moet minimaal 8 tekens zijn (referentie ${reference}).`, reference } };
  }

  let allowed: { memberId: number } | null;
  try {
    allowed = await dependencies.findAllowedMember(email);
  } catch (error) {
    dependencies.log("allowed_member_lookup_failed", reference, safeError(error));
    return internalFailure(reference);
  }

  if (!allowed) {
    return {
      status: 403,
      body: {
        error: `Dit e-mailadres is niet geregistreerd als lid. Neem contact op met het bestuur (referentie ${reference}).`,
        reference,
      },
    };
  }

  let user: AuthUser;
  try {
    user = await dependencies.createUser({ email, password: input.password, memberId: allowed.memberId });
  } catch (error) {
    const kind = classifyAuthFailure(error);
    dependencies.log("auth_user_create_failed", reference, { kind, ...safeError(error) });
    const known: Partial<Record<AuthFailureKind, [number, string]>> = {
      existing_account: [409, "Dit e-mailadres is al geregistreerd. Probeer in te loggen."],
      weak_password: [422, "Dit wachtwoord voldoet niet aan de beveiligingseisen. Kies een ander wachtwoord."],
      invalid_email: [400, "Dit e-mailadres wordt niet geaccepteerd."],
      validation_failed: [400, "De registratiegegevens zijn niet geldig."],
      rate_limited: [429, "Te veel pogingen. Probeer het over enkele minuten opnieuw."],
    };
    const hit = known[kind];
    if (hit) {
      return { status: hit[0], body: { error: `${hit[1]} (referentie ${reference})`, reference } };
    }
    return internalFailure(reference);
  }

  try {
    await dependencies.linkProfile(user.id, allowed.memberId);
    await dependencies.assignMemberRole(user.id);
  } catch (error) {
    dependencies.log("member_link_failed", reference, safeError(error));
    await compensateNewAccount(user.id, reference, dependencies);
    return internalFailure(reference);
  }

  return { status: 200, body: { success: true } };
}

function internalFailure(reference: string): SignupResult {
  return {
    status: 500,
    body: {
      error: `Registratie kon niet veilig worden afgerond. Neem contact op met het bestuur en vermeld ${reference}.`,
      reference,
    },
  };
}

/** Best-effort compensation (not atomic): only ever touches the user id created in this request. */
async function compensateNewAccount(
  userId: string,
  reference: string,
  dependencies: SignupDependencies,
): Promise<void> {
  try {
    await dependencies.unlinkProfile(userId);
  } catch (error) {
    dependencies.log("profile_compensation_failed", reference, safeError(error));
  }
  try {
    await dependencies.deleteUser(userId);
  } catch (error) {
    dependencies.log("auth_user_compensation_failed", reference, safeError(error));
  }
}

const CODE_MAP: Record<string, AuthFailureKind> = {
  email_exists: "existing_account",
  user_already_exists: "existing_account",
  weak_password: "weak_password",
  email_address_invalid: "invalid_email",
  validation_failed: "validation_failed",
  over_request_rate_limit: "rate_limited",
  over_email_send_rate_limit: "rate_limited",
};

export function classifyAuthFailure(error: unknown): AuthFailureKind {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  const code = typeof candidate?.code === "string" ? candidate.code.toLowerCase() : "";
  if (code && CODE_MAP[code]) return CODE_MAP[code];
  const message = typeof candidate?.message === "string" ? candidate.message.toLowerCase() : "";
  // Narrow legacy messages from older auth servers that lacked error codes.
  if (message === "a user with this email address has already been registered") return "existing_account";
  if (message.startsWith("password should be at least")) return "weak_password";
  return "unknown";
}

function safeError(error: unknown): Record<string, unknown> {
  const candidate = error as { code?: unknown; status?: unknown } | null;
  return {
    code: typeof candidate?.code === "string" ? candidate.code : "unknown",
    status: typeof candidate?.status === "number" ? candidate.status : undefined,
  };
}
