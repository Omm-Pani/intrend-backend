require("dotenv").config();

const AWS = require("aws-sdk");
const express = require("express");
const session = require("express-session");
const axios = require("axios");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const userRouter = require("./routes/user");
const { sendEmail } = require("./sendEmail");
const youtubeRouter = require("./routes/youtube");
const prisma = new PrismaClient();

const app = express();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_ACCESS_KEY_SECRET,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

app.use(
  cors({
    origin: "http://localhost:3000", // Frontend URL
    credentials: true, // Allow credentials (cookies) to be sent
  })
);

app.use(
  session({
    secret: "your_secret_key",
    resave: true,
    saveUninitialized: true,
    cookie: {
      secure: false, // Set to true if using HTTPS
      httpOnly: true,
      sameSite: "lax", // Or 'strict'/'none' based on your needs
    },
  })
);

app.use(
  fileUpload({
    useTempFiles: true,
  })
);
app.use(express.json());

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL;

// Routes and logic go here
app.use("/user", userRouter);
app.use("/youtube", youtubeRouter);

app.get("/auth/facebook", (req, res) => {
  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${CALLBACK_URL}&response_type=code&response_mode=query&scope=business_management,ads_management,instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_insights,pages_show_list,pages_read_engagement,pages_manage_metadata,pages_read_user_content,pages_manage_ads,pages_manage_posts,pages_manage_engagement
`;
  res.redirect(authUrl);
});
// https://www.facebook.com/v19.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${CALLBACK_URL}&scope=email,instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_insights,pages_show_list,pages_read_engagement,pages_manage_metadata,pages_read_user_content,pages_manage_ads,pages_manage_posts,pages_manage_engagement&response_type=code&response_mode=query
app.get("/auth/facebook/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) {
    res.status(400).send("Login failed: Missing authorization code");
    return;
  }

  try {
    const tokenResponse = await axios.get(
      `https://graph.facebook.com/v14.0/oauth/access_token?client_id=${FACEBOOK_APP_ID}&redirect_uri=${CALLBACK_URL}&client_secret=${FACEBOOK_APP_SECRET}&code=${code}`
    );
    const accessToken = tokenResponse.data.access_token;

    const userResponse = await axios.get(
      `https://graph.facebook.com/me?access_token=${accessToken}`
    );

    const userID = userResponse.data.id;

    let fbUser = await prisma.fbuser.findUnique({
      where: {
        user_id: userID,
      },
    });

    if (!fbUser) {
      fbUser = await prisma.fbuser.create({
        data: {
          user_id: userID,
          user_token: accessToken,
        },
      });
    } else {
      await prisma.fbuser.update({
        where: {
          user_id: userID,
        },
        data: {
          user_token: accessToken,
        },
      });
    }

    // Store user ID and access token in session
    req.session.fbUserId = fbUser.id;
    req.session.fbUserToken = accessToken;

    req.session.save((err) => {
      if (err) {
        console.error("Error saving session:", err);
        return res.status(500).send("Error during session save");
      }
      res.redirect("http://localhost:3000/integrations");
    });
  } catch (error) {
    console.error("Error during Facebook authentication:", error);
    res.status(500).send("Error during Facebook authentication");
  }
});

app.get("/list-pages", async (req, res) => {
  const fbUserToken = req.session.fbUserToken;
  if (!fbUserToken) {
    console.log("not logged in");
    return res.status(401).send("Not logged in");
  }
  try {
    const pagesResponse = await axios.get(
      `https://graph.facebook.com/v20.0/me/accounts?access_token=${fbUserToken}&fields=name,id,access_token,instagram_business_account`
    );
    // "https://graph.facebook.com/v20.0/me/accounts?fields=id%2Cname%2Caccess_token%2Cinstagram_business_account&access_token=EAACw..."
    // access_token=${fbUserToken}&fields=name,id,access_token,instagram_business_account

    const fbPagesData = pagesResponse.data.data.map((page) => ({
      page_id: page.id,
      page_name: page.name,
      page_token: page.access_token,
      ownerId: req.session.fbUserId,
      insta_business_id: page.instagram_business_account
        ? page.instagram_business_account.id
        : "",
    }));
    const FbPages = await prisma.fbpage.createMany({
      data: fbPagesData,
      skipDuplicates: true, // Avoid errors if records already exist
    });
    return res.json(pagesResponse.data.data);
  } catch (error) {
    console.error("Error fetching pages:", error);
    return res.status(500).send("Error fetching pages");
  }
});

