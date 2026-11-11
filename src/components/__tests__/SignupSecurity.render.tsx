import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// Real React screens and AuthProvider; all Auth/DB responses are fixtures, never live calls.
const m = vi.hoisted(() => ({
  cb: null as null | ((event: string, session: any) => void),
  getSession: vi.fn(), getUser: vi.fn(), signIn: vi.fn(), signUp: vi.fn(), rpc: vi.fn(),
  refresh: vi.fn(), fetch: vi.fn(), navigate: vi.fn(),
  roles: [] as {role:string}[], profiles: [] as {member_id:number}[],
  org: null as any, valid: true, proof: true,
}));
function query(table: string) {
  const rows = () => table === "user_roles" ? m.roles : table === "member_profiles" ? m.profiles : table === "external_org_users" ? [{org_id:"fixture-org"}] : table === "external_organizations" ? [m.org].filter(Boolean) : [];
  const q: any = { select:()=>q, eq:()=>q, then:(f:any,r:any)=>Promise.resolve({data:rows(),error:null}).then(f,r), maybeSingle:async()=>({data:rows()[0]??null,error:null}), single:async()=>({data:rows()[0]??null,error:null}) };
  return q;
}
vi.mock("@supabase/supabase-js",()=>({createClient:()=>({rpc:m.rpc,from:query})}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{
  auth:{getSession:m.getSession,getUser:m.getUser,refreshSession:m.refresh,signOut:vi.fn().mockResolvedValue({error:null}),signInWithPassword:m.signIn,signUp:m.signUp,onAuthStateChange:(cb:any)=>{m.cb=cb;return {data:{subscription:{unsubscribe:vi.fn()}}}}},from:query,rpc:m.rpc,
}}));
vi.mock("@/lib/router-compat",()=>({Navigate:({to}:{to:string})=>{m.navigate(to);return <div data-testid="destination">{to}</div>},useNavigate:()=>m.navigate}));
vi.mock("@/hooks/useBiometricAuth",()=>({useBiometricAuth:()=>({isAvailable:false,isNative:false,hasCredentials:false})}));
vi.mock("@/hooks/usePasskeys",()=>({usePasskeys:()=>({}),isPlatformAuthenticatorAvailable:async()=>false}));
vi.mock("@capacitor/core",()=>({Capacitor:{isNativePlatform:()=>false}}));
vi.mock("@/lib/memberAccessFlag",()=>({memberPasswordlessEnabled:false}));
vi.mock("@/lib/ssoRedirect",()=>({captureRedirectFromQuery:()=>{},hasPendingRedirect:()=>false,maybeRedirectAfterLogin:vi.fn()}));
vi.mock("@/lib/memberLogin.functions",()=>({requestMemberLoginLink:vi.fn()}));
vi.mock("@/components/BenefitFormDialog",()=>({default:()=>null}));
vi.mock("@/components/SupplierCoffeeshopTable",()=>({default:()=>null}));
vi.mock("@/components/SupplierGemeentenOverzicht",()=>({default:()=>null}));
vi.mock("@/components/DocumentenZoeker",()=>({default:()=>null}));
vi.mock("@/hooks/useBenefits",()=>({getBenefitImageUrl:()=>null}));
vi.mock("sonner",()=>({toast:{error:vi.fn()}}));

import { AuthProvider, useAuth } from "@/hooks/useAuth";
import LoginPage from "@/pages/LoginPage";
import ExternLoginPage from "@/pages/ExternLoginPage";
import ExternDashboardPage from "@/pages/ExternDashboardPage";
import { savePostLoginPath } from "@/lib/postLoginPath";

