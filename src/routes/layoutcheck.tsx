import { createFileRoute } from "@tanstack/react-router";
import BcdHeroBanner from "@/components/BcdHeroBanner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/layoutcheck")({
  component: LayoutCheck,
});

function LayoutCheck() {
  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden p-4 sm:p-6">
      <BcdHeroBanner title="Financieel Beheer" subtitle="Begroting, contributie, declaraties en uitgaven beheren" />
      <Tabs defaultValue="dashboard" className="min-w-0 space-y-1">
        <TabsList className="grid h-auto w-full max-w-full grid-cols-2 gap-1 bg-muted/60 p-1 sm:grid-cols-4 lg:grid-cols-7">
          {["Dashboard", "Declaraties", "Contributie", "Inkomsten / Uitgaven", "Dossiers", "To Do", "Controle & sync"].map((t) => (
            <TabsTrigger key={t} value={t} className="h-auto min-w-0 whitespace-normal break-words px-2 py-2 text-center leading-tight">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
