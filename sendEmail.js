const nodemailer = require("nodemailer");
require("dotenv").config();

exports.sendEmail = async (to, subject, textContent, html) => {
  console.log("to", to);
  console.log("subject", subject);
  console.log("textContent", textContent);
  console.log("html", html);

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

  const mail_options = {
    from: {
      name: "TEST",
      address: process.env.EMAIL_SENDER,
    },
    to: to,
    subject: subject.toString(),
    text: textContent,
    html: html.toString(),
  };

  try {
    let info = await transporter.sendMail(mail_options);
    console.log("Email sent: " + info.response);
  } catch (error) {
    console.log("Error sending email: ", error);
  }
};

// Example usage (uncomment to test):
// sendEmail(
//   ["ommpani9@gmail.com", "ommpani99@gmail.com"],
//   "Test Subject",
//   "Test text content",
//   "<p>Test HTML content</p>"
// );
