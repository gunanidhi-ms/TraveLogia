const listingsController = require("../../controllers/listings");
const usersController = require("../../controllers/users");
const Listing = require("../../models/listing");
const User = require("../../models/user");

jest.mock("../../models/listing");
jest.mock("../../models/user");
jest.mock("@mapbox/mapbox-sdk/services/geocoding", () => {
  return jest.fn().mockImplementation(() => ({
    forwardGeocode: jest.fn().mockReturnValue({
      send: jest.fn().mockResolvedValue({
        body: {
          features: [{ geometry: { type: "Point", coordinates: [77.2, 28.6] } }],
        },
      }),
    }),
  }));
});

describe("White-Box: Controller Path, Logic & Branch Coverage", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: {},
      query: {},
      body: {},
      session: {},
      flash: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      user: { _id: "user123" },
    };
    res = {
      render: jest.fn(),
      redirect: jest.fn(),
      locals: {},
    };
    next = jest.fn();
  });

  describe("listingsController.search Logic Branches", () => {
    test("Branch 1: Empty search input triggers flash error and redirect", async () => {
      req.query.q = "   ";
      await listingsController.search(req, res);

      expect(req.flash).toHaveBeenCalledWith("error", "Please enter search query!");
      expect(res.redirect).toHaveBeenCalledWith("/listings");
    });

    test("Branch 2: Matches by Title on capitalized search term", async () => {
      req.query.q = "beach villa";
      const mockListings = [{ title: "Beach Villa", price: 1000 }];
      Listing.find.mockResolvedValueOnce(mockListings);

      await listingsController.search(req, res);

      expect(res.locals.success).toBe("Listings searched by Title!");
      expect(res.render).toHaveBeenCalledWith("listings/index.ejs", { allListings: mockListings });
    });

    test("Branch 3: Matches by Category when Title has no matches", async () => {
      req.query.q = "mountains";
      const mockListings = [{ title: "Peak Rest", category: "Mountains" }];
      // Title search → no results
      Listing.find.mockResolvedValueOnce([]);
      // Category search + .sort() → results
      Listing.find.mockReturnValueOnce({
        sort: jest.fn().mockResolvedValueOnce(mockListings),
      });

      await listingsController.search(req, res);

      expect(res.locals.success).toBe("Listings searched by Category!");
      expect(res.render).toHaveBeenCalledWith("listings/index.ejs", { allListings: mockListings });
    });

    test("Branch 4: Matches by Numeric Price when query is integer and text search fails", async () => {
      req.query.q = "500";
      const mockListings = [{ title: "Budget Room", price: 400 }];
      // Title → []
      Listing.find.mockResolvedValueOnce([]);
      // Category + sort → []
      Listing.find.mockReturnValueOnce({ sort: jest.fn().mockResolvedValueOnce([]) });
      // Country + sort → []
      Listing.find.mockReturnValueOnce({ sort: jest.fn().mockResolvedValueOnce([]) });
      // Location + sort → []
      Listing.find.mockReturnValueOnce({ sort: jest.fn().mockResolvedValueOnce([]) });
      // Price + sort → results
      Listing.find.mockReturnValueOnce({ sort: jest.fn().mockResolvedValueOnce(mockListings) });

      await listingsController.search(req, res);

      expect(res.locals.success).toBe("Listings searched by price less than Rs 500!");
      expect(res.render).toHaveBeenCalledWith("listings/index.ejs", { allListings: mockListings });
    });

    test("Branch 5: No matching listings found across all criteria", async () => {
      req.query.q = "NonExistentTerm";
      Listing.find.mockResolvedValueOnce([]); // Title
      Listing.find.mockReturnValueOnce({ sort: jest.fn().mockResolvedValueOnce([]) }); // Category
      Listing.find.mockReturnValueOnce({ sort: jest.fn().mockResolvedValueOnce([]) }); // Country
      Listing.find.mockReturnValueOnce({ sort: jest.fn().mockResolvedValueOnce([]) }); // Location

      await listingsController.search(req, res);

      expect(req.flash).toHaveBeenCalledWith("error", "No listings found based on your search!");
      expect(res.redirect).toHaveBeenCalledWith("/listings");
    });
  });

  describe("listingsController CRUD Handlers", () => {
    test("index renders all listings", async () => {
      const mockListings = [{ title: "Listing 1" }, { title: "Listing 2" }];
      // Listing.find() returns a Mongoose Query; mock it as a thenable that resolves directly
      Listing.find.mockResolvedValue(mockListings);

      await listingsController.index(req, res);

      expect(res.render).toHaveBeenCalledWith("./listings/index.ejs", { allListings: mockListings });
    });

    test("showListing renders listing with populated reviews and owner", async () => {
      req.params.id = "list123";
      const mockListing = { title: "Showcase" };
      Listing.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockListing),
        }),
      });

      await listingsController.showListing(req, res);

      expect(res.render).toHaveBeenCalledWith("listings/show.ejs", { listing: mockListing });
    });

    test("filter renders listings matching category ID", async () => {
      req.params.id = "Trending";
      const mockListings = [{ title: "Trending Place" }];
      Listing.find.mockResolvedValue(mockListings);

      await listingsController.filter(req, res, next);

      // filter() sets res.locals.success directly on the real res object
      expect(res.locals.success).toBe("Listings Filtered by Trending!");
      expect(res.render).toHaveBeenCalledWith("listings/index.ejs", { allListings: mockListings });
    });

    test("reserveListing sets flash message and redirects", async () => {
      req.params.id = "list123";

      await listingsController.reserveListing(req, res);

      expect(req.flash).toHaveBeenCalledWith("success", "Reservation Details sent to your Email!");
      expect(res.redirect).toHaveBeenCalledWith("/listings/list123");
    });
  });

  describe("usersController Handlers", () => {
    test("signup success registers user and logs in", async () => {
      req.body = { username: "alice", email: "alice@test.com", password: "Password123" };
      const registeredUser = { _id: "aliceId", username: "alice" };
      User.register.mockResolvedValue(registeredUser);
      req.login.mockImplementation((user, cb) => cb(null));

      await usersController.signup(req, res);

      expect(User.register).toHaveBeenCalled();
      expect(req.flash).toHaveBeenCalledWith("success", "Welcome to WanderLust!");
      expect(res.redirect).toHaveBeenCalledWith("/listings");
    });

    test("signup error triggers catch block and flash error", async () => {
      req.body = { username: "existing", email: "existing@test.com", password: "123" };
      User.register.mockRejectedValue(new Error("A user with the given username is already registered"));

      await usersController.signup(req, res);

      expect(req.flash).toHaveBeenCalledWith("error", "A user with the given username is already registered");
      expect(res.redirect).toHaveBeenCalledWith("/signup");
    });

    test("login uses redirectUrl when available or defaults to /listings", async () => {
      res.locals.redirectUrl = "/listings/new";

      await usersController.login(req, res);

      expect(req.flash).toHaveBeenCalledWith("success", "Welcome back to WanderLustust!");
      expect(res.redirect).toHaveBeenCalledWith("/listings/new");
    });

    test("logout invokes req.logout and redirects with success", () => {
      req.logout.mockImplementation((cb) => cb(null));

      usersController.logout(req, res, next);

      expect(req.flash).toHaveBeenCalledWith("success", "You are logged out!");
      expect(res.redirect).toHaveBeenCalledWith("/listings");
    });

    test("logout error forwards to next(err)", () => {
      const err = new Error("Logout failed");
      req.logout.mockImplementation((cb) => cb(err));

      usersController.logout(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
