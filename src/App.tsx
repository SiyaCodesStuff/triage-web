import { Navigate, Route, Routes } from 'react-router';
import { AppShell } from '@/components/app-shell';
import { NotFoundPage } from '@/pages/not-found-page';
import { PlaceholderPage } from '@/pages/placeholder-page';
import { TicketPage } from '@/pages/ticket-page';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/tickets" replace />} />
        <Route
          path="login"
          element={
            <PlaceholderPage
              title="Log in"
              description="Sign in to your Triage workspace."
            />
          }
        />
        <Route
          path="register"
          element={
            <PlaceholderPage
              title="Create an account"
              description="Join your team and keep support moving."
            />
          }
        />
        <Route
          path="tickets"
          element={
            <PlaceholderPage
              title="Tickets"
              description="Keep track of support requests and what needs attention."
            />
          }
        />
        <Route path="tickets/:id" element={<TicketPage />} />
        <Route
          path="admin/users"
          element={
            <PlaceholderPage
              title="Users"
              description="Manage the people in your workspace."
            />
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
