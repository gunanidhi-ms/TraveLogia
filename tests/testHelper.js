const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const User = require("../models/user");
const Listing = require("../models/listing");
const Review = require("../models/review");

let mongod = null;

// Mock Mapbox Geocoding service so no external network calls are made
jest.mock("@mapbox/mapbox-sdk/services/geocoding", () => {
  return jest.fn().mockImplementation(() => ({
    forwardGeocode: jest.fn().mockReturnValue({
      send: jest.fn().mockResolvedValue({
        body: {
          features: [
            {
              geometry: {
                type: "Point",
                coordinates: [77.209, 28.6139], // Default coordinates (e.g. New Delhi)
              },
            },
          ],
        },
      }),
    }),
  }));
});

/**
 * Connect to in-memory MongoDB database
 */
async function connectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}

/**
 * Clear all data from all collections in the database
 */
async function clearDB() {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
}

/**
 * Close database connection and stop in-memory MongoDB server
 */
async function closeDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}

/**
 * Helper to register a test user directly in MongoDB
 */
async function createTestUser(username = "testuser", email = "test@example.com", password = "Password123!") {
  const user = new User({ username, email });
  return await User.register(user, password);
}

/**
 * Helper to create a test listing directly in MongoDB
 */
async function createTestListing(ownerId, overrides = {}) {
  const listingData = {
    title: "Test Oasis Villa",
    description: "A wonderful test villa with scenic views.",
    image: {
      filename: "test-img",
      url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470",
    },
    price: 1500,
    location: "Goa",
    country: "India",
    category: "Trending",
    geometry: {
      type: "Point",
      coordinates: [73.8567, 15.2993],
    },
    owner: ownerId,
    reviews: [],
    ...overrides,
  };
  const listing = new Listing(listingData);
  return await listing.save();
}

/**
 * Helper to create a test review directly in MongoDB
 */
async function createTestReview(authorId, overrides = {}) {
  const reviewData = {
    comment: "Outstanding place, highly recommended!",
    rating: 5,
    author: authorId,
    createdAt: new Date(),
    ...overrides,
  };
  const review = new Review(reviewData);
  return await review.save();
}

module.exports = {
  connectDB,
  clearDB,
  closeDB,
  createTestUser,
  createTestListing,
  createTestReview,
};
