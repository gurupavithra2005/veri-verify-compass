/**
 * Authorized external verification lookup (prototype connector layer).
 *
 * Rules enforced here:
 *  - Only sources explicitly configured by an administrator are contacted.
 *  - HTTPS only; the hostname must match the configured trusted domain
 *    (exact match or subdomain). Redirects are followed manually and any
 *    redirect is treated as untrusted -> failure, protecting against SSRF
 *    and unsafe-redirect exfiltration.
 *  - Only minimal identifiers are sent — never document contents.
 *  - The outcome is always recorded with the real source, status and
 *    timestamp. A successful HTTP response is NOT interpreted as proof of
 *    authenticity: it is recorded as "pending interpretation" unless a real
 *    interpretation layer exists.
 */

export interface LookupSource {
  id: string;
  name: string;
  source_type: string;
  base_domain: string;
  endpoint_path: string;
  lookup_param: string;
}

export interface LookupOutcome {
  status:
    | "verified_by_source"
    | "pending"
    | "source_unavailable"
    | "verification_failed"
    | "not_configured";
  httpStatus: number | null;
  responseSummary: string | null;
  requestSummary: string;
}

const LOOKUP_TIMEOUT_MS = 10_000;

function isTrustedHost(hostname: string, trustedDomain: string): boolean {
  const host = hostname.toLowerCase();
  const domain = trustedDomain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return host === domain || host.endsWith("." + domain);
}

export function buildLookupUrl(source: LookupSource, lookupValue: string): string | null {
  try {
    const url = new URL(`https://${source.base_domain}${source.endpoint_path.startsWith("/") ? source.endpoint_path : "/" + source.endpoint_path}`);
    if (!isTrustedHost(url.hostname, source.base_domain)) return null;
    url.searchParams.set(source.lookup_param, lookupValue);
    return url.toString();
  } catch {
    return null;
  }
}

export async function performAuthorizedLookup(
  source: LookupSource,
  lookupField: string,
  lookupValue: string,
): Promise<LookupOutcome> {
  const requestSummary = `GET https://${source.base_domain}${source.endpoint_path}?${source.lookup_param}=<${lookupField}> (identifier only, no document contents)`;
  const url = buildLookupUrl(source, lookupValue);
  if (!url) {
    return {
      status: "verification_failed",
      httpStatus: null,
      responseSummary: "The configured source URL failed the trusted-domain safety check; no request was sent.",
      requestSummary,
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual", // any redirect is untrusted
      signal: controller.signal,
      headers: { Accept: "application/json,text/plain" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      return {
        status: "verification_failed",
        httpStatus: response.status,
        responseSummary: "The source responded with a redirect, which is not trusted for verification.",
        requestSummary,
      };
    }
    const body = (await response.text()).slice(0, 500);
    if (!response.ok) {
      return {
        status: "verification_failed",
        httpStatus: response.status,
        responseSummary: `Source returned HTTP ${response.status}: ${body}`,
        requestSummary,
      };
    }
    // A 200 body is recorded but never auto-interpreted as verification.
    return {
      status: "pending",
      httpStatus: response.status,
      responseSummary: `Response received from the authorized source and recorded for authorized interpretation: ${body}`,
      requestSummary,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "network error";
    return {
      status: "source_unavailable",
      httpStatus: null,
      responseSummary: `The source could not be reached: ${message}`,
      requestSummary,
    };
  } finally {
    clearTimeout(timer);
  }
}
