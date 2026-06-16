import BcdHeroBanner from "@/components/BcdHeroBanner";
import { useState } from "react";
import { Search, ListChecks, List } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import WhatsAppMatcher from "@/components/WhatsAppMatcher";
import CommunityDeelnemersLijst from "@/components/CommunityDeelnemersLijst";
import CommunityTodoList from "@/components/CommunityTodoList";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

type CommunitySubTab = "lijst" | "matcher" | "todo";

const CommunityPage = () => {
  const { isAdmin, isBoard } = useAuth();
  const [sub, setSub] = useState<CommunitySubTab>("lijst");

  if (!isAdmin && !isBoard) {
    return <Navigate to="/leden" replace />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 overflow-hidden">
      <BcdHeroBanner title="Community" subtitle="WhatsApp-community beheer" />
      <Tabs value={sub} onValueChange={(v) => setSub(v as CommunitySubTab)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="lijst" className="gap-1.5">
            <List size={14} /> Deelnemerslijst
          </TabsTrigger>
          <TabsTrigger value="matcher" className="gap-1.5">
            <Search size={14} /> Matcher
          </TabsTrigger>
          <TabsTrigger value="todo" className="gap-1.5">
            <ListChecks size={14} /> Te doen
          </TabsTrigger>
        </TabsList>
        <TabsContent value="lijst">
          <CommunityDeelnemersLijst />
        </TabsContent>
        <TabsContent value="matcher">
          <WhatsAppMatcher />
        </TabsContent>
        <TabsContent value="todo">
          <CommunityTodoList />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CommunityPage;