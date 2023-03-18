import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import User from "./models/User";
import Place from "./models/Place";
import Booking from "./models/Booking";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import download from "image-downloader";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import multer from "multer";
import fs from "fs";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = process.env.JWT_SECRET || "ffneoijf29f8sudhf309fn";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use("/uploads", express.static(`${__dirname}/uploads`));
app.use(
  cors({
    credentials: true,
    origin: process.env.MAIN_URL || "http://localhost:5173",
  })
);

mongoose.connect(process.env.MONGO_URL);

function getUserDataFromReq(req) {
  return new Promise((resolve) => {
    jwt.verify(req.cookies.token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      resolve(userData);
    });
  });
}

app.post("/signup", async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const { firstname, lastname, email, password } = req.body;

  try {
    const userDoc = await User.create({
      firstname,
      lastname,
      email,
      password: bcrypt.hashSync(password, bcryptSalt),
    });

    res.json(userDoc);
  } catch (err) {
    res.status(422).json(err);
  }
});

app.post("/login", async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const { email, password } = req.body;
  const userDoc = await User.findOne({ email });
  if (userDoc) {
    const passOk = bcrypt.compare(password, userDoc.password);
    if (passOk) {
      jwt.sign(
        { email: userDoc.email, id: userDoc._id },
        jwtSecret,
        {},
        (err, token) => {
          if (err) {
            console.error(err);
            res.status(500).json({ error: "Internal server error" });
          } else {
            res.cookie("token", token).json(userDoc);
          }
        }
      );
    } else {
      res.status(422).json({ error: "Incorrect password" });
    }
  } else {
    res.status(404).json({ error: "User not found" });
  }
});

app.get("/profile", async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
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
  mongoose.connect(process.env.MONGO_URL);
  res.cookie("token", "").json(true);
});

app.post("/upload-by-link", async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const { link } = req.body;
  const newName = `${Date.now()}.jpg`;
  await download.image({
    url: link,
    dest: `${__dirname}/uploads/${newName}`,
  });
  res.json(newName);
});

const photosMiddleware = multer({ dest: "uploads" });
app.post("/upload", photosMiddleware.array("photos", 100), (req, res) => {
  const uploadedFiles = [];
  for (let i in req.files) {
    const { path, originalname } = req.files[i];
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    const newPath = `${path}.${ext}`;
    fs.renameSync(path, newPath);
    uploadedFiles.push(newPath.replace("uploads\\", ""));
  }
  res.json(uploadedFiles);
});

app.post("/places", (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
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
  mongoose.connect(process.env.MONGO_URL);
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const { id } = userData;
    res.json(await Place.find({ owner: id }));
  });
});

app.get("/places/:id", async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const { id } = req.params;
  res.json(await Place.findById(id));
});

app.put("/places", async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
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
      // Get old photos of the place
      const oldPhotos = placeDoc.photos;

      // Update the place with the new data
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

      // Remove unused images
      const usedPhotos = new Set(placeDoc.photos);
      for (const photo of oldPhotos) {
        if (!usedPhotos.has(photo)) {
          try {
            fs.unlinkSync(`./uploads/${photo}`);
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
  mongoose.connect(process.env.MONGO_URL);
  res.json(await Place.find());
});

app.post("/bookings", async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
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
  mongoose.connect(process.env.MONGO_URL);
  const userData = await getUserDataFromReq(req);
  res.json(await Booking.find({ user: userData.id }).populate("place"));
});

app.delete("/places/:placeId", async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const placeId = req.params.placeId;
  try {
    const placeDoc = await Place.findById(placeId);
    if (placeDoc) {
      // Delete all bookings with matching place ID
      await Booking.deleteMany({ place: placeId });

      // Remove all images of the place
      for (const photo of placeDoc.photos) {
        try {
          fs.unlinkSync(`./uploads/${photo}`);
        } catch (err) {
          console.log(err);
        }
      }

      // Delete the place
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
  mongoose.connect(process.env.MONGO_URL);
  const bookingId = req.params.bookingId;
  try {
    await Booking.findByIdAndDelete(bookingId);
    res.status(200).send(`Booking with id ${bookingId} deleted successfully`);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/places/:placeId/bookings", async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
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

app.listen(port, () => console.log(`Back-end app listening on port ${port}!`));

export default app;
