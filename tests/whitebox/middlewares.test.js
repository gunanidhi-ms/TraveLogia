const middlewares = require("../../middlewares");
const Listing = require("../../models/listing");
const Review = require("../../models/review");
const ExpressError = require("../../utils/ExpressError");

jest.mock("../../models/listing");
jest.mock("../../models/review");

describe("White-Box: Middlewares Branch & Decision Coverage", () => {
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

  describe("isLoggedIn Middleware", () => {
    test("Branch 1: req.isAuthenticated() is true -> calls next()", () => {
      req.isAuthenticated.mockReturnValue(true);
      middlewares.isLoggedIn(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.redirect).not.toHaveBeenCalled();
    });

    test("Branch 2: req.isAuthenticated() is false -> sets redirectUrl, flashes error, redirects /login", () => {
      req.isAuthenticated.mockReturnValue(false);
      middlewares.isLoggedIn(req, res, next);

      expect(req.session.redirectUrl).toBe("/listings/123/edit");
      expect(req.flash).toHaveBeenCalledWith("error", "You must be logged in!");
      expect(res.redirect).toHaveBeenCalledWith("/login");
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("saveRedirectUrl Middleware", () => {
    test("Branch 1: req.session.redirectUrl is set -> copies to res.locals", () => {
      req.session.redirectUrl = "/listings/new";
      middlewares.saveRedirectUrl(req, res, next);

      expect(res.locals.redirectUrl).toBe("/listings/new");
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("Branch 2: req.session.redirectUrl is undefined -> proceeds without setting res.locals", () => {
      middlewares.saveRedirectUrl(req, res, next);

      expect(res.locals.redirectUrl).toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("validateListing Middleware", () => {
    test("Branch 1: valid listing in body -> calls next()", () => {
      req.body = {
        listing: {
          title: "Hilltop Cottage",
          description: "Peaceful getaway",
          image: { url: "http://example.com/img.jpg" },
          price: 200,
          location: "Manali",
          country: "India",
          category: "Mountains",
        },
      };

      middlewares.validateListing(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("Branch 2: invalid listing in body -> throws ExpressError with statusCode 400", () => {
      req.body = { listing: { title: "Incomplete" } };

      expect(() => {
        middlewares.validateListing(req, res, next);
      }).toThrow(ExpressError);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("validateReview Middleware", () => {
    test("Branch 1: valid review in body -> calls next()", () => {
      req.body = {
        review: {
          rating: 5,
          comment: "Superb experience!",
        },
      };

      middlewares.validateReview(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("Branch 2: invalid review in body -> throws ExpressError with statusCode 400", () => {
      req.body = { review: { rating: 10 } }; // exceeds max 5 and missing comment

      expect(() => {
        middlewares.validateReview(req, res, next);
      }).toThrow(ExpressError);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("isOwner Middleware", () => {
    test("Branch 1: listing not found -> flashes error & redirects to /listings", async () => {
      req.params.id = "nonexistent123";
      Listing.findById.mockResolvedValue(null);

      await middlewares.isOwner(req, res, next);

      expect(Listing.findById).toHaveBeenCalledWith("nonexistent123");
      expect(req.flash).toHaveBeenCalledWith("error", "Listing not found!");
      expect(res.redirect).toHaveBeenCalledWith("/listings");
      expect(next).not.toHaveBeenCalled();
    });

    test("Branch 2: user is NOT the owner -> flashes error & redirects to /listings/:id", async () => {
      req.params.id = "list123";
      const mockListing = {
        owner: {
          equals: jest.fn().mockReturnValue(false),
        },
      };
      Listing.findById.mockResolvedValue(mockListing);

      await middlewares.isOwner(req, res, next);

      expect(mockListing.owner.equals).toHaveBeenCalledWith("user123");
      expect(req.flash).toHaveBeenCalledWith("error", "You are not the owner of this listing!");
      expect(res.redirect).toHaveBeenCalledWith("/listings/list123");
      expect(next).not.toHaveBeenCalled();
    });

    test("Branch 3: user IS the owner -> calls next()", async () => {
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
  });

  describe("isReviewAuthor Middleware", () => {
    test("Branch 1: review not found -> flashes error & redirects to /listings/:id", async () => {
      req.params.id = "list123";
      req.params.reviewId = "rev999";
      Review.findById.mockResolvedValue(null);

      await middlewares.isReviewAuthor(req, res, next);

      expect(Review.findById).toHaveBeenCalledWith("rev999");
      expect(req.flash).toHaveBeenCalledWith("error", "Review not found!");
      expect(res.redirect).toHaveBeenCalledWith("/listings/list123");
      expect(next).not.toHaveBeenCalled();
    });

    test("Branch 2: user is NOT author -> flashes error & redirects to /listings/:id", async () => {
      req.params.id = "list123";
      req.params.reviewId = "rev123";
      const mockReview = {
        author: {
          equals: jest.fn().mockReturnValue(false),
        },
      };
      Review.findById.mockResolvedValue(mockReview);

      await middlewares.isReviewAuthor(req, res, next);

      expect(mockReview.author.equals).toHaveBeenCalledWith("user123");
      expect(req.flash).toHaveBeenCalledWith("error", "You are not the author of this review!");
      expect(res.redirect).toHaveBeenCalledWith("/listings/list123");
      expect(next).not.toHaveBeenCalled();
    });

    test("Branch 3: user IS author -> calls next()", async () => {
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
      expect(res.redirect).not.toHaveBeenCalled();
    });
  });
});
