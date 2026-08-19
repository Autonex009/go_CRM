import type { APIRoute } from "astro";

export const prerender = false;

export const ALL: APIRoute = async ({ request, params }) => {
  let apiBase = import.meta.env.PUBLIC_API_URL || "http://127.0.0.1:8080";
  if (apiBase.includes("localhost")) {
    apiBase = apiBase.replace("localhost", "127.0.0.1");
  }
  const path = params.path || "";
  const url = new URL(request.url);
  const targetUrl = `${apiBase.replace(/\/+$/, "")}/api/${path}${url.search}`;

  const forwardHeaders = new Headers();
  for (const [key, value] of request.headers.entries()) {
    const k = key.toLowerCase();
    if (k !== "host" && k !== "connection" && k !== "content-length") {
      forwardHeaders.set(key, value);
    }
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body:
        request.method !== "GET" && request.method !== "HEAD"
          ? await request.arrayBuffer()
          : undefined,
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error("Proxy error details:", err, err?.cause);
    return new Response(
      JSON.stringify({
        error: "Failed to proxy request to backend gateway",
        details: err?.message,
        cause: err?.cause ? String(err.cause) : undefined,
        stack: err?.stack,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
