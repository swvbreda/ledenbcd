import { createFileRoute } from '@tanstack/react-router';
import AddressBookPage from '@/components/contacten/AddressBookPage';
import { addressCategories, contactRoles } from '@/lib/addressBook';
import { socialHead } from '@/lib/socialHead';
export const Route = createFileRoute('/_dashboard/contacten/')({
  validateSearch: (search: Record<string, unknown>): { q?: string; category?: string; role?: string } => ({
    q: typeof search.q === 'string' ? search.q : undefined,
    category: typeof search.category === 'string' && addressCategories.some(c => c === search.category) ? search.category : undefined,
    role: typeof search.role === 'string' && contactRoles.some(r => r === search.role) ? search.role : undefined,
  }),
  head: () => socialHead({ title: 'Contacten — BCD', description: 'Intern adresboek voor bestuur en beheer van de Bond van Cannabis Detaillisten.', path: '/contacten' }),
  component: Contacts,
});
function Contacts() {
  const { q, category, role } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <AddressBookPage query={q} category={category} role={role} onSearch={search => { void navigate({ search, replace: true }); }} />;
}
