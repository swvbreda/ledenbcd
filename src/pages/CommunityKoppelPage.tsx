import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2 } from "lucide-react";

const schema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, { message: "Vul je naam in" })
    .max(100, { message: "Naam is te lang" }),
  phone: z
    .string()
    .trim()
    .min(8, { message: "Vul een geldig telefoonnummer in" })
    .max(30, { message: "Telefoonnummer is te lang" })
    .regex(/^[0-9+()\-.\s]+$/, { message: "Alleen cijfers en + - ( ) zijn toegestaan" }),
  whatsapp_name: z.string().trim().max(100).optional().or(z.literal("")),
  coffeeshop_name: z
    .string()
    .trim()
    .min(2, { message: "Vul de naam van je coffeeshop in" })
    .max(120, { message: "Naam is te lang" }),
  city: z.string().trim().min(2, { message: "Vul de plaats in" }).max(80),
  email: z
    .string()
    .trim()
    .email({ message: "Vul een geldig e-mailadres in" })
    .max(255)
    .optional()
    .or(z.literal("")),
  note: z.string().trim().max(500, { message: "Maximaal 500 tekens" }).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

const empty: FormValues = {
  full_name: "",
  phone: "",
  whatsapp_name: "",
  coffeeshop_name: "",
  city: "",
  email: "",
  note: "",
};

const CommunityKoppelPage = () => {
  const [values, setValues] = useState<FormValues>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const set = (key: keyof FormValues) => (v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof FormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormValues;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const v = parsed.data;
    const { error } = await supabase.from("community_self_links").insert({
      full_name: v.full_name,
      phone: v.phone,
      whatsapp_name: v.whatsapp_name || null,
      coffeeshop_name: v.coffeeshop_name,
      city: v.city,
      email: v.email || null,
      note: v.note || null,
      status: "nieuw",
    });
    setSubmitting(false);
    if (error) {
      setServerError("Versturen is niet gelukt. Probeer het later opnieuw.");
      return;
    }
    setDone(true);
    setValues(empty);
  };

  return (
    <main className="min-h-screen bg-background flex items-start sm:items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg bg-card rounded-xl border-2 border-primary/50 p-5 sm:p-7 space-y-5">
        <header className="space-y-1">
          <h1 className="text-2xl font-display uppercase text-primary">Koppel je gegevens</h1>
          <p className="text-sm text-muted-foreground">
            Je zit in de WhatsApp-community van de Bond van Cannabis Detaillisten. Vul hieronder je
            gegevens in, dan koppelen wij je nummer aan de juiste coffeeshop.
          </p>
        </header>

        {done ? (
          <div className="flex items-start gap-3 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4">
            <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={20} />
            <div className="text-sm">
              <p className="font-semibold">Bedankt, we hebben je gegevens ontvangen.</p>
              <p className="text-muted-foreground">
                Het bestuur controleert de koppeling. Je hoeft verder niets te doen.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setDone(false)}
              >
                Nog iemand aanmelden
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field
              id="full_name"
              label="Je naam"
              value={values.full_name}
              onChange={set("full_name")}
              error={errors.full_name}
              autoComplete="name"
            />
            <Field
              id="phone"
              label="Telefoonnummer (zoals in WhatsApp)"
              value={values.phone}
              onChange={set("phone")}
              error={errors.phone}
              type="tel"
              autoComplete="tel"
              placeholder="06 12 34 56 78"
            />
            <Field
              id="whatsapp_name"
              label="Weergavenaam in WhatsApp (optioneel)"
              value={values.whatsapp_name ?? ""}
              onChange={set("whatsapp_name")}
              error={errors.whatsapp_name}
            />
            <Field
              id="coffeeshop_name"
              label="Coffeeshop"
              value={values.coffeeshop_name}
              onChange={set("coffeeshop_name")}
              error={errors.coffeeshop_name}
            />
            <Field
              id="city"
              label="Plaats"
              value={values.city}
              onChange={set("city")}
              error={errors.city}
            />
            <Field
              id="email"
              label="E-mailadres (optioneel)"
              value={values.email ?? ""}
              onChange={set("email")}
              error={errors.email}
              type="email"
              autoComplete="email"
            />
            <div className="space-y-1.5">
              <Label htmlFor="note">Opmerking (optioneel)</Label>
              <Textarea
                id="note"
                value={values.note ?? ""}
                maxLength={500}
                onChange={(e) => set("note")(e.target.value)}
                placeholder="Bijvoorbeeld: ik sta in de groep met een ander nummer"
              />
              {errors.note && <p className="text-xs text-destructive">{errors.note}</p>}
            </div>

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Versturen…" : "Versturen"}
            </Button>
            <p className="text-xs text-muted-foreground">
              We gebruiken deze gegevens alleen om je deelname in de community aan het juiste
              lidmaatschap te koppelen.
            </p>
          </form>
        )}
      </div>
    </main>
  );
};

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}

function Field({ id, label, value, onChange, error, type = "text", autoComplete, placeholder }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default CommunityKoppelPage;
