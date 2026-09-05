import { isSamePublicOrigin, isVerifiedDeploymentAdmin, type DeploymentAdminEnv } from "./deployment-admin.js";

type BookingAdminEnv = DeploymentAdminEnv & { BOOKING_ADMIN_BASE_URL?: string };

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
  if (!env.CF_ACCESS_AUD || !isSamePublicOrigin(req, url, env)) {
    return new Response("Booking administration requires Cloudflare Access.", { status: 403 });
  }
  let accessAssertion = req.headers.get("cf-access-jwt-assertion");
  if (!accessAssertion || !await isVerifiedDeploymentAdmin(req, env)) {
    return new Response("Booking administration is restricted to deployment administrators.", { status: 403 });
  }
  let bookingPath = url.pathname.slice("/api/booking-admin".length) || "/";
  return forward(req, env, `/booking/admin/api${bookingPath}${url.search}`, accessAssertion);
}
