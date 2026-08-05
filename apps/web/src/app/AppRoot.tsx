import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { bootstrapAuth } from "./auth/bootstrap";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import AcceptInvite from "./routes/AcceptInvite";
import Accounts from "./routes/Accounts";
import AppLayout from "./routes/AppLayout";
import Contacts from "./routes/Contacts";
import Dashboard from "./routes/Dashboard";
import Deals from "./routes/Deals";
import Leads from "./routes/Leads";
import Login from "./routes/Login";
import Register from "./routes/Register";
import Team from "./routes/Team";
import { useSystemThemeSync } from "./ui";

// SSO returns with the token in the URL fragment; capture it before the first
// render so an authenticated return doesn't flash the login screen.
bootstrapAuth();

const queryClient = new QueryClient();

/**
 * Root of the /app dashboard SPA island.
 * TanStack Query provides server-state; React Router owns /app/* navigation.
 */
export default function AppRoot() {
  // The theme class is already on <html> from the inline boot script; this only
  // keeps it in step if the OS preference changes while "system" is selected.
  useSystemThemeSync();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/app">
        <Routes>
          {/* Public routes. accept-invite is public by necessity: the invitee
              has no session yet, the token in the link is the credential. */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />

          {/* Authenticated app: guard first, then the shared portal chrome */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/deals" element={<Deals />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/team" element={<Team />} />
              {/* Add quotes, invoices routes here */}
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
