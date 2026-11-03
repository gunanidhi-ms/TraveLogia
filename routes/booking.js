const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn } = require("../middlewares");
const bookingController = require("../controllers/bookings");

// View all user's bookings
router.route("/").get(isLoggedIn, wrapAsync(bookingController.userBookings));

// Create a new booking for a listing (POST /bookings/:listingId)
router
  .route("/:listingId")
  .post(isLoggedIn, wrapAsync(bookingController.createBooking));

// View booking voucher / details (GET /bookings/:id)
router
  .route("/:id")
  .get(isLoggedIn, wrapAsync(bookingController.showBooking));

// Cancel a booking (POST /bookings/:id/cancel)
router
  .route("/:id/cancel")
  .post(isLoggedIn, wrapAsync(bookingController.cancelBooking));

module.exports = router;