const USER={id:"fixture-user",email:"fixture@example.test",email_confirmed_at:"2026-11-11T20:00:00Z",user_metadata:{}};
const SESSION={user:USER,access_token:"fixture-only",refresh_token:"fixture-only",expires_at:9999999999};
function Rights(){const a=useAuth();return <output data-testid="rights">{JSON.stringify({member:a.linkedMemberId,admin:a.isAdmin,extern:a.isExtern,blocked:!!a.authError})}</output>}
function mount(node:React.ReactNode){return render(<AuthProvider>{node}<Rights/></AuthProvider>)}
const reply=(body:any,status=200)=>({ok:status<400,status,json:async()=>body});
beforeEach(()=>{
  vi.clearAllMocks(); localStorage.clear();sessionStorage.clear();m.cb=null;m.roles=[];m.profiles=[];m.org=null;m.valid=true;m.proof=true;
  m.getSession.mockResolvedValue({data:{session:null},error:null});
  m.getUser.mockImplementation(async()=>({data:{user:m.valid?USER:null},error:m.valid?null:new Error("Invalid identity")}));
  m.refresh.mockRejectedValue(new Error("Invalid identity"));
  m.rpc.mockImplementation(async(name:string)=>{
    if(name==="ensure_member_link") {if(m.proof){m.profiles=[{member_id:7}];m.roles=[{role:"user"}];return {data:1,error:null}}return {data:0,error:null}}
    if(name==="submit_verified_external_signup") {if(!m.proof)return {data:null,error:{message:"Verified email required"}};m.org={id:"fixture-org",name:"Fixture supplier",type:"leverancier",approved:false};m.roles=[{role:"extern"}];return {data:"fixture-org",error:null}}
    return {data:0,error:null};
  });
  m.signIn.mockResolvedValue({error:null});m.signUp.mockResolvedValue({data:{session:null},error:null});
  m.fetch.mockResolvedValue(reply({confirmationRequired:true}));vi.stubGlobal("fetch",m.fetch);
  Object.defineProperty(window,"location",{configurable:true,value:{origin:"http://localhost:8080",pathname:"/login",assign:vi.fn(),replace:vi.fn()}});
});
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
async function loginReady(){await screen.findByRole("button",{name:"Nog geen account? Registreren"})}
function credentials(container:HTMLElement,external=false){fireEvent.change(container.querySelector('input[type=email]') as HTMLInputElement,{target:{value:"fixture@example.test"}});const ps=container.querySelectorAll('input[type=password]');ps.forEach(p=>fireEvent.change(p,{target:{value:"fixture-password"}}));if(external){fireEvent.change(screen.getByPlaceholderText("Naam van uw organisatie"),{target:{value:"Fixture supplier"}});fireEvent.change(screen.getByPlaceholderText("Uw volledige naam"),{target:{value:"Fixture Contact"}})}}

