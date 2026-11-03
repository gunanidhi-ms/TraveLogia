process.env.NODE_ENV = "test";
process.env.SECRET = "testsecretkeyforjestacceptance";

const request = require("supertest");
const app = require("../../app");
const Listing = require("../../models/listing");
const Review = require("../../models/review");
const { connectDB, clearDB, closeDB, createTestUser, createTestListing, createTestReview } = require("../testHelper");

describe("Acceptance Testing: Business Requirements & User Acceptance Criteria (UAT)", () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterEach(async () => {
    await clearDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  describe("US-01: Marketplace Accommodation Discovery & Filtering", () => {
    test("AC-1.1: Travelers can browse public accommodations without mandatory authentication", async () => {
      const host = await createTestUser("host_uat", "hostuat@test.com");
      await createTestListing(host._id, { title: "Open Air Pavilion" });

      const res = await request(app).get("/listings");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Open Air Pavilion");
    });

    test("AC-1.2: Travelers can search listings by keyword query across Title and Category", async () => {
      const host = await createTestUser("search_host", "searchhost@test.com");
      await createTestListing(host._id, { title: "Heritage Haveli", category: "Iconic Cities" });

      const res = await request(app).get("/listings/search?q=Heritage");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Heritage Haveli");
    });

    test("AC-1.3: Submitting blank search prompts user to enter a query and redirects to /listings", async () => {
      const res = await request(app).get("/listings/search?q=%20%20");
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/listings");
    });

    test("AC-1.4: Filtering by category returns exclusively matching listings", async () => {
      const host = await createTestUser("filter_host", "filterhost@test.com");
      await createTestListing(host._id, { title: "Mountaineer Hut", category: "Mountains" });
      await createTestListing(host._id, { title: "Seaside Villa", category: "Trending" });

      const res = await request(app).get("/listings/filter/Mountains");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Mountaineer Hut");
      expect(res.text).not.toContain("Seaside Villa");
    });
  });

  describe("US-02: Property Listing Submission & Validation Acceptance", () => {
    test("AC-2.1: Authenticated host can publish an accommodation with title, description, price, location, country, category", async () => {
      const host = request.agent(app);
      await host
        .post("/signup")
        .type("form")
        .send({ username: "verified_host", email: "vhost@test.com", password: "Password123!" });

      const createRes = await host
        .post("/listings")
        .field("listing[title]", "Verified Host Lodge")
        .field("listing[description]", "Comfortable lodging with mountain backdrop")
        .field("listing[price]", 2800)
        .field("listing[location]", "Manali")
        .field("listing[country]", "India")
        .field("listing[category]", "Mountains");

      expect(createRes.status).toBe(302);
      expect(createRes.headers.location).toBe("/listings");

      const saved = await Listing.findOne({ title: "Verified Host Lodge" });
      expect(saved).not.toBeNull();
      expect(saved.price).toBe(2800);
    });

    test("AC-2.2: Submitting invalid listing with negative price is rejected with 400 Bad Request", async () => {
      const host = request.agent(app);
      await host
        .post("/signup")
        .type("form")
        .send({ username: "negprice_host", email: "neghost@test.com", password: "Password123!" });

      const failRes = await host
        .post("/listings")
        .field("listing[title]", "Negative Price Property")
        .field("listing[description]", "Invalid price test")
        .field("listing[price]", -500)
        .field("listing[location]", "Delhi")
        .field("listing[country]", "India")
        .field("listing[category]", "Rooms");

      expect(failRes.status).toBe(400);
    });
  });

  describe("US-03: Security & Access Control Acceptance Criteria", () => {
    test("AC-3.1: Only the property owner can edit their listing", async () => {
      const host1 = await createTestUser("owner_alice", "alice@test.com");
      const listing = await createTestListing(host1._id, { title: "Alice's Chalet", price: 3000 });

      // Host 2 attempts to edit Alice's listing
      const host2 = request.agent(app);
      await host2
        .post("/signup")
        .type("form")
        .send({ username: "intruder_bob", email: "bob@test.com", password: "Password123!" });

      const unauthorizedRes = await host2
        .put(`/listings/${listing._id}`)
        .field("listing[title]", "Tampered Title")
        .field("listing[description]", "Tampered description")
        .field("listing[price]", 100)
        .field("listing[location]", "Goa")
        .field("listing[country]", "India")
        .field("listing[category]", "Trending");

      expect(unauthorizedRes.status).toBe(302);
      expect(unauthorizedRes.headers.location).toBe(`/listings/${listing._id}`);

      // Database integrity verified
      const checkListing = await Listing.findById(listing._id);
      expect(checkListing.title).toBe("Alice's Chalet");
    });

    test("AC-3.2: Only the review author can delete their review", async () => {
      const host = await createTestUser("host_charlie", "charlie@test.com");
      const reviewer = await createTestUser("reviewer_dave", "dave@test.com");

      const review = await createTestReview(reviewer._id, { comment: "Dave's honest review" });
      const listing = await createTestListing(host._id, { reviews: [review._id] });

      // Another user attempts to delete Dave's review
      const attacker = request.agent(app);
      await attacker
        .post("/signup")
        .type("form")
        .send({ username: "attacker_eve", email: "eve@test.com", password: "Password123!" });

      const delRes = await attacker.delete(`/listings/${listing._id}/reviews/${review._id}`);
      expect(delRes.status).toBe(302);

      // Verify review persists
      const checkReview = await Review.findById(review._id);
      expect(checkReview).not.toBeNull();
    });

    test("AC-3.3: unauthorized listing modification redirects with access restriction", async () => {
      const host1 = await createTestUser("owner_x", "ownerx@test.com");
      const listing = await createTestListing(host1._id, { title: "Chalet X" });

      const intruder = request.agent(app);
      await intruder
        .post("/signup")
        .type("form")
        .send({ username: "intruder_x", email: "intx@test.com", password: "Password123!" });

      const res = await intruder
        .put(`/listings/${listing._id}`)
        .field("listing[title]", "Hacked Chalet")
        .field("listing[description]", "Hacked desc")
        .field("listing[price]", 9999)
        .field("listing[location]", "Nowhere")
        .field("listing[country]", "Nowhere")
        .field("listing[category]", "Trending");

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(`/listings/${listing._id}`);
    });
  });

  describe("US-04: Community Reviews & Rating Boundaries Acceptance", () => {
    test("AC-4.1: Guests can submit reviews with ratings 1 to 5", async () => {
      const host = await createTestUser("host_frank", "frank@test.com");
      const listing = await createTestListing(host._id);

      const guest = request.agent(app);
      await guest
        .post("/signup")
        .type("form")
        .send({ username: "guest_grace", email: "grace@test.com", password: "Password123!" });

      const reviewRes = await guest
        .post(`/listings/${listing._id}/reviews`)
        .type("form")
        .send({
          review: { rating: 5, comment: "Exceptional views and breakfast!" },
        });

      expect(reviewRes.status).toBe(302);
      expect(reviewRes.headers.location).toBe(`/listings/${listing._id}`);

      const saved = await Review.findOne({ comment: "Exceptional views and breakfast!" });
      expect(saved).not.toBeNull();
      expect(saved.rating).toBe(5);
    });

    test("AC-4.2: Submitting a review with rating outside [1, 5] is rejected with 400 Bad Request", async () => {
      const host = await createTestUser("host_george", "george@test.com");
      const listing = await createTestListing(host._id);

      const guest = request.agent(app);
      await guest
        .post("/signup")
        .type("form")
        .send({ username: "guest_helen", email: "helen@test.com", password: "Password123!" });

      const invalidReviewRes = await guest
        .post(`/listings/${listing._id}/reviews`)
        .type("form")
        .send({
          review: { rating: 7, comment: "Rating too high!" },
        });

      expect(invalidReviewRes.status).toBe(400);
    });
  });

  describe("US-05: Booking & Reservation Flow Acceptance", () => {
    test("AC-5.1: Authenticated guest reserving a property receives confirmation feedback", async () => {
      const host = await createTestUser("host_ian", "ian@test.com");
      const listing = await createTestListing(host._id);

      const guest = request.agent(app);
      await guest
        .post("/signup")
        .type("form")
        .send({ username: "guest_jack", email: "jack@test.com", password: "Password123!" });

      const reserveRes = await guest.get(`/listings/${listing._id}/reservelisting`);
      expect(reserveRes.status).toBe(302);
      expect(reserveRes.headers.location).toBe(`/listings/${listing._id}`);
    });
  });
});
