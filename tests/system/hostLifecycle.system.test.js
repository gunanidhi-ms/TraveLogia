process.env.NODE_ENV = "test";
process.env.SECRET = "testsecretkeyforjestsystem";

const request = require("supertest");
const app = require("../../app");
const Listing = require("../../models/listing");
const Review = require("../../models/review");
const { connectDB, clearDB, closeDB } = require("../testHelper");

describe("System Testing: End-to-End Host Lifecycle", () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterEach(async () => {
    await clearDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  test("Complete Host Lifecycle: Registration -> Property Publication -> Edit -> Guest Review -> Deletion & Cascade Clean", async () => {
    const hostAgent = request.agent(app);

    // Step 1: Host registration
    const registerRes = await hostAgent
      .post("/signup")
      .type("form")
      .send({
        username: "superhost_mike",
        email: "mike@hostingservice.com",
        password: "HostSecurePass1!",
      });
    expect(registerRes.status).toBe(302);
    expect(registerRes.headers.location).toBe("/listings");

    // Step 2: Host loads the new listing form
    const formRes = await hostAgent.get("/listings/new");
    expect(formRes.status).toBe(200);

    // Step 3: Host publishes new listing
    const createRes = await hostAgent
      .post("/listings")
      .field("listing[title]", "Riverside Wooden Cottage")
      .field("listing[description]", "Tranquil cabin beside flowing stream")
      .field("listing[price]", 4200)
      .field("listing[location]", "Kullu")
      .field("listing[country]", "India")
      .field("listing[category]", "Mountains");

    expect(createRes.status).toBe(302);
    expect(createRes.headers.location).toBe("/listings");

    // Retrieve created listing from database
    const createdListing = await Listing.findOne({ title: "Riverside Wooden Cottage" });
    expect(createdListing).not.toBeNull();
    const listingId = createdListing._id.toString();

    // Step 4: Verify listing appears in marketplace index
    const indexRes = await hostAgent.get("/listings");
    expect(indexRes.text).toContain("Riverside Wooden Cottage");

    // Step 5: Host loads edit page
    const editFormRes = await hostAgent.get(`/listings/${listingId}/edit`);
    expect(editFormRes.status).toBe(200);

    // Step 6: Host updates property pricing and title
    const updateRes = await hostAgent
      .put(`/listings/${listingId}`)
      .field("listing[title]", "Premium Riverside Cottage")
      .field("listing[description]", "Upgraded luxury wooden cabin")
      .field("listing[price]", 4800)
      .field("listing[location]", "Kullu")
      .field("listing[country]", "India")
      .field("listing[category]", "Mountains");

    expect(updateRes.status).toBe(302);
    expect(updateRes.headers.location).toBe(`/listings/${listingId}`);

    // Verify update rendered
    const showUpdatedRes = await hostAgent.get(`/listings/${listingId}`);
    expect(showUpdatedRes.text).toContain("Premium Riverside Cottage");

    // Step 7: A guest arrives and submits a review
    const guestAgent = request.agent(app);
    await guestAgent
      .post("/signup")
      .type("form")
      .send({ username: "travelling_sam", email: "sam@travel.com", password: "Password123!" });

    await guestAgent
      .post(`/listings/${listingId}/reviews`)
      .type("form")
      .send({
        review: { rating: 5, comment: "Peaceful stay by the river" },
      });

    // Check review count in DB
    const reviewsInDb = await Review.find({});
    expect(reviewsInDb.length).toBe(1);

    // Step 8: Host deletes the listing
    const deleteRes = await hostAgent.delete(`/listings/${listingId}`);
    expect(deleteRes.status).toBe(302);
    expect(deleteRes.headers.location).toBe("/listings");

    // Step 9: Verify listing no longer exists
    const deletedListing = await Listing.findById(listingId);
    expect(deletedListing).toBeNull();

    // Verify cascade deletion wiped out the review
    const remainingReviews = await Review.find({});
    expect(remainingReviews.length).toBe(0);
  });
});
