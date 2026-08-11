import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { bootstrapAuth } from "./auth/bootstrap";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import AcceptInvite from "./routes/AcceptInvite";
import Accounts from "./routes/Accounts";
import AppLayout from "./routes/AppLayout";
import Contacts from "./routes/Contacts";
import Dashboard from "./routes/Dashboard";
import Deals from "./routes/Deals";
import InvoiceEditor from "./routes/InvoiceEditor";
import Invoices from "./routes/Invoices";
import Leads from "./routes/Leads";
import Login from "./routes/Login";
import QuoteEditor from "./routes/QuoteEditor";
import Quotes from "./routes/Quotes";
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

  // Drop the shell's boot spinner now that there is a real screen behind it.
  // In an effect rather than during render: the removal has to happen after the
  // first paint, or the app flashes an empty frame where the spinner had been.
  useEffect(() => {
    document.getElementById("app-boot")?.remove();
  }, []);

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
              <Route path="/quotes" element={<Quotes />} />
              {/* new + :id share one editor; the route decides which */}
              <Route path="/quotes/new" element={<QuoteEditor />} />
              <Route path="/quotes/:id" element={<QuoteEditor />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoices/new" element={<InvoiceEditor />} />
              <Route path="/invoices/:id" element={<InvoiceEditor />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/team" element={<Team />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
