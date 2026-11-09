import { createFileRoute } from '@tanstack/react-router';
import MinutesPage from '@/components/board-minutes/MinutesPage';
import { socialHead } from '@/lib/socialHead';
export const Route=createFileRoute('/_dashboard/bestuur/notulen/$id')({head:()=>socialHead({title:'Vergaderverslag — Bestuur BCD',description:'Privé vergaderverslag, besluiten, acties en oorspronkelijke bijlagen voor bestuur en beheer.',path:'/bestuur/notulen'}),component:Detail});
function Detail(){const{id}=Route.useParams();return <MinutesPage key={id} id={id}/>;}