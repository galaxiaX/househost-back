import { Schema, model } from "mongoose";

const bookingSchema = new Schema({
  place: { type: Schema.Types.ObjectId, require: true, ref: "Place" },
  user: { type: Schema.Types.ObjectId, require: true },
  checkin: { type: Schema.Types.Date, require: true },
  checkout: { type: Schema.Types.Date, require: true },
  guests: { type: Number, require: true },
  phone: { type: String, require: true },
  name: { type: String, require: true },
  price: { type: Number, require: true },
});

const BookingModel = model("Booking", bookingSchema);

export default BookingModel;
