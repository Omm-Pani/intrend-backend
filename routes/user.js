const express = require("express");
var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");
const { sendEmail } = require("../sendEmail");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const userRouter = express.Router();

userRouter.post("/send-otp", async (req, res) => {
  try {
    const emailId = req.body.emailId;

    const isEmailUsed = await prisma.user.findUnique({
      where: { email: emailId },
    });

    if (isEmailUsed) {
      return res.status(400).json({ message: "email already in use" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    req.session.otp = otp.toString();

    req.session.save((err) => {
      if (err) {
        console.error("Error saving session:", err);
        return res.status(500).send("Error during session save");
      }
    });

    const response = await sendEmail(
      emailId,
      "Intrend Login OTP",
      "",
      `<p>Your OTP is ${otp}</p>`
    );
    res.send({ message: response });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

userRouter.post("/signup", async (req, res) => {
  try {
    const { username, emailId, password, otp } = req.body;
    const salt = bcrypt.genSaltSync(10);
    const cryptedPassword = bcrypt.hashSync(password, salt);
    console.log("otp", req.session.otp);
    if (otp !== req.session.otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const user = await prisma.user.create({
      data: {
        username: username,
        password: cryptedPassword,
        email: emailId,
      },
    });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.send({
      username: user.username,
      email: user.email,
      token: token,
      message: "account successfully created",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

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

module.exports = userRouter;
