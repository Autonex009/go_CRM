import { apiFetch } from "../lib/api";

const BASE = "/api/v1/integrations";

/** One connected third-party account. */
export interface Connection {
  provider: string;
  providerAccountId: string;
  scope: string;
  expiresAt: string | null;
  connectedAt: string;
}

export const integrationsApi = {
  list: () => apiFetch<Connection[]>(`${BASE}/`),

  /**
   * Asks the server for the consent URL and then navigates to it.
   *
   * The server cannot redirect us here: a browser will not attach the bearer
   * token to a top-level navigation, so it would not know who is connecting.
   */
  connectGoogle: async () => {
    const { authUrl } = await apiFetch<{ authUrl: string }>(`${BASE}/google/connect`, {
      method: "POST",
    });
    window.location.assign(authUrl);
  },

  disconnectGoogle: () => apiFetch<void>(`${BASE}/google`, { method: "DELETE" }),
};
