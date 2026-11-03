process.env.NODE_ENV = "test";
process.env.SECRET = "testsecretkeyforjestintegration";

const request = require("supertest");
const app = require("../../app");
const Listing = require("../../models/listing");
const Review = require("../../models/review");
const User = require("../../models/user");
const { connectDB, clearDB, closeDB, createTestUser, createTestListing, createTestReview } = require("../testHelper");

describe("Integration Testing: Reviews Relational Lifecycle", () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterEach(async () => {
    await clearDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  test("POST /listings/:id/reviews: authenticated guest posts review, updates listing.reviews array and Review collection", async () => {
    const owner = await createTestUser("owneruser", "owner@test.com");
    const listing = await createTestListing(owner._id);

    const guestAgent = request.agent(app);
    await guestAgent
      .post("/signup")
      .type("form")
      .send({ username: "guestreviewer", email: "guest@test.com", password: "Password123!" });

    const response = await guestAgent
      .post(`/listings/${listing._id}/reviews`)
      .type("form")
      .send({
        review: {
          rating: 5,
          comment: "Unforgettable experience and great hospitality!",
        },
      });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(`/listings/${listing._id}`);

    // Verify Review in database
    const createdReview = await Review.findOne({ comment: "Unforgettable experience and great hospitality!" });
    expect(createdReview).not.toBeNull();
    expect(createdReview.rating).toBe(5);

    // Verify Review ID is attached to the Listing
    const updatedListing = await Listing.findById(listing._id);
    expect(updatedListing.reviews).toContainEqual(createdReview._id);
  });

  test("DELETE /listings/:id/reviews/:reviewId: author successfully deletes their review", async () => {
    const owner = await createTestUser("hostuser2", "host2@test.com");
    const listing = await createTestListing(owner._id);

    const authorAgent = request.agent(app);
    await authorAgent
      .post("/signup")
      .type("form")
      .send({ username: "myauthor", email: "myauthor@test.com", password: "Password123!" });

    const authorUser = await User.findOne({ username: "myauthor" });
    const review = await createTestReview(authorUser._id, { comment: "Review to be deleted" });

    listing.reviews.push(review._id);
    await listing.save();

    // Author sends DELETE
    const deleteResponse = await authorAgent.delete(`/listings/${listing._id}/reviews/${review._id}`);
    expect(deleteResponse.status).toBe(302);
    expect(deleteResponse.headers.location).toBe(`/listings/${listing._id}`);

    // Verify review is removed from database
    const foundReview = await Review.findById(review._id);
    expect(foundReview).toBeNull();

    // Verify review ID is removed from listing
    const refreshedListing = await Listing.findById(listing._id);
    expect(refreshedListing.reviews).not.toContainEqual(review._id);
  });

  test("DELETE /listings/:id/reviews/:reviewId: non-author is blocked from deleting review", async () => {
    const owner = await createTestUser("hostuser3", "host3@test.com");
    const author = await createTestUser("origauthor", "orig@test.com");
    const listing = await createTestListing(owner._id);

    const review = await createTestReview(author._id, { comment: "Protected review content" });
    listing.reviews.push(review._id);
    await listing.save();

    // Different user attempts to delete
    const strangerAgent = request.agent(app);
    await strangerAgent
      .post("/signup")
      .type("form")
      .send({ username: "stranger", email: "stranger@test.com", password: "Password123!" });

    const deleteResponse = await strangerAgent.delete(`/listings/${listing._id}/reviews/${review._id}`);
    expect(deleteResponse.status).toBe(302);
    expect(deleteResponse.headers.location).toBe(`/listings/${listing._id}`);

    // Verify review remains in database
    const preservedReview = await Review.findById(review._id);
    expect(preservedReview).not.toBeNull();
  });
});
