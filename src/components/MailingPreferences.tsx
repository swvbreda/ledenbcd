import { useState, useEffect } from "react";
import { Mail } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Member } from "@/data/types";

interface Props {
  member: Member;
  canEdit: boolean;
}

export default function MailingPreferences({ member, canEdit }: Props) {
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Collect all unique emails from the member
  const allEmails = Array.from(
    new Set([
      member.email,
      ...(member.contacten || []).map((c) => c.email).filter(Boolean),
      member.factuurEmail,
      member.email2,
    ].filter(Boolean) as string[])
  );

  useEffect(() => {
    const fetchPrefs = async () => {
      const { data, error } = await supabase
        .from("member_mailing_preferences")
        .select("email")
        .eq("member_id", member.id);
      if (!error && data) {
        setSelectedEmails(new Set(data.map((r) => r.email)));
      }
      setLoading(false);
    };
    fetchPrefs();
  }, [member.id]);

  const toggleEmail = async (email: string) => {
    if (!canEdit) return;

    const isSelected = selectedEmails.has(email);
    const newSet = new Set(selectedEmails);

    if (isSelected) {
      // Remove
      const { error } = await supabase
        .from("member_mailing_preferences")
        .delete()
        .eq("member_id", member.id)
        .eq("email", email);
      if (error) {
        toast.error("Fout bij opslaan: " + error.message);
        return;
      }
      newSet.delete(email);
      // If this was the last selected email, insert a sentinel row so the
      // export knows this member is explicitly opted out (rather than never
      // configured). getUniqueEmails filters empty strings out of the export.
      if (newSet.size === 0) {
        const { error: sentinelError } = await supabase
          .from("member_mailing_preferences")
          .insert({ member_id: member.id, email: "" });
        if (sentinelError && sentinelError.code !== "23505") {
          toast.error("Fout bij opslaan: " + sentinelError.message);
        }
      }
    } else {
      // Remove any opt-out sentinel before adding a real address.
      await supabase
        .from("member_mailing_preferences")
        .delete()
        .eq("member_id", member.id)
        .eq("email", "");
      // Add
      const { error } = await supabase
        .from("member_mailing_preferences")
        .insert({ member_id: member.id, email });
      if (error) {
        toast.error("Fout bij opslaan: " + error.message);
        return;
      }
      newSet.add(email);
    }

    setSelectedEmails(newSet);
  };

  if (allEmails.length === 0) return null;

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <Mail size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold font-display">Mailingvoorkeuren</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Selecteer op welke e-mailadressen de mailing ontvangen mag worden.
      </p>
      {loading ? (
        <p className="text-xs text-muted-foreground">Laden...</p>
      ) : (
        <div className="space-y-2">
          {allEmails.map((email) => (
            <label
              key={email}
              className={`flex items-center gap-2.5 py-1.5 px-2 rounded-md transition-colors ${
                canEdit ? "cursor-pointer hover:bg-muted/50" : "cursor-default"
              }`}
            >
              <Checkbox
                checked={selectedEmails.has(email)}
                onCheckedChange={() => toggleEmail(email)}
                disabled={!canEdit}
              />
              <span className="text-sm">{email}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
