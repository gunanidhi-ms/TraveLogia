const ExpressError = require("../../utils/ExpressError");
const wrapAsync = require("../../utils/wrapAsync");

describe("Component Testing: Utility Modules", () => {
  describe("ExpressError Component", () => {
    test("instantiates error with custom statusCode and message", () => {
      const err = new ExpressError(404, "Custom Not Found");
      expect(err).toBeInstanceOf(Error);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Custom Not Found");
    });

    test("inherits stack trace from Error class", () => {
      const err = new ExpressError(500, "Internal Breakdown");
      expect(err.stack).toBeDefined();
    });
  });

  describe("wrapAsync Wrapper Component", () => {
    test("forwards resolved promise value without error", async () => {
      const fn = jest.fn().mockResolvedValue("success");
      const wrapped = wrapAsync(fn);

      const req = {};
      const res = {};
      const next = jest.fn();

      await wrapped(req, res, next);
      expect(fn).toHaveBeenCalledWith(req, res, next);
      expect(next).not.toHaveBeenCalled();
    });

    test("catches rejected promise and forwards error to next(err)", async () => {
      const testError = new Error("Async failure");
      const fn = jest.fn().mockRejectedValue(testError);
      const wrapped = wrapAsync(fn);

      const req = {};
      const res = {};
      const next = jest.fn();

      await wrapped(req, res, next);
      expect(fn).toHaveBeenCalledWith(req, res, next);
      expect(next).toHaveBeenCalledWith(testError);
    });
  });
});
