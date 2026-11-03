process.env.NODE_ENV = "test";
process.env.SECRET = "testsecretkeyforjestsystem";

const request = require("supertest");
const app = require("../../app");
const { connectDB, clearDB, closeDB, createTestUser, createTestListing } = require("../testHelper");

describe("System Testing: End-to-End Traveler Journey", () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterEach(async () => {
    await clearDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  test("Complete Traveler Lifecycle: Discovery -> Search -> Category Filter -> Auth -> Reservation -> Review", async () => {
    // 0. Seed Host and Listings in system
    const host = await createTestUser("host_system", "hostsys@test.com");
    const listing1 = await createTestListing(host._id, {
      title: "Lake Palace Villa",
      location: "Udaipur",
      category: "Trending",
      price: 5000,
    });
    const listing2 = await createTestListing(host._id, {
      title: "Pine Mountain Lodge",
      location: "Manali",
      category: "Mountains",
      price: 3000,
    });

    const traveler = request.agent(app);

    // Step 1: Root redirect verification
    const rootRes = await traveler.get("/");
    expect(rootRes.status).toBe(302);
    expect(rootRes.headers.location).toBe("/listings");

    // Step 2: Browse Listings Catalog
    const catalogRes = await traveler.get("/listings");
    expect(catalogRes.status).toBe(200);
    expect(catalogRes.text).toContain("Lake Palace Villa");
    expect(catalogRes.text).toContain("Pine Mountain Lodge");

    // Step 3: Search for specific destination
    const searchRes = await traveler.get("/listings/search?q=Lake");
    expect(searchRes.status).toBe(200);
    expect(searchRes.text).toContain("Lake Palace Villa");

    // Step 4: Filter by category
    const filterRes = await traveler.get("/listings/filter/Trending");
    expect(filterRes.status).toBe(200);
    expect(filterRes.text).toContain("Lake Palace Villa");

    // Step 5: View listing details
    const showRes = await traveler.get(`/listings/${listing1._id}`);
    expect(showRes.status).toBe(200);
    expect(showRes.text).toContain("Lake Palace Villa");

    // Step 6: Guest attempts reservation while unauthenticated -> redirected to login
    const unauthReserveRes = await traveler.get(`/listings/${listing1._id}/reservelisting`);
    expect(unauthReserveRes.status).toBe(302);
    expect(unauthReserveRes.headers.location).toBe("/login");

    // Step 7: Traveler registers an account
    const signupRes = await traveler
      .post("/signup")
      .type("form")
      .send({
        username: "globetrotter",
        email: "traveler@example.com",
        password: "Adventure2026!",
      });
    expect(signupRes.status).toBe(302);

    // Step 8: Authenticated traveler reserves the accommodation
    const authReserveRes = await traveler.get(`/listings/${listing1._id}/reservelisting`);
    expect(authReserveRes.status).toBe(302);
    expect(authReserveRes.headers.location).toBe(`/listings/${listing1._id}`);

    // Step 9: Traveler writes a review
    const reviewRes = await traveler
      .post(`/listings/${listing1._id}/reviews`)
      .type("form")
      .send({
        review: {
          rating: 5,
          comment: "Spectacular palace stay, royal treatment!",
        },
      });
    expect(reviewRes.status).toBe(302);
    expect(reviewRes.headers.location).toBe(`/listings/${listing1._id}`);

    // Step 10: Traveler visits listing and sees their review rendered
    const finalShowRes = await traveler.get(`/listings/${listing1._id}`);
    expect(finalShowRes.status).toBe(200);
    expect(finalShowRes.text).toContain("Spectacular palace stay, royal treatment!");

    // Step 11: Traveler logs out
    const logoutRes = await traveler.get("/logout");
    expect(logoutRes.status).toBe(302);
    expect(logoutRes.headers.location).toBe("/listings");
  });
});