describe("registration screens without real accounts or mail",()=>{
  it("member registration shows confirmation and never starts a session",async()=>{
    const {container}=mount(<LoginPage/>);await loginReady();fireEvent.click(screen.getByRole("button",{name:"Nog geen account? Registreren"}));credentials(container);fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    await screen.findByText("Controleer je e-mail");expect(m.signIn).not.toHaveBeenCalled();expect(m.rpc).not.toHaveBeenCalled();expect(m.navigate).not.toHaveBeenCalled();expect(JSON.parse(screen.getByTestId("rights").textContent??"{}").member).toBeNull();
  });
  it.each(["member","lead"])("confirmed %s callback/login safely links and restores intended route",async(kind)=>{
    const {container}=mount(<LoginPage/>);await loginReady();credentials(container);fireEvent.submit(container.querySelector('form') as HTMLFormElement);await waitFor(()=>expect(m.signIn).toHaveBeenCalledWith({email:"fixture@example.test",password:"fixture-password"}));
    savePostLoginPath("/kennisbank");act(()=>m.cb?.("SIGNED_IN",{...SESSION,user:{...USER,email:`${kind}@example.test`}}));
    await waitFor(()=>expect(m.navigate).toHaveBeenCalledWith("/kennisbank"));expect(m.getUser).toHaveBeenCalledWith("fixture-only");expect(m.rpc).toHaveBeenCalledWith("ensure_member_link");expect(JSON.parse(screen.getByTestId("rights").textContent??"{}").member).toBe(7);
  });
  it.each([false,true])("invalid or missing proof never creates member/admin rights (invalid=%s)",async(invalid)=>{
    m.valid=!invalid;m.proof=false;mount(<LoginPage/>);await loginReady();act(()=>m.cb?.("SIGNED_IN",SESSION));await waitFor(()=>expect(m.getUser).toHaveBeenCalled());
    if(invalid)await screen.findByText(/Ledenportaal tijdelijk niet bereikbaar/);
    else await screen.findByTestId("destination");
    const rights=JSON.parse(screen.getByTestId("rights").textContent??"{}");expect(rights.member).toBeNull();expect(rights.admin).toBe(false);
  });
  it("external registration with autoconfirm false waits for confirmation, not org claim",async()=>{
    m.fetch.mockResolvedValue(reply({mailer_autoconfirm:false}));const {container}=mount(<ExternLoginPage/>);await loginReady();fireEvent.click(screen.getByRole("button",{name:"Nog geen account? Registreren"}));credentials(container,true);fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    await screen.findByText("Registratie ontvangen!");expect(m.signUp).toHaveBeenCalledWith({email:"fixture@example.test",password:"fixture-password",options:{emailRedirectTo:"http://localhost:8080/extern-login"}});expect(m.signIn).not.toHaveBeenCalled();expect(m.rpc).not.toHaveBeenCalled();expect(m.navigate).not.toHaveBeenCalled();
  });
  it("external autoconfirm true fails closed before signup",async()=>{
    m.fetch.mockResolvedValue(reply({mailer_autoconfirm:true}));const {container}=mount(<ExternLoginPage/>);await loginReady();fireEvent.click(screen.getByRole("button",{name:"Nog geen account? Registreren"}));credentials(container,true);fireEvent.submit(container.querySelector('form') as HTMLFormElement);await screen.findByText(/Registratie wacht op veilige/);expect(m.signUp).not.toHaveBeenCalled();
  });
  it("confirmed external callback can submit exact named application then sees pending approval",async()=>{
    m.proof=false;const view=mount(<ExternLoginPage/>);await loginReady();act(()=>m.cb?.("SIGNED_IN",SESSION));await screen.findByRole("heading",{name:"Organisatieaanvraag"});m.proof=true;
    fireEvent.change(screen.getByRole("textbox",{name:"Organisatienaam"}),{target:{value:"Fixture supplier"}});fireEvent.change(screen.getByRole("textbox",{name:"Contactnaam"}),{target:{value:"Fixture Contact"}});fireEvent.change(screen.getByRole("combobox",{name:"Organisatietype"}),{target:{value:"leverancier"}});fireEvent.click(screen.getByRole("button",{name:"Aanvraag indienen"}));
    await waitFor(()=>expect(window.location.assign).toHaveBeenCalledWith("/extern"));expect(m.rpc).toHaveBeenCalledWith("submit_verified_external_signup",{p_name:"Fixture supplier",p_type:"leverancier",p_contact:"Fixture Contact"});
    view.rerender(<AuthProvider><ExternDashboardPage/><Rights/></AuthProvider>);await screen.findByRole("heading",{name:"Account in behandeling"});expect(screen.queryByRole("button",{name:/Nieuw product/})).toBeNull();
  });
  it("external missing proof refuses org request and keeps form usable",async()=>{
    m.proof=false;mount(<ExternLoginPage/>);await loginReady();act(()=>m.cb?.("SIGNED_IN",SESSION));await screen.findByRole("heading",{name:"Organisatieaanvraag"});fireEvent.change(screen.getByRole("textbox",{name:"Organisatienaam"}),{target:{value:"Other supplier"}});fireEvent.change(screen.getByRole("textbox",{name:"Contactnaam"}),{target:{value:"Fixture Contact"}});fireEvent.click(screen.getByRole("button",{name:"Aanvraag indienen"}));await screen.findByText(/Uw aanvraag kon niet worden ingediend/);expect(window.location.assign).not.toHaveBeenCalled();expect(m.org).toBeNull();expect(JSON.parse(screen.getByTestId("rights").textContent??"{}").extern).toBe(false);
  });
  it.each(["member","external"])("%s login handles rejected network promise and permits retry",async(kind)=>{
    m.signIn.mockRejectedValue(new Error("Network failure"));const {container}=mount(kind==="member"?<LoginPage/>:<ExternLoginPage/>);await loginReady();credentials(container);fireEvent.submit(container.querySelector('form') as HTMLFormElement);await screen.findByText(/Inloggen is tijdelijk niet mogelijk/);expect((screen.getByRole("button",{name:"Inloggen"}) as HTMLButtonElement).disabled).toBe(false);
  });
});