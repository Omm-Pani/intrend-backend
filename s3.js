// const aws = require("aws-sdk");
// const crypto = require("crypto");
// const { promisify } = require("util");
// const randomBytes = promisify(crypto.randomBytes);

// require("dotenv").config();

// const region = "ap-south-1";
// const bucketName = "intrend-images";
// const accessKeyId = process.env.AWS_ACCESS_KEY;
// const secretAccessKey = process.env.AWS_ACCESS_KEY_SECRET;

// const s3 = new aws.S3({
//   region,
//   accessKeyId,
//   secretAccessKey,
//   signatureVersion: "v4",
// });

// exports.generateUploadURL = async () => {
//   const rawBytes = await randomBytes(16);
//   const imageName = rawBytes.toString("hex");

//   const params = {
//     Bucket: bucketName,
//     Key: imageName,
//     Expires: 3600,
//   };

//   const uploadURL = await s3.getSignedUrlPromise("putObject", params);
//   return uploadURL;
// };

// server.js

const AWS = require("aws-sdk");
require("dotenv").config();

const app = express();
const port = 3000;

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

app.post("/generate-presigned-urls", (req, res) => {
  const { files } = req.body; // Assume `files` is an array of objects with `fileName` and `fileType`

  const urls = files.map((file) => {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: file.fileName,
      Expires: 60, // URL expiry time in seconds
      ContentType: file.fileType,
    };

    const url = s3.getSignedUrl("putObject", params);
    return { url, key: file.fileName };
  });

  res.json({ urls });
});
