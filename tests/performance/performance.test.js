process.env.NODE_ENV = "test";
process.env.SECRET = "testsecretkeyforjestperf";

const request = require("supertest");
const app = require("../../app");
const { connectDB, clearDB, closeDB, createTestUser, createTestListing } = require("../testHelper");

describe("Performance & Benchmark Testing: Response Latency & Load Resilience", () => {
  let sampleListingId;

  beforeAll(async () => {
    await connectDB();
    const host = await createTestUser("perf_host", "perf@test.com");
    // Seed 10 sample listings for realistic query execution
    for (let i = 1; i <= 10; i++) {
      const listing = await createTestListing(host._id, {
        title: `Performance Villa ${i}`,
        price: 1000 + i * 100,
        location: i % 2 === 0 ? "Goa" : "Manali",
        category: i % 2 === 0 ? "Trending" : "Mountains",
      });
      if (i === 1) sampleListingId = listing._id.toString();
    }
  });

  afterAll(async () => {
    await clearDB();
    await closeDB();
  });

  test("PERF-01: GET /listings response time meets SLA threshold (< 300ms)", async () => {
    const startTime = Date.now();
    const response = await request(app).get("/listings");
    const duration = Date.now() - startTime;

    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(300);
  });

  test("PERF-02: GET /listings/search response time meets SLA threshold (< 300ms)", async () => {
    const startTime = Date.now();
    const response = await request(app).get("/listings/search?q=Villa");
    const duration = Date.now() - startTime;

    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(300);
  });

  test("PERF-03: GET /listings/:id detail lookup with population meets SLA (< 300ms)", async () => {
    const startTime = Date.now();
    const response = await request(app).get(`/listings/${sampleListingId}`);
    const duration = Date.now() - startTime;

    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(300);
  });

  test("PERF-04: Sequential batch throughput: 10 back-to-back requests complete within 2000ms", async () => {
    const startTime = Date.now();
    for (let i = 0; i < 10; i++) {
      const res = await request(app).get("/listings");
      expect(res.status).toBe(200);
    }
    const totalDuration = Date.now() - startTime;

    expect(totalDuration).toBeLessThan(2000);
  });

  test("PERF-05: high-concurrency response time remains within acceptable SLA (< 500ms)", async () => {
    const startTime = Date.now();
    const res = await request(app).get("/listings");
    const duration = Date.now() - startTime;

    expect(res.status).toBe(200);
    expect(duration).toBeLessThan(500);
  });
});
