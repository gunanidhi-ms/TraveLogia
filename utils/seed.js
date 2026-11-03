const mongoose = require("mongoose");
const Listing = require("../models/listing");
const User = require("../models/user");
const Review = require("../models/review");
const rawData = require("../init/data");

async function seedDatabase() {
  try {
    console.log("🌱 Seeding database with sample users, listings, and reviews...");

    // 1. Create or retrieve default Host User
    let hostUser = await User.findOne({ username: "TraveLogiaHost" });
    if (!hostUser) {
      hostUser = new User({
        email: "host@travelogia.com",
        username: "TraveLogiaHost",
      });
      await User.register(hostUser, "password123");
      console.log("👤 Created default host user: TraveLogiaHost (pass: password123)");
    }

    // 2. Create or retrieve default Guest Traveler User
    let guestUser = await User.findOne({ username: "TravelerAlice" });
    if (!guestUser) {
      guestUser = new User({
        email: "alice@travel.com",
        username: "TravelerAlice",
      });
      await User.register(guestUser, "password123");
      console.log("👤 Created sample guest user: TravelerAlice (pass: password123)");
    }

    const dataArray = rawData.data || rawData.sampleListings || rawData;

    await Listing.deleteMany({});
    await Review.deleteMany({});

    // 3. Create sample reviews
    const sampleReview1 = await new Review({
      comment: "Absolutely breathtaking views and top-notch hospitality! Can't wait to return.",
      rating: 5,
      author: guestUser._id,
      createdAt: new Date(),
    }).save();

    const sampleReview2 = await new Review({
      comment: "Super clean, peaceful environment, and very close to local attractions. Highly recommended!",
      rating: 5,
      author: guestUser._id,
      createdAt: new Date(),
    }).save();

    const sampleReview3 = await new Review({
      comment: "Cozy rooms, great ambiance, and excellent host communication throughout our stay.",
      rating: 4,
      author: guestUser._id,
      createdAt: new Date(),
    }).save();

    const cleaned = dataArray.map((item, index) => {
      const doc = { ...item };

      if (doc._id && doc._id.$oid) {
        doc._id = new mongoose.Types.ObjectId(doc._id.$oid);
      }

      // Assign the valid host user as owner
      doc.owner = hostUser._id;

      // Attach reviews to the first few listings
      if (index === 0) {
        doc.reviews = [sampleReview1._id, sampleReview2._id];
      } else if (index === 1) {
        doc.reviews = [sampleReview3._id];
      } else {
        doc.reviews = [];
      }

      if (!doc.geometry || !doc.geometry.type || !doc.geometry.coordinates) {
        doc.geometry = { type: "Point", coordinates: [77.209, 28.6139] };
      }

      return doc;
    });

    await Listing.insertMany(cleaned);
    console.log(`✅ Seeded ${cleaned.length} sample listings with reviews into the database!`);
  } catch (err) {
    console.error("❌ Seeding failed:", err.message);
  }
}

module.exports = seedDatabase;
