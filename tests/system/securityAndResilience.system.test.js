process.env.NODE_ENV = "test";
process.env.SECRET = "testsecretkeyforjestsystem";

const request = require("supertest");
const app = require("../../app");
const { connectDB, clearDB, closeDB } = require("../testHelper");

describe("System Testing: System Security, Resilience & Error Boundaries", () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterEach(async () => {
    await clearDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  describe("System 404 Routing & Error Handler", () => {
    test("GET to an arbitrary non-existent endpoint yields 404 status and error view", async () => {
      const response = await request(app).get("/api/v1/invalid/random-route-999");
      expect(response.status).toBe(404);
      expect(response.text).toContain("Page Not Found!");
    });
  });

  describe("Access Control & Protection Matrix", () => {
    test("POST /listings is blocked for unauthenticated guest", async () => {
      const response = await request(app)
        .post("/listings")
        .type("form")
        .send({
          listing: {
            title: "Unauthorized Title",
            description: "Test",
            price: 100,
            location: "Nowhere",
            country: "Nowhere",
            category: "Rooms",
          },
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    test("DELETE /listings/:id is blocked for unauthenticated guest", async () => {
      const response = await request(app).delete("/listings/507f1f77bcf86cd799439011");
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    test("POST /listings/:id/reviews is blocked for unauthenticated guest", async () => {
      const response = await request(app)
        .post("/listings/507f1f77bcf86cd799439011/reviews")
        .type("form")
        .send({ review: { rating: 5, comment: "Unauthorized" } });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });
  });

  describe("Resilience Against Missing or Invalid Resources", () => {
    test("GET /listings/:id with non-existent ObjectId redirects gracefully to /listings with flash", async () => {
      const nonExistentValidId = "507f1f77bcf86cd799439099";
      const response = await request(app).get(`/listings/${nonExistentValidId}`);
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/listings");
    });

    test("GET /listings/:id with invalid hex string triggers error boundary without crash", async () => {
      const response = await request(app).get("/listings/invalid-hex-id-xyz");
      // Mongoose CastError caught by error handling middleware
      expect([500, 400, 404]).toContain(response.status);
    });
  });

  describe("Flash Notification Propagation Across Redirects", () => {
    test("flash message survives across 302 redirect cycle", async () => {
      const agent = request.agent(app);

      // Trigger redirect to login
      const res1 = await agent.get("/listings/new");
      expect(res1.status).toBe(302);
      expect(res1.headers.location).toBe("/login");

      // Follow redirect to /login: flash message "You must be logged in!" should render
      const res2 = await agent.get("/login");
      expect(res2.status).toBe(200);
      expect(res2.text).toContain("You must be logged in!");
    });

    test("Security Cookie Policy: session cookie is configured with httpOnly protection", async () => {
      const res = await request(app).get("/listings");
      const cookies = res.headers["set-cookie"] || [];
      expect(cookies.some((cookie) => cookie.includes("HttpOnly"))).toBe(true);
    });
  });
});

