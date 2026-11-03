process.env.NODE_ENV = "test";
process.env.SECRET = "testsecretkeyforjestintegration";

const request = require("supertest");
const app = require("../../app");
const User = require("../../models/user");
const { connectDB, clearDB, closeDB } = require("../testHelper");

describe("Integration Testing: Authentication & Session Management", () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterEach(async () => {
    await clearDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  test("User Signup: saves user in DB, establishes session cookie, and redirects to /listings", async () => {
    const agent = request.agent(app);

    const response = await agent
      .post("/signup")
      .type("form")
      .send({
        username: "johndoe",
        email: "john@example.com",
        password: "Password123!",
      });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/listings");

    // Verify user was stored in database
    const dbUser = await User.findOne({ username: "johndoe" });
    expect(dbUser).not.toBeNull();
    expect(dbUser.email).toBe("john@example.com");

    // Verify session persistence: can access protected route without login redirect
    const protectedResponse = await agent.get("/listings/new");
    expect(protectedResponse.status).toBe(200);
  });

  test("Duplicate Signup: rejects registration when username is already taken", async () => {
    // Register first user
    const user1 = new User({ username: "existinguser", email: "first@example.com" });
    await User.register(user1, "Pass1234!");

    const agent = request.agent(app);
    const response = await agent
      .post("/signup")
      .type("form")
      .send({
        username: "existinguser",
        email: "second@example.com",
        password: "DifferentPass123!",
      });

    // Should redirect back to /signup with flash error
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/signup");

    // Verify count in DB is still 1
    const count = await User.countDocuments({ username: "existinguser" });
    expect(count).toBe(1);
  });

  test("User Login: authenticates valid credentials and establishes session", async () => {
    // Create registered user in DB
    const user = new User({ username: "validuser", email: "valid@example.com" });
    await User.register(user, "CorrectPassword!");

    const agent = request.agent(app);
    const response = await agent
      .post("/login")
      .type("form")
      .send({
        username: "validuser",
        password: "CorrectPassword!",
      });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/listings");

    // Verify authenticated access
    const protectedResponse = await agent.get("/listings/new");
    expect(protectedResponse.status).toBe(200);
  });

  test("User Login: rejects invalid password and redirects to /login", async () => {
    const user = new User({ username: "loginuser", email: "login@example.com" });
    await User.register(user, "GoodPassword");

    const agent = request.agent(app);
    const response = await agent
      .post("/login")
      .type("form")
      .send({
        username: "loginuser",
        password: "WrongPassword!",
      });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/login");
  });

  test("Redirect Preservation: unauthenticated visit to /listings/new redirects to login, then resumes to /listings/new after login", async () => {
    const user = new User({ username: "redirectuser", email: "redirect@example.com" });
    await User.register(user, "Password123!");

    const agent = request.agent(app);

    // 1. Visit protected endpoint unauthenticated
    const firstAttempt = await agent.get("/listings/new");
    expect(firstAttempt.status).toBe(302);
    expect(firstAttempt.headers.location).toBe("/login");

    // 2. Perform login via same agent session
    const loginResponse = await agent
      .post("/login")
      .type("form")
      .send({
        username: "redirectuser",
        password: "Password123!",
      });

    // Should redirect to original target (/listings/new), not default /listings
    expect(loginResponse.status).toBe(302);
    expect(loginResponse.headers.location).toBe("/listings/new");
  });

  test("User Logout: destroys session and revokes access to protected routes", async () => {
    const user = new User({ username: "logoutuser", email: "logout@example.com" });
    await User.register(user, "Password123!");

    const agent = request.agent(app);
    await agent
      .post("/login")
      .type("form")
      .send({ username: "logoutuser", password: "Password123!" });

    // Confirm authenticated
    const authCheck = await agent.get("/listings/new");
    expect(authCheck.status).toBe(200);

    // Logout
    const logoutResponse = await agent.get("/logout");
    expect(logoutResponse.status).toBe(302);
    expect(logoutResponse.headers.location).toBe("/listings");

    // Subsequent access to protected route must be rejected
    const postLogoutCheck = await agent.get("/listings/new");
    expect(postLogoutCheck.status).toBe(302);
    expect(postLogoutCheck.headers.location).toBe("/login");
  });
});
