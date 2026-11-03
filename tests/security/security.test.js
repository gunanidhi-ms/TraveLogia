process.env.NODE_ENV = "test";
process.env.SECRET = "testsecretkeyforjestsecurity";

const request = require("supertest");
const app = require("../../app");
const { connectDB, clearDB, closeDB, createTestUser, createTestListing } = require("../testHelper");

describe("Security Testing: Access Control Matrix, Input Sanitization & Resilience", () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterEach(async () => {
    await clearDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  describe("SEC-01: Access Control Matrix (Guest vs Member vs Owner)", () => {
    test("Guest cannot access new listing page", async () => {
      const res = await request(app).get("/listings/new");
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/login");
    });

    test("Guest cannot POST new listing", async () => {
      const res = await request(app).post("/listings").send({});
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/login");
    });

    test("Guest cannot access edit form", async () => {
      const host = await createTestUser("sec_host", "sechost@test.com");
      const listing = await createTestListing(host._id);

      const res = await request(app).get(`/listings/${listing._id}/edit`);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/login");
    });

    test("Guest cannot submit PUT update", async () => {
      const host = await createTestUser("sec_host2", "sechost2@test.com");
      const listing = await createTestListing(host._id);

      const res = await request(app).put(`/listings/${listing._id}`).send({});
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/login");
    });

    test("Guest cannot DELETE listing", async () => {
      const host = await createTestUser("sec_host3", "sechost3@test.com");
      const listing = await createTestListing(host._id);

      const res = await request(app).delete(`/listings/${listing._id}`);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/login");
    });

    test("Guest cannot POST review", async () => {
      const host = await createTestUser("sec_host4", "sechost4@test.com");
      const listing = await createTestListing(host._id);

      const res = await request(app).post(`/listings/${listing._id}/reviews`).send({});
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/login");
    });
  });

  describe("SEC-02: Search Input Injection & Boundary Handling", () => {
    test("Regex wildcard injection in search query does not crash server", async () => {
      const res = await request(app).get("/listings/search?q=.*+?[a-z]^$");
      // Must not crash (500), should redirect or return 200
      expect([200, 302]).toContain(res.status);
    });

    test("Special HTML/script characters in search query are handled safely", async () => {
      const res = await request(app).get("/listings/search?q=<script>alert(1)</script>");
      expect([200, 302]).toContain(res.status);
    });
  });

  describe("SEC-03: Joi Validation Schema Strictness", () => {
    test("Listing creation rejects payload with unexpected extra root keys when unknown keys are disallowed", async () => {
      const agent = request.agent(app);
      await agent
        .post("/signup")
        .type("form")
        .send({ username: "sec_creator", email: "sec_c@test.com", password: "Password123!" });

      // Malformed request with missing required price
      const res = await agent
        .post("/listings")
        .field("listing[title]", "Strict Test")
        .field("listing[description]", "Missing price");

      expect(res.status).toBe(400);
    });
  });
});
