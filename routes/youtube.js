const { PrismaClient } = require("@prisma/client");
const express = require("express");
const youtubeRouter = express.Router();
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const AWS = require("aws-sdk");
const axios = require("axios");

const prisma = new PrismaClient();

const auth = require("../middlewares/auth.js");

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_ACCESS_KEY_SECRET,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://intrend-backend.vercel.app/youtube/auth/callback"
);
const youtube = google.youtube({ version: "v3", auth: oauth2Client });

youtubeRouter.get("/auth", auth, async (req, res) => {
  const userId = req.userId;
  const url = await oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.upload",
    ],
    state: userId,
  });
  res.json({ url });
});

youtubeRouter.get("/auth/callback", async (req, res) => {
  try {
    const { code, state: userId } = req.query;
    const { tokens } = await oauth2Client.getToken(code);

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
      subscriber_count: channel.statistics.subscriberCount,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: new Date(tokens.expiry_date),
      userId: userId,
    }));

    await prisma.ytChannel.createMany({
      data: YtchannelData,
      skipDuplicates: true,
    });
    res.redirect("https://intrend.vercel.app/integrations");
  } catch (error) {
    console.log("error during authentication", error);
    res.status(500).send("Error during Youtube authentication");
  }
});

youtubeRouter.get("/list-channels", auth, async (req, res) => {
  try {
    const userId = req.userId;
    const channels = await prisma.ytChannel.findMany({
      where: {
        userId: userId,
      },
    });
    if (channels.length === 0) {
      return res.status(404).send("please connect youtube account");
    }
    return res.json(channels);
  } catch (error) {
    console.log(error);
    return res.status(500).send(`Error fetching channels: ${error}`);
  }
});

