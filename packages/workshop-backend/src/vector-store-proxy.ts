import { verifyCfAccessJwt } from "./access.js";

type VectorStoreEnv = { S3V_EXPLORER?: Fetcher };
type VectorStoreAdminEnv = VectorStoreEnv & {
  CF_ACCESS_AUD?: string;
  CF_ACCESS_ISS?: string;
  ADMINS?: string[] | string;
};

function isDeploymentAdmin(email: string, env: VectorStoreAdminEnv): boolean {
  let admins = env.ADMINS;
  if (!admins) return false;
  if (typeof admins === "string") {
    try { admins = JSON.parse(admins) as string[]; } catch { return false; }
  }
  return Array.isArray(admins) && admins.includes(email);
}

export async function handleVectorStoreRequest(req: Request, env: VectorStoreAdminEnv, url: URL): Promise<Response> {
  let origin = req.headers.get("Origin");
  if (!env.CF_ACCESS_AUD || origin && origin !== url.origin) {
    return new Response("Vector administration requires Cloudflare Access.", { status: 403 });
  }
  let payload = await verifyCfAccessJwt(req, env);
  if (typeof payload?.email !== "string" || !isDeploymentAdmin(payload.email, env)) {
    return new Response("Vector administration is restricted to deployment administrators.", { status: 403 });
  }
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
