import { createFileRoute } from '@tanstack/react-router';
import MinutesPage from '@/components/board-minutes/MinutesPage';
import { socialHead } from '@/lib/socialHead';
export const Route=createFileRoute('/_dashboard/bestuur/notulen/')({head:()=>socialHead({title:'Notulen en gespreksverslagen — Bestuur BCD',description:'Besloten archief van bestuursnotulen en gespreksverslagen van de Bond van Cannabis Detaillisten.',path:'/bestuur/notulen'}),component:()=> <MinutesPage/>});