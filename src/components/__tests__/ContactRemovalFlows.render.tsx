import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import type { Member, Contact } from "@/data/types";
import MemberEditForm from "../MemberEditForm";
import { useApproveEditRequest, useSaveMemberEdit, type EditRequest } from "@/hooks/useMemberEdits";
import { ProfileCard } from "@/pages/MijnAccountPage";

const mocks = vi.hoisted(() => ({ admin:true, remove:vi.fn(), invite:vi.fn(), upsert:vi.fn(), insert:vi.fn(), update:vi.fn(), base:{} as Record<string, unknown>, overlay:{} as Record<string, unknown> }));
vi.mock("@/hooks/useAuth", () => ({ useAuth:()=>({isAdmin:mocks.admin,user:{id:"viewer",email:"viewer@example.test"}}) }));
vi.mock("@tanstack/react-start", () => ({useServerFn:()=>mocks.remove}));
vi.mock("@/lib/contactRemoval.functions",()=>({removeMemberContacts:vi.fn()}));
vi.mock("@/lib/contactInvites",()=>({newContactEmails:(p:Partial<Member>,n:Partial<Member>) => (n.contacten??[]).filter(c=>!(p.contacten??[]).some(o=>o.email===c.email)).map(c=>c.email),sendContactInvites:(...args:unknown[])=>mocks.invite(...args)}));
vi.mock("@/contexts/MembersDataContext",()=>({useMembersData:()=>({allMembersAndLeads:[],rawLeads:[],rawOldMembers:[]})}));
vi.mock("@/hooks/useLeadConversions",()=>({useLeadConversions:()=>({conversions:[],loading:false})}));
vi.mock("@/hooks/useMemberMedia",()=>({useContactPhotos:()=>({photos:{},uploadPhoto:vi.fn(),removePhoto:vi.fn()}),contactSlug:()=>"contact"}));
vi.mock("@/hooks/useBiometricAuth",()=>({useBiometricAuth:()=>({})}));
vi.mock("@/hooks/usePasskeys",()=>({usePasskeys:()=>({})}));
vi.mock("@/hooks/usePushNotifications",()=>({usePushNotifications:()=>({})}));
vi.mock("@/components/members/MediaUpload",()=>({default:()=>null}));
vi.mock("@/components/ContributiePaymentCard",()=>({ContributiePaymentCard:()=>null}));
vi.mock("@/components/MailingPreferences",()=>({default:()=>null}));
vi.mock("@/components/ExternToestemmingBeheer",()=>({default:()=>null}));
vi.mock("sonner",()=>({toast:{success:vi.fn(),error:vi.fn(),warning:vi.fn()}}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{
 auth:{getSession:async()=>({data:{session:{user:{id:"viewer"}}}})},
 functions:{invoke:vi.fn().mockResolvedValue({error:null})},
 from:(table:string)=>({
  select:()=>({eq:()=>({maybeSingle:async()=>({data:{data:table==="members_data"?mocks.base:mocks.overlay},error:null})})}),
  upsert:(...args:unknown[])=>mocks.upsert(...args),insert:(...args:unknown[])=>mocks.insert(...args),
  update:(...args:unknown[])=>({eq:async()=>mocks.update(...args)}),
 }),
}}));

