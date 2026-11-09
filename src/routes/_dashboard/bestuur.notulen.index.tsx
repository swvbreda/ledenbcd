import { createFileRoute } from '@tanstack/react-router';
import MinutesPage from '@/components/board-minutes/MinutesPage';
import { socialHead } from '@/lib/socialHead';
export const Route=createFileRoute('/_dashboard/bestuur/notulen/')({head:()=>socialHead({title:'Vergaderingen en notulen — Bestuur BCD',description:'Besloten bestuursnotulenarchief van de Bond van Cannabis Detaillisten.',path:'/bestuur/notulen'}),component:()=> <MinutesPage/>});