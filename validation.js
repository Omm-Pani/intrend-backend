const User = require("./UserModel");

exports.validateEmail = (email) => {
  return String(email)
    .toLowerCase()
    .match(/^([a-z\d\.-]+)@([a-z\d-]+)\.([a-z]{2,12})(\.[a-z]{2,12})?$/);
};
exports.validateLength = (text, min, max) => {
  if (text.length > max || text.length < min) {
    return false;
  }
  return true;
};

exports.validateMobileNumber = (mobile_number)=>{
    return String(mobile_number).match("^[+]{1}(?:[0-9\-\(\)\/\.]\s?){6, 15}[0-9]{1}$");
}