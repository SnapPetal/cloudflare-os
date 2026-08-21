import type { JWTPayload } from "jose";
import { verifyCfAccessJwt } from "./access.js";

type BookingAdminEnv = {
  BOOKING_ADMIN_BASE_URL?: string;
  CF_ACCESS_AUD?: string;
  ADMINS?: string[] | string;
  CF_ACCESS_ISS?: string;
};

function isDeploymentAdmin(email: string, env: BookingAdminEnv): boolean {
  let admins = env.ADMINS;
  if (!admins) return false;
  if (typeof admins === "string") {
    try { admins = JSON.parse(admins) as string[]; } catch { return false; }
  }
  return Array.isArray(admins) && admins.includes(email);
}

async function forward(req: Request, env: BookingAdminEnv, path: string, accessAssertion: string): Promise<Response> {
  if (!env.BOOKING_ADMIN_BASE_URL) return new Response("Booking administration is not configured.", { status: 503 });
  let target = new URL(path, `${env.BOOKING_ADMIN_BASE_URL.replace(/\/$/, "")}/`);
  let headers = new Headers(req.headers);
  headers.set("Authorization", `Bearer ${accessAssertion}`);
  headers.delete("Host");
  headers.delete("Cookie");
  let upstream = await fetch(target, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
  });
  return new Response(upstream.body, upstream);
}

export async function handleBookingAdminRequest(
  req: Request, env: BookingAdminEnv, url: URL): Promise<Response> {
  let origin = req.headers.get("Origin");
  if (!env.CF_ACCESS_AUD || origin && origin !== url.origin) {
    return new Response("Booking administration requires Cloudflare Access.", { status: 403 });
  }
  let accessAssertion = req.headers.get("cf-access-jwt-assertion");
  let payload: JWTPayload | null = await verifyCfAccessJwt(req, env);
  if (!accessAssertion || typeof payload?.email !== "string" || !isDeploymentAdmin(payload.email, env)) {
    return new Response("Booking administration is restricted to deployment administrators.", { status: 403 });
  }
  let bookingPath = url.pathname.slice("/api/booking-admin".length) || "/";
  return forward(req, env, `/booking/admin/api${bookingPath}${url.search}`, accessAssertion);
}