const a:Contact={naam:"Alex",email:"a@example.test",functie:"",telefoon:""};
const b:Contact={naam:"Bob",email:"b@example.test",functie:"",telefoon:""};
const c:Contact={naam:"New",email:"new@example.test",functie:"",telefoon:""};
const member:Member={id:1,naam:"Shop",plaats:"Amsterdam",bedrijfsnaam:"Shop",stadsdeel:"",contactpersoon:"Alex",email:a.email,telefoon:"",functie:"",contacten:[a,b],locaties:[],aantalLocaties:0,jarenLid:null,oprichtingJaar:null};
function wrapper({children}:PropsWithChildren){return <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}>{children}</QueryClientProvider>;}
beforeEach(()=>{mocks.admin=true;mocks.base=member as unknown as Record<string,unknown>;mocks.overlay={contacten:[a,b]};mocks.remove.mockReset().mockResolvedValue({removed:true,accounts:1});mocks.invite.mockReset().mockResolvedValue([]);mocks.upsert.mockReset().mockResolvedValue({error:null});mocks.insert.mockReset().mockResolvedValue({error:null});mocks.update.mockReset().mockResolvedValue({error:null});vi.spyOn(window,"confirm").mockReturnValue(true);});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe("real form and mutation removal flows",()=>{
 it("MemberEditForm removal survives hook merge before server detection",async()=>{
  render(<MemberEditForm member={member} editing setEditing={vi.fn()}/>,{wrapper});
  fireEvent.click(screen.getAllByRole("button").find(button=>button.querySelector("svg.lucide-trash2")) as HTMLElement);
  fireEvent.click(screen.getAllByRole("button",{name:"Opslaan"})[0]);
  await waitFor(()=>expect(mocks.remove).toHaveBeenCalledTimes(2));
  expect(mocks.remove.mock.calls[0][0].data.patch.contacten).toEqual([b]);
  expect(mocks.remove.mock.calls[1][0].data.patch.contacten).toEqual([b]);
 });
 it.each([false,true])("save preserves replacement and empty arrays (empty=%s)",async(empty)=>{
  const {result}=renderHook(()=>useSaveMemberEdit(),{wrapper});
  const contacten=empty?[]:[b,c];
  await result.current.mutateAsync({member_id:1,data:{contacten}});
  expect(mocks.remove.mock.calls[0][0].data.patch.contacten).toEqual(contacten);
  if(!empty) expect(mocks.invite).toHaveBeenCalledWith(1,expect.objectContaining({contacten:[b,c]}),[c.email],"member");
  else expect(mocks.invite).not.toHaveBeenCalled();
  expect(mocks.upsert).not.toHaveBeenCalled();
 });
 it("approval invites only added contact after successful removal",async()=>{
  const {result}=renderHook(()=>useApproveEditRequest(),{wrapper});
  await result.current.mutateAsync({request:{id:"req",member_id:1,data:{contacten:[b,c]}} as EditRequest});
  expect(mocks.remove.mock.calls[0][0].data.patch.contacten).toEqual([b,c]);
  expect(mocks.invite).toHaveBeenCalledWith(1,expect.objectContaining({contacten:[b,c]}),[c.email],"member");
  expect(mocks.remove.mock.invocationCallOrder[1]).toBeLessThan(mocks.invite.mock.invocationCallOrder[0]);
 });
 it("failed deletion never invites the newly added contact",async()=>{
  mocks.remove.mockResolvedValueOnce({removed:true,accounts:1}).mockRejectedValueOnce(new Error("delete failed"));
  const {result}=renderHook(()=>useSaveMemberEdit(),{wrapper});
  await expect(result.current.mutateAsync({member_id:1,data:{contacten:[b,c]}})).rejects.toThrow("delete failed");
  expect(mocks.invite).not.toHaveBeenCalled();
 });
 it("ordinary ProfileCard updates submit without calling admin removal",async()=>{
  mocks.admin=false;
  render(<ProfileCard linkedMember={member}/>,{wrapper});
  fireEvent.click(screen.getByRole("button",{name:/Bewerken/}));
  const inputs=screen.getAllByRole("textbox");
  fireEvent.change(inputs[0],{target:{value:"Alex Updated"}});
  fireEvent.click(screen.getByRole("button",{name:"Opslaan"}));
  await waitFor(()=>expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({member_id:1,data:{contactpersoon:"Alex Updated"},submitted_by:"viewer"})));
  expect(mocks.remove).not.toHaveBeenCalled();expect(mocks.upsert).not.toHaveBeenCalled();
 });
});