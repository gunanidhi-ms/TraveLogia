const ExpressError = require("../../utils/ExpressError");
const wrapAsync = require("../../utils/wrapAsync");

describe("White-Box: Utilities Testing", () => {
  describe("ExpressError Class", () => {
    test("instantiates with statusCode and message", () => {
      const err = new ExpressError(404, "Page Not Found");
      expect(err).toBeInstanceOf(Error);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Page Not Found");
    });

    test("inherits standard Error prototype properties", () => {
      const err = new ExpressError(500, "Internal Server Error");
      expect(err.stack).toBeDefined();
    });
  });

  describe("wrapAsync Wrapper", () => {
    test("calls next() with error when wrapped async function rejects", async () => {
      const testError = new Error("Async failure");
      const faultyAsyncFn = async () => {
        throw testError;
      };

      const wrapped = wrapAsync(faultyAsyncFn);
      const req = {};
      const res = {};
      const next = jest.fn();

      await wrapped(req, res, next);
      expect(next).toHaveBeenCalledWith(testError);
    });

    test("executes successfully when wrapped async function resolves", async () => {
      const successFn = jest.fn().mockResolvedValue("done");
      const wrapped = wrapAsync(successFn);
      const req = {};
      const res = {};
      const next = jest.fn();

      await wrapped(req, res, next);
      expect(successFn).toHaveBeenCalledWith(req, res, next);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