app.post("/create-post", async (req, res) => {
  console.log("create-post reached");

  const { page_names, message, img_urls } = req.body;
  if (!Array.isArray(page_names) || page_names.length === 0) {
    return res.status(400).send("page_names must be a non-empty array");
  }

  console.log("page_names", page_names);
  console.log("message", message);
  console.log("img_urls", img_urls);
  try {
    // Fetch pages whose names are in the provided array
    const pages_info = await prisma.fbpage.findMany({
      where: {
        page_name: {
          in: page_names,
        },
      },
      select: {
        page_id: true,
        page_token: true,
        insta_business_id: true,
      },
    });

    if (pages_info.length === 0) {
      return res.status(404).send("No pages found with the provided names");
    }

    console.log("pages_info", pages_info);

    if (!img_urls || img_urls.length === 0) {
      console.log("No image URLs provided. Skipping image upload.");
      const results = await Promise.all(
        pages_info.map(async (page) => {
          try {
            const response = await axios.post(
              `https://graph.facebook.com/${page.page_id}/feed`,
              {
                message: message,
                access_token: page.page_token,
              }
            );
            return {
              page_id: page.page_id,
              status: "success",
              response: response.data,
            };
          } catch (error) {
            console.error(
              `Error posting to page ${page.page_id}:`,
              error.message
            );
            return {
              page_id: page.page_id,
              status: "error",
              error: error.message,
            };
          }
        })
      );

      res.json(results);
    } else {
      const results = await Promise.all(
        pages_info.map(async (page) => {
          try {
            console.log("img_urls[0]", img_urls[0]);
            const response = await axios.post(
              `https://graph.facebook.com/${page.page_id}/photos`,
              {
                url: img_urls[0],
                message: message,
                access_token: page.page_token,
              }
            );
            if (page.insta_business_id !== "") {
              // create instagram post container
              const instagram_post_container_id = await axios.post(
                ` https://graph.facebook.com/v20.0/${page.insta_business_id}/media
              ?image_url=${img_urls[0]}
              &caption=${message}&access_token=${page.page_token}`
              );
              // publish instagram post container

              const instagram_post_media_id = await axios.post(
                `https://graph.facebook.com/v20.0/${page.insta_business_id}/media_publish
              ?creation_id=${instagram_post_container_id.data.id}&access_token=${page.page_token}`
              );
              console.log("instagram_post_media_id", instagram_post_media_id);
            }

            return {
              page_id: page.page_id,
              status: "success",
              response: response.data,
            };
          } catch (error) {
            console.error(
              `Error posting to page ${page.page_id}:`,
              error.message
            );
            return {
              page_id: page.page_id,
              status: "error",
              error: error.message,
            };
          }
        })
      );
      res.json(results);
    }
    // Post the message to each page
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Error processing request");
  }
});

// Route for generating pre-signed URLs
app.post("/s3Urls", (req, res) => {
  const { files } = req.body; // Assume `files` is an array of objects with `fileName` and `fileType`

  const urls = files.map((file) => {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `photos/${file.fileName}`,
      Expires: 300, // URL expiry time in seconds
      ContentType: file.fileType,
    };

    const url = s3.getSignedUrl("putObject", params);
    return { url, key: `photos/${file.fileName}`, fullPath: params.Key };
  });

  res.json({ urls });
});

app.post("/delete-s3-images", async (req, res) => {
  const { keys } = req.body; // Assume `keys` is an array of object keys to delete

  try {
    const deletePromises = keys.map((key) => {
      const params = {
        Bucket: "intrend-images",
        Key: key,
      };
      return s3.deleteObject(params).promise();
    });

    await Promise.all(deletePromises);

    res.json({ message: "Images deleted successfully" });
  } catch (error) {
    console.error("Error deleting images:", error);
    res.status(500).json({ error: "Failed to delete images" });
  }
});

app.post("/send-email", async (req, res) => {
  const { from, to, subject, textContent, html } = req.body;
  console.log("from", from);
  console.log("to", to);
  console.log("subject", subject);
  console.log("textContent", textContent);
  console.log("html", html.toString());
  sendEmail(to, subject, textContent, html.toString());
});

app.listen(5000, () => {
  console.log("Server is running on port 5000");
});

process.on("exit", async () => {
  await prisma.$disconnect();
});
