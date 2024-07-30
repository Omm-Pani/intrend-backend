const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
require("dotenv").config();

const SES_Config = new SESClient({
  credentials: {
    accessKeyId: process.env.SES_ACCESS_KEY,
    secretAccessKey: process.env.SES_ACCESS_KEY_SECRET,
  },
  region: "ap-south-1",
});

const sesClient = new SESClient(SES_Config);

const sendEmail = async (email) => {
  console.log(process.env.SES_ACCESS_KEY);
  const params = {
    Source: process.env.SES_SENDER,
    Destination: {
      ToAddresses: [email],
    },
    ReplyToAddresses: [],
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: "<h1>this is test email</h1>",
        },
        Text: {
          Charset: "UTF-8",
          Data: "this is test email",
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: "Verify Your Email",
      },
    },
  };

  try {
    const sendEmailCommand = new SendEmailCommand(params);
    const data = await sesClient.send(sendEmailCommand);
    console.log("email sent", data);
  } catch (err) {
    console.log(err);
  }
};
sendEmail("ditupani@gmail.com");
