import { Schema, model } from "mongoose";

const placeSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: "User" },
  title: String,
  address: String,
  photos: [String],
  description: String,
  bedroom: Number,
  bed: Number,
  bath: Number,
  maxGuests: Number,
  perks: [String],
  extraInfo: String,
  checkin: String,
  checkout: String,
  price: Number,
});

const PlaceModel = model("Place", placeSchema);

export default PlaceModel;
