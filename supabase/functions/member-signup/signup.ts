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

export class SignupFailure extends Error {
  constructor(
    readonly kind: "existing_account" | "weak_password" | "invalid_input" | "internal",
    message = kind,
  ) {
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

export async function registerAllowedMember(
  input: SignupRequest,
  dependencies: SignupDependencies,
): Promise<SignupResult> {
  const reference = dependencies.reference();
  const email = normalizeSignupEmail(input.email);

  if (!email || !input.password) {
    return { status: 400, body: { error: "E-mail en wachtwoord zijn verplicht" } };
  }
  if (input.password.length < 8) {
    return { status: 400, body: { error: "Wachtwoord moet minimaal 8 tekens zijn" } };
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
      body: { error: "Dit e-mailadres is niet geregistreerd als lid. Neem contact op met het bestuur." },
    };
  }

  let user: AuthUser;
  try {
    user = await dependencies.createUser({ email, password: input.password, memberId: allowed.memberId });
  } catch (error) {
    const failure = classifyAuthFailure(error);
    dependencies.log("auth_user_create_failed", reference, { kind: failure.kind, ...safeError(error) });
    if (failure.kind === "existing_account") {
      return { status: 409, body: { error: "Dit e-mailadres is al geregistreerd. Probeer in te loggen." } };
    }
    if (failure.kind === "weak_password" || failure.kind === "invalid_input") {
      return {
        status: 422,
        body: { error: "Dit wachtwoord voldoet niet aan de beveiligingseisen. Kies een langer, uniek wachtwoord." },
      };
    }
    return internalFailure(reference);
  }

  try {
    await dependencies.linkProfile(user.id, allowed.memberId);
    await dependencies.assignMemberRole(user.id);
  } catch (error) {
    dependencies.log("member_link_failed", reference, safeError(error));
    await rollbackNewAccount(user.id, reference, dependencies);
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

async function rollbackNewAccount(
  userId: string,
  reference: string,
  dependencies: SignupDependencies,
): Promise<void> {
  try {
    await dependencies.unlinkProfile(userId);
  } catch (error) {
    dependencies.log("profile_rollback_failed", reference, safeError(error));
  }
  try {
    await dependencies.deleteUser(userId);
  } catch (error) {
    dependencies.log("auth_user_rollback_failed", reference, safeError(error));
  }
}

function classifyAuthFailure(error: unknown): SignupFailure {
  if (error instanceof SignupFailure) return error;
  const candidate = error as { code?: unknown; message?: unknown; status?: unknown };
  const code = typeof candidate?.code === "string" ? candidate.code.toLowerCase() : "";
  const message = typeof candidate?.message === "string" ? candidate.message.toLowerCase() : "";
  if (code.includes("user_already_exists") || message.includes("already been registered") || message.includes("already exists")) {
    return new SignupFailure("existing_account");
  }
  if (code.includes("weak_password") || message.includes("password") || candidate?.status === 422) {
    return new SignupFailure("weak_password");
  }
  if (candidate?.status === 400) return new SignupFailure("invalid_input");
  return new SignupFailure("internal");
}

function safeError(error: unknown): Record<string, unknown> {
  const candidate = error as { code?: unknown; status?: unknown };
  return {
    code: typeof candidate?.code === "string" ? candidate.code : "unknown",
    status: typeof candidate?.status === "number" ? candidate.status : undefined,
  };
}