const middlewares = require("../../middlewares");
const Listing = require("../../models/listing");
const Review = require("../../models/review");
const ExpressError = require("../../utils/ExpressError");

jest.mock("../../models/listing");
jest.mock("../../models/review");

describe("Component Testing: Middlewares & Interceptors", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      session: {},
      flash: jest.fn(),
      params: {},
      body: {},
      user: { _id: "user123" },
      originalUrl: "/listings/123/edit",
      isAuthenticated: jest.fn(),
    };
    res = {
      locals: {},
      redirect: jest.fn(),
    };
    next = jest.fn();
  });

  describe("isLoggedIn Component", () => {
    test("allows authenticated user through to next()", () => {
      req.isAuthenticated.mockReturnValue(true);
      middlewares.isLoggedIn(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.redirect).not.toHaveBeenCalled();
    });

    test("intercepts unauthenticated user, saves redirectUrl, flashes error, and redirects to /login", () => {
      req.isAuthenticated.mockReturnValue(false);
      middlewares.isLoggedIn(req, res, next);

      expect(req.session.redirectUrl).toBe("/listings/123/edit");
      expect(req.flash).toHaveBeenCalledWith("error", "You must be logged in!");
      expect(res.redirect).toHaveBeenCalledWith("/login");
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("saveRedirectUrl Component", () => {
    test("copies saved redirectUrl from session into res.locals", () => {
      req.session.redirectUrl = "/listings/new";
      middlewares.saveRedirectUrl(req, res, next);

      expect(res.locals.redirectUrl).toBe("/listings/new");
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("passes through cleanly when no redirectUrl is in session", () => {
      middlewares.saveRedirectUrl(req, res, next);

      expect(res.locals.redirectUrl).toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("isOwner Component", () => {
    test("allows owner to proceed", async () => {
      req.params.id = "list123";
      const mockListing = {
        owner: {
          equals: jest.fn().mockReturnValue(true),
        },
      };
      Listing.findById.mockResolvedValue(mockListing);

      await middlewares.isOwner(req, res, next);

      expect(mockListing.owner.equals).toHaveBeenCalledWith("user123");
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.redirect).not.toHaveBeenCalled();
    });

    test("blocks non-owner with error flash and redirect", async () => {
      req.params.id = "list123";
      const mockListing = {
        owner: {
          equals: jest.fn().mockReturnValue(false),
        },
      };
      Listing.findById.mockResolvedValue(mockListing);

      await middlewares.isOwner(req, res, next);

      expect(req.flash).toHaveBeenCalledWith("error", "You are not the owner of this listing!");
      expect(res.redirect).toHaveBeenCalledWith("/listings/list123");
      expect(next).not.toHaveBeenCalled();
    });

    test("handles non-existent listing by flashing error and redirecting to /listings", async () => {
      req.params.id = "nonexistent999";
      Listing.findById.mockResolvedValue(null);

      await middlewares.isOwner(req, res, next);

      expect(req.flash).toHaveBeenCalledWith("error", "Listing not found!");
      expect(res.redirect).toHaveBeenCalledWith("/listings");
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("isReviewAuthor Component", () => {
    test("allows review author to proceed", async () => {
      req.params.id = "list123";
      req.params.reviewId = "rev123";
      const mockReview = {
        author: {
          equals: jest.fn().mockReturnValue(true),
        },
      };
      Review.findById.mockResolvedValue(mockReview);

      await middlewares.isReviewAuthor(req, res, next);

      expect(mockReview.author.equals).toHaveBeenCalledWith("user123");
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("blocks non-author from deleting review", async () => {
      req.params.id = "list123";
      req.params.reviewId = "rev123";
      const mockReview = {
        author: {
          equals: jest.fn().mockReturnValue(false),
        },
      };
      Review.findById.mockResolvedValue(mockReview);

      await middlewares.isReviewAuthor(req, res, next);

      expect(req.flash).toHaveBeenCalledWith("error", "You are not the author of this review!");
      expect(res.redirect).toHaveBeenCalledWith("/listings/list123");
      expect(next).not.toHaveBeenCalled();
    });

    test("handles non-existent review", async () => {
      req.params.id = "list123";
      req.params.reviewId = "rev404";
      Review.findById.mockResolvedValue(null);

      await middlewares.isReviewAuthor(req, res, next);

      expect(req.flash).toHaveBeenCalledWith("error", "Review not found!");
      expect(res.redirect).toHaveBeenCalledWith("/listings/list123");
    });
  });

  describe("Validation Middleware Components", () => {
    test("validateListing accepts valid payload", () => {
      req.body = {
        listing: {
          title: "Beach Cottage",
          description: "Sea breeze",
          image: { url: "http://example.com/img.jpg" },
          price: 1200,
          location: "Goa",
          country: "India",
          category: "Trending",
        },
      };

      middlewares.validateListing(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("validateListing throws ExpressError on missing required fields", () => {
      req.body = { listing: { title: "Incomplete Listing" } };

      expect(() => {
        middlewares.validateListing(req, res, next);
      }).toThrow(ExpressError);
      expect(next).not.toHaveBeenCalled();
    });

    test("validateReview accepts valid review payload", () => {
      req.body = {
        review: {
          rating: 4,
          comment: "Wonderful stay!",
        },
      };

      middlewares.validateReview(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("validateReview throws ExpressError on invalid rating or missing comment", () => {
      req.body = { review: { rating: 10 } };

      expect(() => {
        middlewares.validateReview(req, res, next);
      }).toThrow(ExpressError);
    });
  });
});
