process.env.NODE_ENV = "test";
process.env.SECRET = "testsecretkeyforjestblackbox";
process.env.MAP_TOKEN = "pk.testtoken";

const request = require("supertest");
const Listing = require("../../models/listing");
const Review = require("../../models/review");

jest.mock("../../models/listing");
jest.mock("../../models/review");
jest.mock("@mapbox/mapbox-sdk/services/geocoding", () => {
  return jest.fn().mockImplementation(() => ({
    forwardGeocode: jest.fn().mockReturnValue({
      send: jest.fn().mockResolvedValue({
        body: {
          features: [{ geometry: { type: "Point", coordinates: [0, 0] } }],
        },
      }),
    }),
  }));
});

const app = require("../../app");

describe("Black-Box Testing: Specification & Functional API Suite", () => {
  describe("Specification 1: Public Routes & Navigation Verification", () => {
    test("GET / should redirect to /listings (302 Found)", async () => {
      const response = await request(app).get("/");
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/listings");
    });

    test("GET /listings should return HTTP 200 OK with HTML content", async () => {
      Listing.find.mockResolvedValue([
        {
          _id: "507f1f77bcf86cd799439011",
          title: "Seaside Villa",
          description: "Overlooking the ocean",
          price: 1500,
          location: "Goa",
          country: "India",
          image: { url: "https://example.com/beach.jpg" },
        },
      ]);

      const response = await request(app).get("/listings");
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/html/);
    });

    test("GET /login should display user login page (200 OK)", async () => {
      const response = await request(app).get("/login");
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/html/);
    });

    test("GET /signup should display user registration page (200 OK)", async () => {
      const response = await request(app).get("/signup");
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/html/);
    });

    test("GET /listings/search with valid query parameter returns 200 OK", async () => {
      Listing.find.mockResolvedValue([
        {
          _id: "507f1f77bcf86cd799439012",
          title: "Mountain Cabin",
          category: "Mountains",
          price: 1200,
          image: { url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470", filename: "cabin" },
          location: "Shimla",
          country: "India",
        },
      ]);

      const response = await request(app).get("/listings/search?q=Mountain");
      expect(response.status).toBe(200);
    });

    test("GET /listings/search with blank query redirects back to /listings (302)", async () => {
      const response = await request(app).get("/listings/search?q=%20%20");
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/listings");
    });

    test("GET /listings/filter/:id with matching category returns 200 OK", async () => {
      Listing.find.mockResolvedValue([
        {
          _id: "507f1f77bcf86cd799439013",
          title: "Trending Resort",
          category: "Trending",
          price: 3000,
          image: { url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470", filename: "resort" },
          location: "Goa",
          country: "India",
        },
      ]);

      const response = await request(app).get("/listings/filter/Trending");
      expect(response.status).toBe(200);
    });

    test("GET /listings/filter/:id with empty category redirects to /listings", async () => {
      Listing.find.mockResolvedValue([]);

      const response = await request(app).get("/listings/filter/UnknownCategory");
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/listings");
    });
  });

  describe("Specification 2: Access Control & Security Verification (Unauthenticated Requests)", () => {
    test("GET /listings/new must be protected: redirects unauthenticated user to /login", async () => {
      const response = await request(app).get("/listings/new");
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    test("POST /listings must be protected: rejects unauthenticated creation", async () => {
      const response = await request(app).post("/listings").send({
        listing: {
          title: "Unauthorized Listing",
          price: 100,
        },
      });
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    test("GET /listings/:id/edit must be protected: redirects unauthenticated user to /login", async () => {
      const response = await request(app).get("/listings/507f1f77bcf86cd799439011/edit");
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    test("DELETE /listings/:id must be protected: rejects unauthenticated deletion", async () => {
      const response = await request(app).delete("/listings/507f1f77bcf86cd799439011");
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    test("POST /listings/:id/reviews must be protected: redirects unauthenticated review post to /login", async () => {
      const response = await request(app)
        .post("/listings/507f1f77bcf86cd799439011/reviews")
        .send({
          review: { rating: 5, comment: "Nice" },
        });
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    test("DELETE /listings/:id/reviews/:reviewId must be protected: redirects to /login", async () => {
      const response = await request(app).delete(
        "/listings/507f1f77bcf86cd799439011/reviews/507f191e810c19729de860ea"
      );
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });
  });

  describe("Specification 3: Robustness & Non-Existent Resources", () => {
    test("GET to an arbitrary non-existent route returns HTTP 404", async () => {
      const response = await request(app).get("/non-existent-endpoint-random-xyz");
      expect(response.status).toBe(404);
      expect(response.text).toContain("Page Not Found!");
    });

    test("GET /logout redirects to /listings", async () => {
      const response = await request(app).get("/logout");
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/listings");
    });
  });
});
