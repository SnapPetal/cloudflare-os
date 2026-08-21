import { verifyCfAccessJwt, type CfAccessEnv } from "./access.js";

export type DeploymentAdminEnv = CfAccessEnv & { ADMINS?: string[] | string };

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
