import { verifyCfAccessJwt, type CfAccessEnv } from "./access.js";

export type DeploymentAdminEnv = CfAccessEnv & {
  ADMINS?: string[] | string;
  /** Public router origin; service bindings otherwise rewrite request URLs to an internal origin. */
  PUBLIC_BASE_URL?: string;
};

export function isSamePublicOrigin(request: Request, url: URL, env: DeploymentAdminEnv): boolean {
  const origin = request.headers.get("Origin");
  return !origin || origin === (env.PUBLIC_BASE_URL || url.origin);
}

export function isDeploymentAdmin(email: string, env: DeploymentAdminEnv): boolean {
  let admins = env.ADMINS;
  if (!admins) return false;
  if (typeof admins === "string") {
    try { admins = JSON.parse(admins) as string[]; } catch { return false; }
  }
  return Array.isArray(admins) && admins.includes(email);
}

export async function isVerifiedDeploymentAdmin(
    request: Request, env: DeploymentAdminEnv): Promise<boolean> {
  const payload = await verifyCfAccessJwt(request, env);
  return typeof payload?.email === "string" && isDeploymentAdmin(payload.email, env);
}