youtubeRouter.post("/reconnect-channel", auth, async (req, res) => {
  const userId = req.userId;
  const { channelId } = req.body;
  console.log(channelId);
  // Validate input
  if (!channelId) {
    console.warn("Channel ID is missing in the request body.");
    return res.status(400).json({ error: "Channel ID is required" });
  }

  try {
    // Retrieve the channel based on channelId and userId
    const channel = await prisma.ytChannel.findUnique({
      where: {
        channel_id: channelId,
        userId: userId,
      },
    });
    console.log("channel", channel);
    if (!channel) {
      console.warn(
        `Channel ${channelId} not found or not owned by user ${userId}.`
      );
      return res
        .status(404)
        .json({ error: "Channel not found or unauthorized" });
    }

    if (!channel.access_token) {
      console.warn(`Channel ${channelId} does not have authentication tokens.`);
      return res
        .status(401)
        .json({ error: "No authentication tokens available" });
    }

    // Set the credentials on the OAuth2 client
    oauth2Client.setCredentials({
      access_token: channel.access_token,
      refresh_token: channel.refresh_token,
      expiry_date: new Date(channel.expiry_date).getTime(),
    });

    // Listen for token updates
    oauth2Client.on("tokens", async (newTokens) => {
      console.log("Received new tokens:", newTokens);
      try {
        await prisma.ytChannel.update({
          where: { userId: userId, channel_id: channelId },
          data: {
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token,
            expiry_date: newTokens.expiry_date
              ? new Date(newTokens.expiry_date)
              : undefined,
          },
        });
        console.log(`Updated tokens in DB for channel ${channelId}.`);
      } catch (updateError) {
        console.error("Failed to update tokens in DB:", updateError);
      }
    });

    // Try to retrieve a valid access token
    try {
      const tokenResponse = await oauth2Client.getAccessToken();
      console.log("Token response:", tokenResponse);
      if (!tokenResponse || !tokenResponse.token) {
        console.error("No token returned from oauth2Client.getAccessToken.");
        return res.status(401).json({
          error: "Failed to retrieve access token. Please reauthenticate.",
        });
      }
    } catch (tokenError) {
      console.error("Error retrieving access token:", tokenError);
      return res.status(401).json({
        error: "Authentication tokens expired. Please reauthenticate.",
      });
    }

    return res.status(200).json({ message: "Channel selected successfully" });
  } catch (error) {
    console.error("Unexpected error in /reconnect-channel:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

youtubeRouter.post("/disconnect-channel", auth, async (req, res) => {
  try {
    const { channelId } = req.body;
    if (!channelId) {
      return res.status(400).json({ error: "Channel ID is required" });
    }

    let YtchannelData = [];
    try {
      // Try to fetch the user's YouTube channel data
      const response = await youtube.channels.list({
        part: "snippet,contentDetails,statistics",
        mine: true,
      });
      YtchannelData = response.data.items.map((channel) => ({
        channel_id: channel.id,
        channel_title: channel.snippet.title,
      }));
    } catch (err) {
      // Log the error but allow the process to continue
      console.error(
        "Error fetching channel data, skipping credential revocation:",
        err
      );
    }

    // If we have channel data and it matches, try to revoke credentials
    if (YtchannelData.length > 0 && YtchannelData[0].channel_id === channelId) {
      try {
        await oauth2Client.revokeCredentials();
      } catch (err) {
        console.warn("Failed to revoke credentials:", err);
      }
    }

    // Delete the channel from the database
    const deletedChannel = await prisma.ytChannel.deleteMany({
      where: {
        channel_id: channelId,
        userId: req.userId,
      },
    });

    if (deletedChannel.count === 0) {
      return res
        .status(404)
        .json({ error: "Channel not found or already removed" });
    }

    res.status(200).json({ message: "Channel disconnected successfully" });
  } catch (error) {
    console.error("Error disconnecting channel:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

youtubeRouter.get("/check-connected-channel", auth, async (req, res) => {
  // const tokenResponse = await oauth2Client.getAccessToken();
  // console.log("Token response connected:", tokenResponse);
  try {
    const response = await youtube.channels.list({
      part: "snippet,contentDetails,statistics",
      mine: true,
    });
    const YtchannelData = await response.data.items.map((channel) => ({
      channel_id: channel.id,
      channel_title: channel.snippet.title,
    }));

    if (YtchannelData.length === 0) {
      return res.status(404).send("No Channel Connected");
    }

    res.status(200).json({
      channel_id: YtchannelData[0].channel_id,
      channel_title: YtchannelData[0].channel_title,
    });
  } catch (error) {
    res.status(500).send("No channel connected");
  }
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

youtubeRouter.post("/upload/video", auth, async (req, res) => {
  const {
    s3VideoUrl,
    // s3ThumbnailUrl,
    title,
    description,
    tags,
    categoryId,
    privacyStatus,
    publishAt,
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
      let videoMetaData = {};
      if (publishAt) {
        videoMetaData = {
          snippet: {
            title: title || "Default Title",
            description: description || "Default Description",
            tags: tags || ["tag1", "tag2"],
            categoryId: categoryId || "22", // Category for "People & Blogs"
          },
          status: {
            privacyStatus: "private",
            publishAt: publishAt,
          },
        };
      } else {
        videoMetaData = {
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
      }

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

          console.log("Video uploaded successfully: " + data.data.id);
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

// youtubeRouter.post("/upload/video", async (req, res) => {
//   const { s3VideoUrl, title, description, tags, categoryId, privacyStatus } =
//     req.body;

//   if (!s3VideoUrl) {
//     return res.status(400).send("Missing s3VideoUrl");
//   }

//   // Generate a unique file name for the video in the OS temporary directory
//   const videoFilename = `${uuidv4()}.mp4`;
//   const videoPath = path.join(os.tmpdir(), videoFilename);

//   try {
//     // Download the video from S3 using axios and stream it to a local file
//     const response = await axios({
//       url: s3VideoUrl,
//       method: "GET",
//       responseType: "stream",
//     });

//     await pipeline(response.data, fs.createWriteStream(videoPath));

//     // Prepare the video metadata for YouTube
//     const videoMetaData = {
//       snippet: {
//         title: title || "Default Title",
//         description: description || "Default Description",
//         tags: tags || ["tag1", "tag2"],
//         categoryId: categoryId || "22", // Category for "People & Blogs"
//       },
//       status: {
//         privacyStatus: privacyStatus || "public",
//       },
//     };

//     const media = {
//       body: fs.createReadStream(videoPath),
//     };

//     // Wrap the YouTube API call in a Promise so that we can await it
//     const youtubeResponse = await new Promise((resolve, reject) => {
//       youtube.videos.insert(
//         {
//           part: "snippet,status",
//           resource: videoMetaData,
//           media: media,
//           notifySubscribers: true,
//         },
//         (err, data) => {
//           if (err) return reject(err);
//           resolve(data);
//         }
//       );
//     });

//     console.log("Video uploaded successfully: " + youtubeResponse.data.id);
//     res
//       .status(200)
//       .send(`Video uploaded successfully: ${youtubeResponse.data.id}`);
//   } catch (error) {
//     console.error("Error during upload process: ", error);
//     res.status(500).send("Failed to upload video");
//   } finally {
//     // Attempt to clean up the temporary video file asynchronously
//     fs.promises.unlink(videoPath).catch((err) => {
//       console.error("Error cleaning up temporary file:", err);
//     });
//   }
// });

module.exports = youtubeRouter;

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
