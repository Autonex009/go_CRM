import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { bootstrapAuth } from "./auth/bootstrap";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import Dashboard from "./routes/Dashboard";
import Login from "./routes/Login";
import Register from "./routes/Register";

// SSO returns with the token in the URL fragment; capture it before the first
// render so an authenticated return doesn't flash the login screen.
bootstrapAuth();

const queryClient = new QueryClient();

/**
 * Root of the /app dashboard SPA island.
 * TanStack Query provides server-state; React Router owns /app/* navigation.
 */
export default function AppRoot() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/app">
        <Routes>
          {/* Public auth routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Authenticated app */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
            {/* Add contacts, deals, activities routes here */}
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
