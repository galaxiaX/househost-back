import { Schema, model } from "mongoose";

const UserSchema = new Schema({
  firstname: String,
  lastname: String,
  email: { type: String, unique: true },
  password: String,
});

const UserModel = model("User", UserSchema);

export default UserModel;
