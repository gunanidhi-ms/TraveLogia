const Booking = require("../models/booking");
const Listing = require("../models/listing");

/**
 * Handle new booking submission
 */
module.exports.createBooking = async (req, res) => {
  const { listingId } = req.params;
  const listing = await Listing.findById(listingId).populate("owner");

  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  // Prevent host from booking their own property
  if (listing.owner && req.user && listing.owner._id.equals(req.user._id)) {
    req.flash("error", "Hosts cannot reserve their own listing!");
    return res.redirect(`/listings/${listingId}`);
  }

  const { checkIn, checkOut, specialRequests } = req.body;
  if (!checkIn || !checkOut) {
    req.flash("error", "Please select valid check-in and check-out dates!");
    return res.redirect(`/listings/${listingId}`);
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    req.flash("error", "Invalid date format provided.");
    return res.redirect(`/listings/${listingId}`);
  }

  if (checkInDate < today) {
    req.flash("error", "Check-in date cannot be in the past!");
    return res.redirect(`/listings/${listingId}`);
  }

  if (checkOutDate <= checkInDate) {
    req.flash("error", "Check-out date must be after the check-in date!");
    return res.redirect(`/listings/${listingId}`);
  }

  // Calculate nights and price
  const diffTime = Math.abs(checkOutDate - checkInDate);
  const totalNights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const guests = Math.max(1, parseInt(req.body.guests, 10) || 1);

  const pricePerNight = listing.price || 0;
  const basePrice = pricePerNight * totalNights;
  const serviceFee = Math.round(basePrice * 0.05); // 5% platform fee
  const tax = Math.round(basePrice * 0.12); // 12% GST
  const totalPrice = basePrice + serviceFee + tax;

  // Generate unique booking confirmation code
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const bookingCode = `TL-${randomSuffix}-${Date.now().toString().slice(-4)}`;

  const booking = new Booking({
    listing: listing._id,
    user: req.user._id,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    guests,
    totalNights,
    pricePerNight,
    basePrice,
    serviceFee,
    tax,
    totalPrice,
    specialRequests: specialRequests ? specialRequests.trim() : "",
    bookingCode,
    status: "Confirmed",
  });

  await booking.save();

  req.flash(
    "success",
    `🎉 Reservation confirmed! Booking Code: ${bookingCode} (${totalNights} night${
      totalNights > 1 ? "s" : ""
    }, ₹${totalPrice.toLocaleString("en-IN")})`
  );
  res.redirect(`/bookings/${booking._id}`);
};

/**
 * List all bookings made by the authenticated user
 */
module.exports.userBookings = async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id })
    .populate("listing")
    .sort({ createdAt: -1 });

  res.render("bookings/index.ejs", { bookings });
};

/**
 * Display a single booking confirmation voucher
 */
module.exports.showBooking = async (req, res) => {
  const { id } = req.params;
  const booking = await Booking.findById(id)
    .populate({
      path: "listing",
      populate: { path: "owner" },
    })
    .populate("user");

  if (!booking) {
    req.flash("error", "Reservation not found!");
    return res.redirect("/bookings");
  }

  // Authorization: Only the guest who booked or the host of the listing may view the voucher
  const isGuest = req.user && booking.user && booking.user._id.equals(req.user._id);
  const isHost =
    req.user &&
    booking.listing &&
    booking.listing.owner &&
    booking.listing.owner._id.equals(req.user._id);

  if (!isGuest && !isHost) {
    req.flash("error", "You do not have permission to view this reservation!");
    return res.redirect("/listings");
  }

  res.render("bookings/show.ejs", { booking });
};

/**
 * Cancel an active booking
 */
module.exports.cancelBooking = async (req, res) => {
  const { id } = req.params;
  const booking = await Booking.findById(id);

  if (!booking) {
    req.flash("error", "Reservation not found!");
    return res.redirect("/bookings");
  }

  if (!booking.user.equals(req.user._id)) {
    req.flash("error", "You do not have permission to cancel this booking!");
    return res.redirect("/bookings");
  }

  booking.status = "Cancelled";
  await booking.save();

  req.flash("success", `Reservation #${booking.bookingCode} has been cancelled.`);
  res.redirect("/bookings");
};

