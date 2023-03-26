import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import multer from "multer";
import crypto from "crypto";
import dotenv from "dotenv";
import axios from "axios";
import { deleteImg, uploadImg } from "./s3.js";
import User from "./models/User.js";
import Place from "./models/Place.js";
import Booking from "./models/Booking.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const jwtSecret = process.env.JWT_SECRET;

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error(`Error connecting to MongoDB: ${err}`);
  });

const bcryptSalt = bcrypt.genSaltSync(10);
const storage = multer.memoryStorage();
const upload = multer({ storage });
const generateFileName = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.MAIN_URL || "http://localhost:5173",
    credentials: true,
  })
);

function getUserDataFromReq(req) {
  return new Promise((resolve, reject) => {
    jwt.verify(req.cookies.token, jwtSecret, {}, async (err, userData) => {
      if (err) {
        console.error(err);
        reject(new Error("Unauthorized"));
      }
      resolve(userData);
    });
  });
}

app.post("/signup", async (req, res) => {
  try {
    const { firstname, lastname, email, password } = req.body;
    const userDoc = await User.create({
      firstname,
      lastname,
      email,
      password: bcrypt.hashSync(password, bcryptSalt),
    });
    res.json(userDoc);
  } catch (err) {
    res.status(422).json({ error: "Failed to create user" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const userDoc = await User.findOne({ email });
    if (userDoc) {
      const passOk = bcrypt.compareSync(password, userDoc.password);
      if (passOk) {
        const token = jwt.sign(
          { email: userDoc.email, id: userDoc._id },
          jwtSecret
        );
        res
          .cookie("token", token, {
            sameSite: "none",
            secure: true,
          })
          .json(userDoc);
      } else {
        res.status(422).json({ error: "Incorrect password" });
      }
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to log in" });
  }
});

app.get("/profile", async (req, res) => {
  const { token } = req.cookies;
  if (token) {
    try {
      const userData = jwt.verify(token, jwtSecret);
      const { firstname, lastname, email, _id } = await User.findById(
        userData.id
      );
      res.json({ firstname, lastname, email, _id });
    } catch (err) {
      console.error(err);
      res.status(401).json({ error: "Unauthorized" });
    }
  } else {
    res.json(null);
  }
});

app.post("/logout", (req, res) => {
  res
    .clearCookie("token", {
      sameSite: "none",
      secure: true,
    })
    .set("Cache-Control", "no-store")
    .json(true);
});

app.post("/upload-by-link", async (req, res) => {
  try {
    const { link } = req.body;
    const newFileName = generateFileName();
    const { data, headers } = await axios.get(link, {
      responseType: "arraybuffer",
    });
    await uploadImg(data, newFileName, headers["content-type"]);
    res.json(newFileName);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error uploading image to S3");
  }
});

app.post("/upload", upload.array("photos", 50), async (req, res) => {
  const uploadedFiles = [];
  for (let i in req.files) {
    const { buffer, mimetype } = req.files[i];
    const newFileName = generateFileName();
    await uploadImg(buffer, newFileName, mimetype);
    uploadedFiles.push(newFileName);
  }
  res.status(201).json(uploadedFiles);
});

app.post("/places", (req, res) => {
  const { token } = req.cookies;
  const {
    title,
    address,
    photos,
    description,
    bedroom,
    bed,
    bath,
    maxGuests,
    perks,
    extraInfo,
    checkin,
    checkout,
    price,
  } = req.body;

  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;

    const placeDoc = await Place.create({
      owner: userData.id,
      title,
      address,
      photos,
      description,
      bedroom,
      bed,
      bath,
      maxGuests,
      perks,
      extraInfo,
      checkin,
      checkout,
      price,
    });
    res.json(placeDoc);
  });
});

app.get("/user-places", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const { id } = userData;
    res.json(await Place.find({ owner: id }));
  });
});

app.get("/places/:id", async (req, res) => {
  const { id } = req.params;
  res.json(await Place.findById(id));
});

app.put("/places", async (req, res) => {
  const { token } = req.cookies;
  const {
    id,
    title,
    address,
    photos,
    description,
    bedroom,
    bed,
    bath,
    maxGuests,
    perks,
    extraInfo,
    checkin,
    checkout,
    price,
  } = req.body;

  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.findById(id);

    if (userData.id === placeDoc.owner.toString()) {
      const oldPhotos = placeDoc.photos;
      placeDoc.set({
        title,
        address,
        photos,
        description,
        bedroom,
        bed,
        bath,
        maxGuests,
        perks,
        extraInfo,
        checkin,
        checkout,
        price,
      });

      await placeDoc.save();

      const usedPhotos = new Set(placeDoc.photos);
      for (const photo of oldPhotos) {
        if (!usedPhotos.has(photo)) {
          try {
            await deleteImg(photo);
          } catch (err) {
            console.log(err);
          }
        }
      }

      res.json("ok");
    }
  });
});

app.get("/places", async (req, res) => {
  const places = await Place.aggregate([{ $sample: { size: 1000 } }]).exec();
  places.toArray((err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Server Error" });
    }
    res.json(result);
  });
});

app.post("/bookings", async (req, res) => {
  const userData = await getUserDataFromReq(req);
  const { place, checkin, checkout, guests, phone, name, price } = req.body;
  Booking.create({
    place,
    checkin,
    checkout,
    guests,
    phone,
    name,
    price,
    user: userData.id,
  })
    .then((doc) => {
      res.json(doc);
    })
    .catch((err) => {
      throw err;
    });
});

app.get("/bookings", async (req, res) => {
  const userData = await getUserDataFromReq(req);
  res.json(await Booking.find({ user: userData.id }).populate("place"));
});

app.delete("/places/:placeId", async (req, res) => {
  const placeId = req.params.placeId;
  try {
    const placeDoc = await Place.findById(placeId);
    if (placeDoc) {
      await Booking.deleteMany({ place: placeId });

      for (let i in placeDoc.photos) {
        const image = placeDoc.photos[i];
        await deleteImg(image);
      }
      await Place.findByIdAndDelete(placeId);

      res.status(200).send(`Place with id ${placeId} deleted successfully`);
    } else {
      res.status(404).send(`Place with id ${placeId} not found`);
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.delete("/bookings/:bookingId", async (req, res) => {
  const bookingId = req.params.bookingId;
  try {
    await Booking.findByIdAndDelete(bookingId);
    res.status(200).send(`Booking with id ${bookingId} deleted successfully`);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/places/:placeId/bookings", async (req, res) => {
  try {
    const place = await Place.findById(req.params.placeId);
    if (!place) {
      return res.status(404).json({ message: "Place not found" });
    }

    const bookings = await Booking.find({ place: place._id });

    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.listen(port, () =>
  console.log(`Server running at http://localhost:${port}`)
);
