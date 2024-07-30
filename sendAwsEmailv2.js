const AWS = require("aws-sdk");
require("dotenv").config();

const SES_Config = {
  accessKeyId: process.env.SES_ACCESS_KEY,
  secretAccessKey: process.env.SES_ACCESS_KEY_SECRET,
  region: "ap-south-1",
};

const AWS_SES = new AWS.SES(SES_Config);

exports.sendEmail = async (from, to, subject, textContent, html) => {
  const params = {
    Source: process.env.SES_SENDER,
    Destination: {
      ToAddresses: to,
    },
    ReplyToAddresses: [],
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: html,
        },
        Text: {
          Charset: "UTF-8",
          Data: textContent,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: subject,
      },
    },
  };

  try {
    const data = await AWS_SES.sendEmail(params).promise();
    console.log("email sent", data);
  } catch (err) {
    console.log(err);
  }
};
