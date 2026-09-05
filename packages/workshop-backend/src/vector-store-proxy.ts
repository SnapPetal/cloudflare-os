import { isSamePublicOrigin, isVerifiedDeploymentAdmin, type DeploymentAdminEnv } from "./deployment-admin.js";

type VectorStoreAdminEnv = DeploymentAdminEnv & { S3V_EXPLORER?: Fetcher };

export async function handleVectorStoreRequest(req: Request, env: VectorStoreAdminEnv, url: URL): Promise<Response> {
  if (!env.CF_ACCESS_AUD || !isSamePublicOrigin(req, url, env)) {
    return new Response("Vector administration requires Cloudflare Access.", { status: 403 });
  }
  if (!await isVerifiedDeploymentAdmin(req, env)) {
    return new Response("Vector administration is restricted to deployment administrators.", { status: 403 });
  }
  if (!env.S3V_EXPLORER) return new Response("Vector store is not configured.", { status: 503 });
  let downstreamUrl = new URL(req.url);
  downstreamUrl.pathname = url.pathname.slice("/vector-store".length) || "/";
  return env.S3V_EXPLORER.fetch(new Request(downstreamUrl, req));
}
