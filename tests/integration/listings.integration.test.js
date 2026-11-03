process.env.NODE_ENV = "test";
process.env.SECRET = "testsecretkeyforjestintegration";

const request = require("supertest");
const app = require("../../app");
const Listing = require("../../models/listing");
const Review = require("../../models/review");
const User = require("../../models/user");
const { connectDB, clearDB, closeDB, createTestUser, createTestListing, createTestReview } = require("../testHelper");

describe("Integration Testing: Listings Multi-Tier Operations", () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterEach(async () => {
    await clearDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  test("GET /listings: retrieves catalog of stored listings from DB", async () => {
    const user = await createTestUser("hostuser", "host@example.com");
    await createTestListing(user._id, { title: "Lakeside Haven", location: "Udaipur" });
    await createTestListing(user._id, { title: "Desert Oasis", location: "Jaisalmer" });

    const response = await request(app).get("/listings");
    expect(response.status).toBe(200);
    expect(response.text).toContain("Lakeside Haven");
    expect(response.text).toContain("Desert Oasis");
  });

  test("GET /listings/:id: retrieves detailed listing with populated owner and reviews", async () => {
    const owner = await createTestUser("villaowner", "villa@example.com");
    const reviewer = await createTestUser("reviewer1", "rev1@example.com");

    const review = await createTestReview(reviewer._id, { comment: "Unbelievable sunset view!", rating: 5 });
    const listing = await createTestListing(owner._id, {
      title: "Cliffside Sunset Villa",
      reviews: [review._id],
    });

    const response = await request(app).get(`/listings/${listing._id}`);
    expect(response.status).toBe(200);
    expect(response.text).toContain("Cliffside Sunset Villa");
    expect(response.text).toContain("villaowner");
    expect(response.text).toContain("Unbelievable sunset view!");
  });

  test("POST /listings: creates new listing in DB and associates with authenticated user", async () => {
    const agent = request.agent(app);
    // 1. Sign up and login
    await agent
      .post("/signup")
      .type("form")
      .send({ username: "creator", email: "creator@test.com", password: "Password123!" });

    // 2. Submit listing creation
    const response = await agent
      .post("/listings")
      .field("listing[title]", "Pine Forest Cabin")
      .field("listing[description]", "Surrounded by deodar pines")
      .field("listing[price]", 3200)
      .field("listing[location]", "Kasol")
      .field("listing[country]", "India")
      .field("listing[category]", "Mountains");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/listings");

    // 3. Verify in database
    const created = await Listing.findOne({ title: "Pine Forest Cabin" });
    expect(created).not.toBeNull();
    expect(created.price).toBe(3200);
    expect(created.geometry).toBeDefined();
    expect(created.geometry.type).toBe("Point");
    expect(created.owner).toBeDefined();
  });

  test("PUT /listings/:id: allows owner to update listing details", async () => {
    const agent = request.agent(app);
    await agent
      .post("/signup")
      .type("form")
      .send({ username: "editowner", email: "editowner@test.com", password: "Password123!" });

    const owner = await User.findOne({ username: "editowner" });
    const listing = await createTestListing(owner._id, { title: "Old Title", price: 1000 });

    const updateResponse = await agent
      .put(`/listings/${listing._id}`)
      .field("listing[title]", "Updated Luxury Title")
      .field("listing[description]", "Newly renovated")
      .field("listing[price]", 2000)
      .field("listing[location]", "Goa")
      .field("listing[country]", "India")
      .field("listing[category]", "Trending");

    expect(updateResponse.status).toBe(302);
    expect(updateResponse.headers.location).toBe(`/listings/${listing._id}`);

    // Verify in database
    const updated = await Listing.findById(listing._id);
    expect(updated.title).toBe("Updated Luxury Title");
    expect(updated.price).toBe(2000);
  });

  test("PUT /listings/:id: non-owner is blocked from modifying another user's listing", async () => {
    // Owner creates listing
    const realOwner = await createTestUser("realowner", "real@test.com");
    const listing = await createTestListing(realOwner._id, { title: "Immutable Title", price: 1000 });

    // Different user logs in
    const agent = request.agent(app);
    await agent
      .post("/signup")
      .type("form")
      .send({ username: "intruder", email: "intruder@test.com", password: "Password123!" });

    const response = await agent
      .put(`/listings/${listing._id}`)
      .field("listing[title]", "Hacked Title")
      .field("listing[description]", "Hacked desc")
      .field("listing[price]", 9999)
      .field("listing[location]", "Nowhere")
      .field("listing[country]", "Nowhere")
      .field("listing[category]", "Trending");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(`/listings/${listing._id}`);

    // Verify DB was untouched
    const checkListing = await Listing.findById(listing._id);
    expect(checkListing.title).toBe("Immutable Title");
    expect(checkListing.price).toBe(1000);
  });

  test("DELETE /listings/:id: owner deletes listing and cascade removes all associated reviews", async () => {
    const agent = request.agent(app);
    await agent
      .post("/signup")
      .type("form")
      .send({ username: "deleteowner", email: "delowner@test.com", password: "Password123!" });

    const owner = await User.findOne({ username: "deleteowner" });
    const review1 = await createTestReview(owner._id, { comment: "Great 1" });
    const review2 = await createTestReview(owner._id, { comment: "Great 2" });

    const listing = await createTestListing(owner._id, {
      title: "Listing To Delete",
      reviews: [review1._id, review2._id],
    });

    // Delete listing
    const response = await agent.delete(`/listings/${listing._id}`);
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/listings");

    // Verify listing is removed
    const foundListing = await Listing.findById(listing._id);
    expect(foundListing).toBeNull();

    // Verify reviews are cascade deleted from Reviews collection
    const reviewCount = await Review.countDocuments({ _id: { $in: [review1._id, review2._id] } });
    expect(reviewCount).toBe(0);
  });

  test("GET /listings/search: finds listings matching keyword query in DB", async () => {
    const user = await createTestUser("searchhost", "search@test.com");
    await createTestListing(user._id, { title: "Himalayan Hideout", location: "Manali" });
    await createTestListing(user._id, { title: "Coastal Bungalow", location: "Goa" });

    const response = await request(app).get("/listings/search?q=Himalayan");
    expect(response.status).toBe(200);
    expect(response.text).toContain("Himalayan Hideout");
    expect(response.text).not.toContain("Coastal Bungalow");
  });

  test("GET /listings/filter/:id: filters listings by category in DB", async () => {
    const user = await createTestUser("filterhost", "filter@test.com");
    await createTestListing(user._id, { title: "Beach House", category: "Trending" });
    await createTestListing(user._id, { title: "Mountain Loft", category: "Mountains" });

    const response = await request(app).get("/listings/filter/Trending");
    expect(response.status).toBe(200);
    expect(response.text).toContain("Beach House");
    expect(response.text).not.toContain("Mountain Loft");
  });
});
