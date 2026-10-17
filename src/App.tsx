import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AppShell } from '@/components/app-shell';
import { ProtectedRoute, RoleRoute } from '@/auth/protected-route';
import { NotFoundPage } from '@/pages/not-found-page';

const AuthPage = lazy(() =>
  import('@/pages/auth-page').then((module) => ({ default: module.AuthPage })),
);
const TicketsPage = lazy(() =>
  import('@/pages/tickets-page').then((module) => ({
    default: module.TicketsPage,
  })),
);
const TicketPage = lazy(() =>
  import('@/pages/ticket-page').then((module) => ({
    default: module.TicketPage,
  })),
);
const AdminUsersPage = lazy(() =>
  import('@/pages/admin-users-page').then((module) => ({
    default: module.AdminUsersPage,
  })),
);
const CreateTicketPage = lazy(() =>
  import('@/pages/ticket-form-page').then((module) => ({
    default: module.CreateTicketPage,
  })),
);
const EditTicketPage = lazy(() =>
  import('@/pages/ticket-form-page').then((module) => ({
    default: module.EditTicketPage,
  })),
);

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
