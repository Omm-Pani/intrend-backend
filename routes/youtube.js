const { PrismaClient } = require("@prisma/client");
const express = require("express");
const youtubeRouter = express.Router();
const { google } = require("googleapis");

const fs = require("fs");
const path = require("path");
const AWS = require("aws-sdk");
const axios = require("axios");

const prisma = new PrismaClient();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_ACCESS_KEY_SECRET,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:5000/youtube/auth/callback"
);
const youtube = google.youtube({ version: "v3", auth: oauth2Client });

youtubeRouter.get("/auth", async (req, res) => {
  const url = await oauth2Client.generateAuthUrl({
    access_type: "offline",
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.upload",
    ],
  });
  res.redirect(url);
});

youtubeRouter.get("/auth/callback", async (req, res) => {
  try {
    const { tokens } = await oauth2Client.getToken(req.query.code);
    oauth2Client.setCredentials(tokens);
    const service = google.youtube("v3");
    // Get channel data
    const channelsResponse = await service.channels.list({
      auth: oauth2Client,
      part: "snippet,contentDetails,statistics",
      mine: true,
    });

    const YtchannelData = await channelsResponse.data.items.map((channel) => ({
      channel_id: channel.id,
      channel_title: channel.snippet.title,
      channel_description: channel.snippet.description,
      channel_thumbnail: channel.snippet.thumbnails.default.url,
    }));

    await prisma.ytchannel.createMany({
      data: YtchannelData,
      skipDuplicates: true,
    });
    res.redirect("http://localhost:3000/integrations");
  } catch (error) {
    console.log("error during authentication", error);
    res.status(500).send("Error during Youtube authentication");
  }
});

youtubeRouter.get("/list-channels", async (req, res) => {
  const channels = await prisma.ytchannel.findMany();
  return res.json(channels);
});

youtubeRouter.post("/s3ThumbnailUrl", (req, res) => {
  const { file } = req.body; // Assume `files` is an array of objects with `fileName` and `fileType`

  const url = s3.getSignedUrl("putObject", {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `thumbnails/${file.fileName}`,
    Expires: 300, // URL expiry time in seconds
    ContentType: file.fileType,
  });

  res.json({ url, key: `thumbnails/${file.fileName}` });
});

youtubeRouter.post("/s3VideoUrl", (req, res) => {
  const { file } = req.body; // Assume `files` is an array of objects with `fileName` and `fileType`

  const url = s3.getSignedUrl("putObject", {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `videos/${file.fileName}`,
    Expires: 300, // URL expiry time in seconds
    ContentType: file.fileType,
  });

  res.json({ url, key: `videos/${file.fileName}` });
});

// youtubeRouter.post("/upload", async (req, res) => {
//   const { videoTitle, videoDescription, videoFile, channelId } = req.body;
//   const filePath = `${__dirname}/uploads/${videoFile}`; // assuming video file path

//   const youtube = google.youtube({ version: "v3", auth: oauth2Client });
//   const response = await youtube.videos.insert({
//     part: "snippet,status",
//     requestBody: {
//       snippet: {
//         channelId: channelId,
//         title: videoTitle,
//         description: videoDescription,
//         tags: ["sample tag"],
//         categoryId: "22", // Assuming category as "People & Blogs"
//       },
//       status: {
//         privacyStatus: "public",
//       },
//     },
//     media: {
//       body: fs.createReadStream(filePath),
//     },
//   });

//   if (response.data.id) {
//     console.log(`Video uploaded to channel ID: ${channelId}`);
//     res.send("Video uploaded successfully!");
//   } else {
//     res.status(400).send("Failed to upload video.");
//   }
// });

youtubeRouter.post("/upload/video", async (req, res) => {
  const {
    s3VideoUrl,
    // s3ThumbnailUrl,
    title,
    description,
    tags,
    categoryId,
    privacyStatus,
  } = req.body;

  try {
    // Download the video and thumbnail from S3 to local storage
    const videoPath = path.resolve(__dirname, "video.mp4");
    const response = await axios({
      url: s3VideoUrl,
      method: "GET",
      responseType: "stream",
    });
    const writer = fs.createWriteStream(videoPath);
    response.data.pipe(writer);

    writer.on("finish", async () => {
      // Upload video to YouTube
      const videoMetaData = {
        snippet: {
          title: title || "Default Title",
          description: description || "Default Description",
          tags: tags || ["tag1", "tag2"],
          categoryId: categoryId || "22", // Category for "People & Blogs"
        },
        status: {
          privacyStatus: privacyStatus || "public",
        },
      };

      const media = {
        body: fs.createReadStream(videoPath),
      };

      youtube.videos.insert(
        {
          part: "snippet,status",
          resource: videoMetaData,
          media: media,
          notifySubscribers: true,
        },
        async (err, data) => {
          if (err) {
            console.error("Error uploading video: ", err);
            return res.status(500).send("Failed to upload video");
          }

          // Clean up the local video file
          fs.unlinkSync(videoPath);

          //upload thumbnail if any
          // if (s3ThumbnailUrl) {
          //   try {
          //     const thumbnailPath = path.resolve(__dirname, "thumbnail.jpg");
          //     const thumbnailResponse = await axios({
          //       url: s3ThumbnailUrl,
          //       method: "GET",
          //       responseType: "stream",
          //     });

          //     const thumbnailWriter = fs.createWriteStream(thumbnailPath);
          //     thumbnailResponse.data.pipe(thumbnailWriter);

          //     thumbnailWriter.on("finish", async () => {
          //       youtube.thumbnails.set(
          //         {
          //           videoId: data.data.id,
          //           media: {
          //             body: fs.createReadStream(thumbnailPath),
          //           },
          //         },
          //         (err) => {
          //           if (err) {
          //             console.error("Error uploading thumbnail: ", err);
          //             return res.status(500).send("Failed to upload thumbnail");
          //           }

          //           // Clean up the local thumbnail file
          //           fs.unlinkSync(thumbnailPath);
          //           res
          //             .status(200)
          //             .send(
          //               `Video and thumbnail uploaded successfully: ${videoId}`
          //             );
          //         }
          //       );
          //     });
          //     thumbnailWriter.on("error", (err) => {
          //       console.error("Error downloading thumbnail from S3: ", err);
          //       res.status(500).send("Failed to download thumbnail from S3");
          //     });
          //   } catch (thumbnailError) {
          //     console.error(
          //       "Error during thumbnail upload process: ",
          //       thumbnailError
          //     );
          //     res.status(500).send("Failed to upload thumbnail");
          //   }
          // }
          // else {
          // }
          alert("Video uploaded successfully: " + data.data.id);
          res.status(200).send(`Video uploaded successfully: ${data.data.id}`);
        }
      );
    });

    writer.on("error", (err) => {
      console.error("Error downloading video from S3: ", err);
      res.status(500).send("Failed to download video from S3");
    });
  } catch (error) {
    console.error("Error during upload process: ", error);
    res.status(500).send("Failed to upload video");
  }
});

module.exports = youtubeRouter;
