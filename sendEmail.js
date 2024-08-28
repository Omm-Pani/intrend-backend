const nodemailer = require("nodemailer");
require("dotenv").config();

exports.sendEmail = async (to, subject, textContent, html) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // Use `true` for port 465, `false` for all other ports
    auth: {
      user: process.env.EMAIL_SENDER,
      pass: process.env.EMAIL_SENDER_PASSWORD,
    },
  });

  // Convert array of recipients to comma-separated string if necessary
  // const recipients = Array.isArray(to) ? to.join(", ") : to;

  const mailOptions = {
    from: {
      name: "Intrend",
      address: process.env.EMAIL_SENDER,
    },
    to: to,
    subject: subject.toString(),
    text: textContent,
    html: html.toString(),
  };

  try {
    // await transporter.sendMail(mailOptions);
    let info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error; // Rethrow the error to be handled by the caller
  }
};
