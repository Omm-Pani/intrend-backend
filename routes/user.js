const express = require("express");
var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");
const { sendEmail } = require("../sendEmail");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const userRouter = express.Router();

userRouter.post("/send-otp", async (req, res) => {
  try {
    const { emailId } = req.body;

    // Check if email is already in use
    const isEmailUsed = await prisma.user.findUnique({
      where: { email: emailId },
    });
    if (isEmailUsed) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // Generate OTP
    const otp = generateOTP();

    // Store OTP and expiry time in session
    req.session.otp = { value: otp, expiresAt: Date.now() + 5 * 60 * 1000 }; // 5 min expiry
    req.session.save((err) => {
      if (err) {
        console.error("Error saving session:", err);
        return res.status(500).send({ message: "Error during session save" });
      }
    });

    // Send OTP via email
    try {
      const response = await sendEmail(
        emailId,
        "Intrend Login OTP",
        "",
        `<p>Your OTP is ${otp}</p>`
      );
      console.log("Sent OTP:", otp);
      res.status(200).json({ message: "OTP sent successfully" });
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      return res.status(500).json({ message: "Failed to send OTP email" });
    }
  } catch (error) {
    console.error("Error in OTP generation:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Utility to generate OTP
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

userRouter.post("/signup", async (req, res) => {
  try {
    const { username, emailId, password, otp } = req.body;
    console.log(req.session.otp);
    // Input validation
    if (!username || !emailId || !password || !otp) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check OTP
    if (!req.session.otp || otp !== req.session.otp.value) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    if (Date.now() > req.session.otp.expiresAt) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    // Encrypt password
    const salt = bcrypt.genSaltSync(10);
    const cryptedPassword = bcrypt.hashSync(password, salt);

    // Create user in database
    const user = await prisma.user.create({
      data: {
        username: username,
        password: cryptedPassword,
        email: emailId,
      },
    });

    // Generate JWT token
    const token = generateToken(user.id);

    // Clear OTP from session
    req.session.otp = null;

    res.status(201).json({
      username: user.username,
      email: user.email,
      token: token,
      message: "Account successfully created",
    });
  } catch (error) {
    console.error("Error during sign-up:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Utility function for JWT token generation
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

userRouter.post("/signin", async (req, res) => {
  try {
    const { emailId, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email: emailId } });
    if (!user) {
      return res.status(400).json("User does not exist");
    }

    const check = bcrypt.compareSync(password, user.password);
    if (!check) {
      return res.status(400).json("Incorrect password");
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.send({
      username: user.username,
      email: user.email,
      token: token,
      message: "logged In successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

userRouter.post("/store-calendar-events", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(400).json({ message: "User does not exist" });
    }

    const { platform, theme, startTime, endTime, timeCreated } = req.body;
    if (!platform || !theme || !startTime || !endTime || !timeCreated) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newCalendarEvent = await prisma.calendarEvent.create({
      data: {
        platform: platform,
        theme: theme,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        timeCreated: timeCreated,
        userId: userId,
      },
    });

    res.status(200).json({
      message: "Calender event stored successfully",
      calenderEvent: newCalendarEvent,
    });
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    res.status(500).json({ message: error.message });
  }
});

userRouter.get("/get-calendar-events", async (req, res) => {
  try {
    const authHeader = req.headers.authorization; // Use lowercase "authorization"

    // Validate token
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Authorization token is required" });
    }
    const token = authHeader.split(" ")[1];

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: "User does not exist" });
    }

    // Fetch calendar events for the user
    const calendarEvents = await prisma.calendarEvent.findMany({
      where: { userId: userId },
    });

    // Respond with the events
    res.status(200).json({
      message: "Calendar events fetched successfully",
      calendarEvents,
    });
  } catch (error) {
    // Handle specific JWT errors
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // Handle other errors
    res.status(500).json({ message: error.message });
  }
});

module.exports = userRouter;
