import { describe, expect, it } from "vitest";
import {
  SESSION_COOKIE_NAME,
  readSessionCookie,
  serializeClearCookie,
  serializeSessionCookie,
  signSessionToken,
  verifySessionToken,
  type SessionTokenPayload,
} from "@backend-platform/infrastructure/route-utils/session-cookie";

const SECRET = "test-secret-must-be-at-least-32-chars-long";
const SECRET_ALT = "another-test-secret-also-at-least-32-chars";

function makePayload(overrides: Partial<SessionTokenPayload> = {}): SessionTokenPayload {
  const issuedAt = Date.now();
  return {
    userId: "11111111-1111-4111-8111-111111111111",
    email: "demo@scholastic.ai",
    issuedAt,
    expiresAt: issuedAt + 60 * 60 * 1000,
    ...overrides,
  };
}

describe("signSessionToken / verifySessionToken", () => {
  it("round-trips a payload deep-equally", () => {
    const payload = makePayload();

    const token = signSessionToken(payload, SECRET);
    const recovered = verifySessionToken(token, SECRET);

    expect(recovered).toEqual(payload);
  });

  it("returns null when the token has been tampered with", () => {
    const payload = makePayload();
    const token = signSessionToken(payload, SECRET);

    const flippedIndex = Math.floor(token.length / 2);
    const flippedChar = token[flippedIndex] === "A" ? "B" : "A";
    const tampered = token.slice(0, flippedIndex) + flippedChar + token.slice(flippedIndex + 1);

    expect(verifySessionToken(tampered, SECRET)).toBeNull();
  });

  it("returns null when the token has expired", () => {
    const now = Date.now();
    const payload = makePayload({ issuedAt: now - 7200_000, expiresAt: now - 3600_000 });

    const token = signSessionToken(payload, SECRET);

    expect(verifySessionToken(token, SECRET)).toBeNull();
  });

  it("returns null when verified with the wrong secret", () => {
    const payload = makePayload();
    const token = signSessionToken(payload, SECRET);

    expect(verifySessionToken(token, SECRET_ALT)).toBeNull();
  });

  it("returns null for malformed tokens", () => {
    expect(verifySessionToken("not-a-token", SECRET)).toBeNull();
    expect(verifySessionToken("", SECRET)).toBeNull();
    expect(verifySessionToken("only.one.dot", SECRET)).toBeNull();
  });
});

describe("serializeSessionCookie", () => {
  const opts = { isProduction: false, ttlSeconds: 3600 };

  it("emits HttpOnly, SameSite=Lax, Path=/ and Max-Age", () => {
    const cookie = serializeSessionCookie("token-value", opts);

    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=token-value`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=3600");
  });

  it("does not include Secure outside production", () => {
    const cookie = serializeSessionCookie("token-value", { isProduction: false, ttlSeconds: 3600 });

    expect(cookie).not.toContain("Secure");
  });

  it("includes Secure in production", () => {
    const cookie = serializeSessionCookie("token-value", { isProduction: true, ttlSeconds: 3600 });

    expect(cookie).toContain("Secure");
  });
});

describe("serializeClearCookie", () => {
  it("emits a Max-Age=0 cookie that clears the named cookie", () => {
    const cookie = serializeClearCookie({ isProduction: false });

    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/");
  });

  it("includes Secure in production", () => {
    const cookie = serializeClearCookie({ isProduction: true });

    expect(cookie).toContain("Secure");
  });
});

describe("readSessionCookie", () => {
  it("returns the named cookie's value when present", () => {
    const request = new Request("https://example.test/", {
      headers: { Cookie: `other=foo; ${SESSION_COOKIE_NAME}=token-value; trailing=bar` },
    });

    expect(readSessionCookie(request)).toBe("token-value");
  });

  it("returns null when the cookie is absent", () => {
    const request = new Request("https://example.test/", { headers: { Cookie: "other=foo" } });

    expect(readSessionCookie(request)).toBeNull();
  });

  it("returns null when there is no Cookie header", () => {
    const request = new Request("https://example.test/");

    expect(readSessionCookie(request)).toBeNull();
  });
});
