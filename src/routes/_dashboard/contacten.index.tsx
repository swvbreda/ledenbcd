import { createFileRoute } from '@tanstack/react-router';
import AddressBookPage from '@/components/contacten/AddressBookPage';
import { addressCategories } from '@/lib/addressBook';
import { socialHead } from '@/lib/socialHead';
export const Route = createFileRoute('/_dashboard/contacten/')({
  validateSearch: (search: Record<string, unknown>): { q?: string; category?: string } => ({
    q: typeof search.q === 'string' ? search.q : undefined,
    category: typeof search.category === 'string' && addressCategories.some(c => c === search.category) ? search.category : undefined,
  }),
  head: () => socialHead({ title: 'Contacten — BCD', description: 'Intern adresboek voor bestuur en beheer van de Bond van Cannabis Detaillisten.', path: '/contacten' }),
  component: Contacts,
});
function Contacts() {
  const { q, category } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <AddressBookPage query={q} category={category} onSearch={search => { void navigate({ search, replace: true }); }} />;
}
