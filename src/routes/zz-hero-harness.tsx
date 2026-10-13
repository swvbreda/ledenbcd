import { createFileRoute } from "@tanstack/react-router";
import BcdHeroBanner from "@/components/BcdHeroBanner";
import { Sidebar, SidebarContent, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
const T = ["Projecten & taken","Ledenvoordelen","Relevante producten, diensten en kortingen voor coffeeshopondernemers","Bestuursvergaderingen en evenementen","Contributie-administratie per lid per jaar — € 3.000","Begroting, contributie, declaraties en uitgaven beheren","Accountbeheer","Goedkeuringen","Welkom bij het BCD Dashboard","Mijn Account","WhatsApp-community beheer"];
function State(){ const s=useSidebar(); return <div id="sb" data-mobile={String(s.isMobile)} data-open={String(s.openMobile)} />; }
export const Route = createFileRoute("/zz-hero-harness")({ component: () => (
  <div className="flex w-full min-w-0"><Sidebar><SidebarContent>menu</SidebarContent></Sidebar>
  <div className="flex-1 min-w-0"><SidebarTrigger id="trig" /><State />
  <div className="p-4 sm:p-6 space-y-6">{T.map(t=><div className="hero" key={t}><BcdHeroBanner title={t} /></div>)}</div></div></div>) });
