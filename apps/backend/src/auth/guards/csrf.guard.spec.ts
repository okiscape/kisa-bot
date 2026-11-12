import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { CsrfGuard } from "./csrf.guard";

describe("CsrfGuard", () => {
  const guard = new CsrfGuard();

  function ctx(method: string, header?: string) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          header: (name: string) =>
            name.toLowerCase() === "x-requested-with" ? header : undefined,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it("allows safe methods", () => {
    expect(guard.canActivate(ctx("GET"))).toBe(true);
  });

  it("allows mutating requests with X-Requested-With: fetch", () => {
    expect(guard.canActivate(ctx("POST", "fetch"))).toBe(true);
  });

  it("rejects mutating requests without header", () => {
    expect(() => guard.canActivate(ctx("POST"))).toThrow(ForbiddenException);
  });
});
