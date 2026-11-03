const { listingSchema, reviewSchema } = require("../../schemaValidation");

describe("White-Box: Schema Validation Unit Tests", () => {
  describe("listingSchema Branch & Boundary Testing", () => {
    test("valid listing passes validation", () => {
      const validData = {
        listing: {
          title: "Cozy Beach Villa",
          description: "Stunning view near the ocean",
          image: {
            filename: "listingimage",
            url: "https://images.unsplash.com/photo-1",
          },
          price: 1500,
          location: "Goa",
          country: "India",
          category: "Trending",
        },
      };
      const { error } = listingSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    test("boundary condition: price = 0 is valid (min boundary)", () => {
      const data = {
        listing: {
          title: "Free Stay Couch",
          description: "Community stay",
          image: { url: "https://example.com/img.jpg" },
          price: 0,
          location: "Berlin",
          country: "Germany",
          category: "Rooms",
        },
      };
      const { error } = listingSchema.validate(data);
      expect(error).toBeUndefined();
    });

    test("boundary condition: negative price (< 0) fails validation", () => {
      const data = {
        listing: {
          title: "Invalid Price Stay",
          description: "Negative price test",
          image: { url: "https://example.com/img.jpg" },
          price: -10,
          location: "Delhi",
          country: "India",
          category: "Iconic Cities",
        },
      };
      const { error } = listingSchema.validate(data);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain("must be greater than or equal to 0");
    });

    test("missing required fields fails validation", () => {
      const testCases = [
        { field: "title", data: { listing: { description: "d", price: 10, location: "l", country: "c", category: "cat" } } },
        { field: "description", data: { listing: { title: "t", price: 10, location: "l", country: "c", category: "cat" } } },
        { field: "price", data: { listing: { title: "t", description: "d", location: "l", country: "c", category: "cat" } } },
        { field: "location", data: { listing: { title: "t", description: "d", price: 10, country: "c", category: "cat" } } },
        { field: "country", data: { listing: { title: "t", description: "d", price: 10, location: "l", category: "cat" } } },
        { field: "category", data: { listing: { title: "t", description: "d", price: 10, location: "l", country: "c" } } },
      ];

      for (const tc of testCases) {
        const { error } = listingSchema.validate(tc.data);
        expect(error).toBeDefined();
      }
    });

    test("missing listing root object fails validation", () => {
      const { error } = listingSchema.validate({});
      expect(error).toBeDefined();
    });
  });

  describe("reviewSchema Branch & Boundary Testing", () => {
    test("valid review with rating between 1 and 5 passes", () => {
      const validReview = {
        review: {
          rating: 4,
          comment: "Great experience!",
        },
      };
      const { error } = reviewSchema.validate(validReview);
      expect(error).toBeUndefined();
    });

    test("boundary condition: rating = 1 (lower limit) passes", () => {
      const { error } = reviewSchema.validate({ review: { rating: 1, comment: "Poor" } });
      expect(error).toBeUndefined();
    });

    test("boundary condition: rating = 5 (upper limit) passes", () => {
      const { error } = reviewSchema.validate({ review: { rating: 5, comment: "Outstanding" } });
      expect(error).toBeUndefined();
    });

    test("boundary condition: rating < 1 (rating = 0) fails", () => {
      const { error } = reviewSchema.validate({ review: { rating: 0, comment: "Zero" } });
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain("must be greater than or equal to 1");
    });

    test("boundary condition: rating > 5 (rating = 6) fails", () => {
      const { error } = reviewSchema.validate({ review: { rating: 6, comment: "Too high" } });
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain("must be less than or equal to 5");
    });

    test("missing comment fails validation", () => {
      const { error } = reviewSchema.validate({ review: { rating: 3 } });
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('"review.comment" is required');
    });

    test("missing review object fails validation", () => {
      const { error } = reviewSchema.validate({});
      expect(error).toBeDefined();
    });
  });
});
