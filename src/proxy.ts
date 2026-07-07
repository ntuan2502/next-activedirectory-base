import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: ["/api/:path*"],
};

export function proxy(request: NextRequest) {
  const method = request.method;
  const path = request.nextUrl.pathname;

  // CSRF Protection for state-changing API routes (POST, PUT, DELETE, PATCH)
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method) && path.startsWith("/api/")) {
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const host = request.headers.get("host");

    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host) {
          return new NextResponse(
            JSON.stringify({ error: "errors.csrfOriginMismatch" }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      } catch {
        return new NextResponse(
          JSON.stringify({ error: "errors.csrfInvalidOrigin" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    } else if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.host !== host) {
          return new NextResponse(
            JSON.stringify({ error: "errors.csrfRefererMismatch" }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      } catch {
        return new NextResponse(
          JSON.stringify({ error: "errors.csrfInvalidReferer" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    } else {
      // Safe fallback: Block state-changing API calls if both Origin and Referer are missing
      return new NextResponse(
        JSON.stringify({ error: "errors.csrfMissingHeaders" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  return NextResponse.next();
}

// Support default export for safety
export default proxy;
