import { createFileRoute } from '@tanstack/react-router';
import AddressBookPage from '@/components/contacten/AddressBookPage';
import { socialHead } from '@/lib/socialHead';
export const Route = createFileRoute('/_dashboard/contacten/$id')({
  head: ({ params }) => socialHead({ title: 'Organisatiecontacten — BCD', description: 'Organisatie en contactpersonen in het interne BCD-adresboek.', path: `/contacten/${encodeURIComponent(params.id)}` }),
  component: OrganizationContacts,
});
function OrganizationContacts() {
  const { id } = Route.useParams();
  return <AddressBookPage key={id} id={id} />;
}
