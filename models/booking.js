const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema({
  listing: {
    type: Schema.Types.ObjectId,
    ref: "Listing",
    required: true,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  checkIn: {
    type: Date,
    required: true,
  },
  checkOut: {
    type: Date,
    required: true,
  },
  guests: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  totalNights: {
    type: Number,
    required: true,
    min: 1,
  },
  pricePerNight: {
    type: Number,
    required: true,
  },
  basePrice: {
    type: Number,
    required: true,
  },
  serviceFee: {
    type: Number,
    default: 0,
  },
  tax: {
    type: Number,
    default: 0,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  specialRequests: {
    type: String,
    default: "",
    trim: true,
  },
  bookingCode: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ["Confirmed", "Cancelled", "Completed"],
    default: "Confirmed",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Booking", bookingSchema);

