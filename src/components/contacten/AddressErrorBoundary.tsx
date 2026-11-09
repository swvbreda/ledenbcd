import { Component, type ReactNode } from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
class Boundary extends Component<{ children: ReactNode; onReset: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="p-4 sm:p-6 space-y-3" role="alert"><p>Contacten konden niet worden geladen.</p><Button variant="outline" onClick={() => { this.props.onReset(); this.setState({ failed: false }); }}>Opnieuw proberen</Button></div>;
    return this.props.children;
  }
}
export function ErrorBoundary({ children }: { children: ReactNode }) {
  return <QueryErrorResetBoundary>{({ reset }) => <Boundary onReset={reset}>{children}</Boundary>}</QueryErrorResetBoundary>;
}
