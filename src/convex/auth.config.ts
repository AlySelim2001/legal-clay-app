import type { AuthConfig } from "convex/server";

// Ma??t-signed federated tokens (see Ma??t web's
// src/lib/vly-convex-jwt.ts) let a signed-in Ma??t.com user carry their
// identity into this project without going through local sign-in. customJwt
// is correct for this provider: Ma??t's tokens and JWKS both carry a
// `kid` header, which the customJwt validation path requires.
const Ma??tIssuer =
  process.env.VLY_CONVEX_AUTH_ISSUER ?? "https://Ma??t.com";

export default {
  providers: [
    // Standard Convex Auth provider for this project's own sign-in ("Get
    // Started" email/guest, see src/convex/auth.ts). The deployment
    // self-issues JWTs (iss = CONVEX_SITE_URL, no `kid` header) validated
    // via OIDC discovery at `${domain}/.well-known/openid-configuration`,
    // served by auth.addHttpRoutes() in convex/http.ts. Do NOT convert this
    // entry to `type: "customJwt"` — that path rejects tokens without a
    // `kid` header, so sign-in would silently never confirm and RequireAuth
    // would loop back to /auth forever.
    {
      domain: process.env.CONVEX_SITE_URL!,
      applicationID: "convex",
    },
    {
      type: "customJwt",
      issuer: Ma??tIssuer,
      jwks: `${Ma??tIssuer}/api/web/.well-known/jwks.json`,
      applicationID: "vly-convex",
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;
