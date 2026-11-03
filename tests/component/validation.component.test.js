const { listingSchema, reviewSchema } = require("../../schemaValidation");

describe("Component Testing: Joi Validation Schemas", () => {
  describe("listingSchema Component Boundaries & Equivalence Partitioning", () => {
    test("valid listing object satisfies schema rules", () => {
      const validPayload = {
        listing: {
          title: "Mountain Cabin",
          description: "Serene hideaway in the hills",
          image: {
            filename: "cabin",
            url: "https://example.com/cabin.jpg",
          },
          price: 2500,
          location: "Shimla",
          country: "India",
          category: "Mountains",
        },
      };

      const result = listingSchema.validate(validPayload);
      expect(result.error).toBeUndefined();
    });

    test("price boundary: price = 0 is valid", () => {
      const payload = {
        listing: {
          title: "Free Camping Spot",
          description: "Open land for pitching tents",
          image: { url: "https://example.com/tent.jpg" },
          price: 0,
          location: "Rishikesh",
          country: "India",
          category: "Camping",
        },
      };

      const result = listingSchema.validate(payload);
      expect(result.error).toBeUndefined();
    });

    test("price boundary: negative price is rejected", () => {
      const payload = {
        listing: {
          title: "Negative Price Room",
          description: "Invalid test case",
          image: { url: "https://example.com/room.jpg" },
          price: -100,
          location: "Delhi",
          country: "India",
          category: "Rooms",
        },
      };

      const result = listingSchema.validate(payload);
      expect(result.error).toBeDefined();
      expect(result.error.details[0].message).toMatch(/greater than or equal to 0/);
    });

    test("rejection when mandatory title is missing", () => {
      const payload = {
        listing: {
          description: "No title provided",
          price: 1500,
          location: "Goa",
          country: "India",
          category: "Trending",
        },
      };

      const result = listingSchema.validate(payload);
      expect(result.error).toBeDefined();
      expect(result.error.details[0].message).toMatch(/title/);
    });

    test("rejection when root listing key is absent", () => {
      const result = listingSchema.validate({});
      expect(result.error).toBeDefined();
    });

    test("listing title cannot be an empty string", () => {
      const payload = {
        listing: {
          title: "",
          description: "Valid description of property",
          price: 1000,
          location: "Goa",
          country: "India",
          category: "Trending",
        },
      };
      const result = listingSchema.validate(payload);
      expect(result.error).toBeDefined();
      expect(result.error.details[0].message).toMatch(/title/);
    });
  });

  describe("reviewSchema Component Boundaries", () => {
    test("valid review passes validation", () => {
      const payload = {
        review: {
          rating: 4,
          comment: "Comfortable beds and friendly host.",
        },
      };

      const result = reviewSchema.validate(payload);
      expect(result.error).toBeUndefined();
    });

    test("rating lower limit: 1 is valid, 0 is invalid", () => {
      expect(reviewSchema.validate({ review: { rating: 1, comment: "Bare minimum" } }).error).toBeUndefined();
      expect(reviewSchema.validate({ review: { rating: 0, comment: "Too low" } }).error).toBeDefined();
    });

    test("rating upper limit: 5 is valid, 6 is invalid", () => {
      expect(reviewSchema.validate({ review: { rating: 5, comment: "Perfection" } }).error).toBeUndefined();
      expect(reviewSchema.validate({ review: { rating: 6, comment: "Exceeds max" } }).error).toBeDefined();
    });

    test("missing comment field is rejected", () => {
      const result = reviewSchema.validate({ review: { rating: 3 } });
      expect(result.error).toBeDefined();
      expect(result.error.details[0].message).toMatch(/comment/);
    });
  });
});
