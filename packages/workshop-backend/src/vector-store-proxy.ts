type VectorStoreEnv = { S3V_EXPLORER?: Fetcher };

export async function handleVectorStoreRequest(req: Request, env: VectorStoreEnv, url: URL): Promise<Response> {
  if (!env.S3V_EXPLORER) return new Response("Vector store is not configured.", { status: 503 });
  let downstreamUrl = new URL(req.url);
  downstreamUrl.pathname = url.pathname.slice("/vector-store".length) || "/";
  let response = await env.S3V_EXPLORER.fetch(new Request(downstreamUrl, req));
  if (url.pathname === "/vector-store" || url.pathname === "/vector-store/") {
    let html = await response.text();
    html = html.replaceAll("api('/api", "api('/vector-store/api");
    return new Response(html, response);
  }
  return response;
}
