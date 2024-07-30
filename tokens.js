const jwt = require("jsonwebtoken");

exports.generateToken = (payload, expiry) => {
  const token = jwt.sign(payload, process.env.TOKEN_SECRET, {
    expiresIn: expiry,
  });
  return token;
};