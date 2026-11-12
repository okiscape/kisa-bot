import { UsersController } from "./users.controller";

/**
 * Ensures private-by-id routes are not registered (IDOR removal).
 */
describe("UsersController IDOR surface", () => {
  it("does not expose unauthenticated /:id/settings or /:id/profile", () => {
    const proto = Object.getOwnPropertyNames(UsersController.prototype);
    // Route handlers that must not exist
    expect(proto).not.toContain("getSettings");
    expect(proto).not.toContain("getFullProfile");
    expect(proto).toContain("getPublicProfile");
    expect(proto).toContain("getMySettings");
    expect(proto).toContain("patchMySettings");
  });
});
