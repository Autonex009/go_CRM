import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Dashboard from "./routes/Dashboard";

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
          <Route path="/" element={<Dashboard />} />
          {/* Add contacts, deals, activities routes here */}
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
