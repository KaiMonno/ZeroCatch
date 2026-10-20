import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyUnsubscribeToken } from "./alert-token";

const USER = "3f2b1c4d-0000-4000-8000-000000000001";
// Signed by the Python sender: scrapers.alerts.unsubscribe_token(USER, "test-secret").
// If either side changes its format, this test breaks before any email does.
const PYTHON_TOKEN = `${USER}.BOwHTRML6zJ10VlG-phYSP0szlH3V4AhVNBGLrv81_M`;

describe("verifyUnsubscribeToken", () => {
  beforeEach(() => {
    process.env.ALERTS_SIGNING_SECRET = "test-secret";
  });
  afterEach(() => {
    delete process.env.ALERTS_SIGNING_SECRET;
  });

  it("accepts a token signed by the Python sender", () => {
    expect(verifyUnsubscribeToken(PYTHON_TOKEN)).toBe(USER);
  });

  it("rejects a token signed with another secret", () => {
    process.env.ALERTS_SIGNING_SECRET = "other-secret";
    expect(verifyUnsubscribeToken(PYTHON_TOKEN)).toBeNull();
  });

  it("rejects a valid signature moved to another user", () => {
    const other = "3f2b1c4d-0000-4000-8000-000000000002";
    expect(verifyUnsubscribeToken(`${other}.${PYTHON_TOKEN.split(".")[1]}`)).toBeNull();
  });

  it.each([null, "", USER, `${USER}.`, `not-a-uuid.${PYTHON_TOKEN.split(".")[1]}`, `${PYTHON_TOKEN}x`])(
    "rejects malformed token %s",
    (token) => {
      expect(verifyUnsubscribeToken(token)).toBeNull();
    },
  );

  it("fails closed when the secret isn't configured", () => {
    delete process.env.ALERTS_SIGNING_SECRET;
    expect(verifyUnsubscribeToken(PYTHON_TOKEN)).toBeNull();
  });
});
