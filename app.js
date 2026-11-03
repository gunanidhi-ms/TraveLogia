if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const bookingRouter = require("./routes/booking.js");

app.use(express.static(path.join(__dirname, "/public")));
app.engine("ejs", ejsMate);
app.use(methodOverride("_method"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));

const dbUrl = process.env.ATLASDB_URL;

async function startServer() {
  let url = process.env.ATLASDB_URL;
  if (!url || url.trim() === "") {
    console.log("🟡 No MongoDB Atlas URL found — starting in-memory MongoDB...");
    const { MongoMemoryServer } = require("mongodb-memory-server");
    const mongod = await MongoMemoryServer.create();
    url = mongod.getUri();
    process.env.ATLASDB_URL = url;
    console.log(`✅ In-memory MongoDB running at: ${url}`);

    process.on("SIGINT", async () => {
      await mongod.stop();
      process.exit(0);
    });

    await mongoose.connect(url);
    const seedDatabase = require("./utils/seed");
    await seedDatabase();
  } else {
    await mongoose.connect(url);
    console.log("connected to DB");
  }

  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
}


const sessionOptions = {
  secret: process.env.SECRET || "thisshouldbeabettersecret!",
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};

if (process.env.NODE_ENV !== "test" && dbUrl) {
  const store = MongoStore.create({
    mongoUrl: dbUrl,
    crypto: {
      secret: process.env.SECRET || "thisshouldbeabettersecret!",
    },
    touchAfter: 24 * 3600,
  });

  store.on("error", (err) => {
    console.log("ERROR in MONGO SESSION STORE", err);
  });

  sessionOptions.store = store;
}

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.currUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

app.get("/", (req, res) => {
  res.redirect("/listings");
});

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);
app.use("/bookings", bookingRouter);

app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found!"));
});

// ...existing code...
app.use((err, req, res, next) => {
  let { statusCode = 500, message = "Some Error Occured!" } = err;
  res.status(statusCode).render("listings/error", {
    message,
    currUser: req.user, // Pass currUser explicitly
    success: res.locals.success,
    error: res.locals.error,
  });
});


if (process.env.NODE_ENV !== "test") {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
  });
}

module.exports = app;
