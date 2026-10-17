import { Navigate, Route, Routes } from 'react-router';
import { AppShell } from '@/components/app-shell';
import { ProtectedRoute, RoleRoute } from '@/auth/protected-route';
import { AuthPage } from '@/pages/auth-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { AdminUsersPage } from '@/pages/admin-users-page';
import { TicketsPage } from '@/pages/tickets-page';
import { CreateTicketPage, EditTicketPage } from '@/pages/ticket-form-page';
import { TicketPage } from '@/pages/ticket-page';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/tickets" replace />} />
        <Route path="login" element={<AuthPage key="login" mode="login" />} />
        <Route
          path="register"
          element={<AuthPage key="register" mode="register" />}
        />
        <Route element={<ProtectedRoute />}>
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="tickets/new" element={<CreateTicketPage />} />
          <Route path="tickets/:id/edit" element={<EditTicketPage />} />
          <Route path="tickets/:id" element={<TicketPage />} />
          <Route element={<RoleRoute roles={['ADMIN']} />}>
            <Route path="admin/users" element={<AdminUsersPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
