const mongoose = require("mongoose");
const Listing = require("../../models/listing");
const Review = require("../../models/review");
const User = require("../../models/user");
const { connectDB, clearDB, closeDB } = require("../testHelper");

describe("Component Testing: Mongoose Models & Schemas", () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterEach(async () => {
    await clearDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  describe("Listing Model Component", () => {
    test("valid listing passes validation and saves correctly", async () => {
      const validListing = new Listing({
        title: "Alpine Chalet",
        description: "Cozy chalet in the snow",
        price: 2500,
        location: "Manali",
        country: "India",
        category: "Mountains",
        geometry: {
          type: "Point",
          coordinates: [77.1892, 32.2432],
        },
      });

      const saved = await validListing.save();
      expect(saved._id).toBeDefined();
      expect(saved.title).toBe("Alpine Chalet");
      expect(saved.geometry.type).toBe("Point");
      expect(saved.geometry.coordinates).toEqual([77.1892, 32.2432]);
      expect(saved.reviews).toEqual([]);
    });

    test("validation fails when required title is omitted", async () => {
      const listing = new Listing({
        description: "Missing title",
        price: 1000,
        geometry: {
          type: "Point",
          coordinates: [0, 0],
        },
      });

      let err;
      try {
        await listing.validate();
      } catch (error) {
        err = error;
      }
      expect(err).toBeDefined();
      expect(err.errors.title).toBeDefined();
    });

    test("validation fails when required geometry is omitted", async () => {
      const listing = new Listing({
        title: "No Geometry Stay",
        price: 1000,
      });

      let err;
      try {
        await listing.validate();
      } catch (error) {
        err = error;
      }
      expect(err).toBeDefined();
      expect(err.errors["geometry.type"]).toBeDefined();
    });

    test("validation fails when geometry.type is not Point", async () => {
      const listing = new Listing({
        title: "Polygon Geometry Stay",
        geometry: {
          type: "Polygon", // enum is strictly ['Point']
          coordinates: [0, 0],
        },
      });

      let err;
      try {
        await listing.validate();
      } catch (error) {
        err = error;
      }
      expect(err).toBeDefined();
      expect(err.errors["geometry.type"]).toBeDefined();
    });

    test("findOneAndDelete hook cascade-deletes associated reviews", async () => {
      // 1. Create reviews
      const review1 = await new Review({ comment: "Rev 1", rating: 5 }).save();
      const review2 = await new Review({ comment: "Rev 2", rating: 4 }).save();

      // 2. Create listing with reviews
      const listing = await new Listing({
        title: "Cascade Test Villa",
        price: 3000,
        geometry: { type: "Point", coordinates: [10, 20] },
        reviews: [review1._id, review2._id],
      }).save();

      // Verify reviews exist in DB
      let revCount = await Review.countDocuments({ _id: { $in: [review1._id, review2._id] } });
      expect(revCount).toBe(2);

      // 3. Delete listing using findByIdAndDelete (which triggers findOneAndDelete hook)
      await Listing.findByIdAndDelete(listing._id);

      // 4. Verify reviews were cascade deleted
      revCount = await Review.countDocuments({ _id: { $in: [review1._id, review2._id] } });
      expect(revCount).toBe(0);
    });
  });

  describe("Review Model Component", () => {
    test("valid review passes validation and saves correctly", async () => {
      const validReview = new Review({
        comment: "Excellent hospitality!",
        rating: 5,
      });

      const saved = await validReview.save();
      expect(saved._id).toBeDefined();
      expect(saved.comment).toBe("Excellent hospitality!");
      expect(saved.rating).toBe(5);
      expect(saved.createdAt).toBeInstanceOf(Date);
    });

    test("rating below minimum boundary (rating < 1) fails validation", async () => {
      const review = new Review({
        comment: "Sub-zero rating",
        rating: 0,
      });

      let err;
      try {
        await review.validate();
      } catch (error) {
        err = error;
      }
      expect(err).toBeDefined();
      expect(err.errors.rating).toBeDefined();
    });

    test("rating above maximum boundary (rating > 5) fails validation", async () => {
      const review = new Review({
        comment: "Over-the-top rating",
        rating: 6,
      });

      let err;
      try {
        await review.validate();
      } catch (error) {
        err = error;
      }
      expect(err).toBeDefined();
      expect(err.errors.rating).toBeDefined();
    });

    test("boundary ratings of 1 and 5 are valid", async () => {
      const minReview = new Review({ comment: "Minimum valid rating", rating: 1 });
      const maxReview = new Review({ comment: "Maximum valid rating", rating: 5 });

      await expect(minReview.validate()).resolves.toBeUndefined();
      await expect(maxReview.validate()).resolves.toBeUndefined();
    });
  });

  describe("User Model Component & Passport Plugin", () => {
    test("user without required email fails validation", async () => {
      const user = new User({ username: "noemailuser" });

      let err;
      try {
        await user.validate();
      } catch (error) {
        err = error;
      }
      expect(err).toBeDefined();
      expect(err.errors.email).toBeDefined();
    });

    test("User.register hashes password and sets salt", async () => {
      const user = new User({ username: "secureuser", email: "secure@test.com" });
      const registered = await User.register(user, "StrongPass123!");

      expect(registered._id).toBeDefined();
      expect(registered.username).toBe("secureuser");
      expect(registered.email).toBe("secure@test.com");
      expect(registered.hash).toBeDefined();
      expect(registered.salt).toBeDefined();
    });

    test("User.register rejects duplicate username", async () => {
      const user1 = new User({ username: "duplicateuser", email: "user1@test.com" });
      await User.register(user1, "Password123!");

      const user2 = new User({ username: "duplicateuser", email: "user2@test.com" });
      await expect(User.register(user2, "Password456!")).rejects.toThrow();
    });

    test("User.authenticate authenticates correct password and rejects incorrect password", async () => {
      const user = new User({ username: "authuser", email: "auth@test.com" });
      await User.register(user, "MySecretPassword");

      const authenticate = User.authenticate();

      // Correct password
      const resultSuccess = await new Promise((resolve) => {
        authenticate("authuser", "MySecretPassword", (err, authenticatedUser) => {
          resolve({ err, authenticatedUser });
        });
      });
      expect(resultSuccess.err).toBeNull();
      expect(resultSuccess.authenticatedUser).toBeTruthy();
      expect(resultSuccess.authenticatedUser.username).toBe("authuser");

      // Incorrect password
      const resultFail = await new Promise((resolve) => {
        authenticate("authuser", "WrongPassword", (err, authenticatedUser, info) => {
          resolve({ err, authenticatedUser, info });
        });
      });
      expect(resultFail.authenticatedUser).toBeFalsy();
      expect(resultFail.info).toBeDefined();
    });
  });
});
