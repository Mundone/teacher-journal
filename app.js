// app.js

const express = require("express");
const swaggerUi = require("swagger-ui-express");
const logger = require("morgan");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const passport = require("passport");
const MicrosoftStrategy = require("passport-microsoft").Strategy;
const flash = require("connect-flash");
const cors = require("cors");
const { methodCheckMiddleware } = require("./middlewares/authMiddleware");
require("dotenv").config();
require("./config/passport-setup");
const authService = require("./services/authService");
const axios = require("axios");
const allModels = require("./models");
const responses = require("./utils/responseUtil");

const app = express();

// Middlewares
app.use(cors({ origin: true }));
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Swagger UI
const swaggerDocument = require("./swagger/swaggerConfig.js");
app.use("/api", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routers
const indexRouter = require("./routes/index.routes");
app.use(methodCheckMiddleware);
app.use("/", indexRouter);

passport.use(
  new MicrosoftStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET_VALUE,
      // callbackURL: "http://localhost:3000/auth/microsoft/callback",
      callbackURL: "https://api.teachas.online/auth/microsoft/callback",
      // callbackURL: "http://localhost:3032/",
      scope: ["user.read", "openid", "profile", "email"],
      authorizationURL:
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenURL: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      tenant: "common",
      session: false,
    },
    async function (accessToken, refreshToken, profile, done) {
      try {
        console.log("start: xxxxxx");
        console.log(profile);
        console.log("end: xxxxxxx");

        let updateUser = await allModels.User.findOne({
          where: { email: profile?.emails[0]?.value },
        });

        if (updateUser) {
          if (profile?.displayName) {
            updateUser.name = profile?.displayName;
          }
          if (profile?._json?.jobTitle) {
            updateUser.job_title = profile?._json.jobTitle;
          }
          if (profile?._json?.mobilePhone) {
            updateUser.phone_number = profile?._json.mobilePhone;
          }
          if (profile?._json?.officeLocation) {
            updateUser.office_location = profile?._json.officeLocation;
          }
          updateUser.teams_auth_token = accessToken;
          await updateUser.save();
        }

        const response = await fetch(
          "https://graph.microsoft.com/v1.0/me/photos/48x48/$value",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch profile image");
        }
        const imageArrayBuffer = await response?.arrayBuffer();
        const imageBuffer = Buffer.from(imageArrayBuffer);
        const base64Image = imageBuffer?.toString("base64");

        try {
          if (updateUser) {
            updateUser.profile_image = base64Image;
            await updateUser.save();
          }
          console.log("Profile image saved successfully.");
        } catch (error) {
          console.error("Error saving profile image:", error);
          throw error;
        }

        const { user, token, UserMenus } =
          await authService.authenticateUserService({
            email: profile?.emails[0]?.value,
            isDirect: true,
          });

        done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

app.get(
  "/auth/microsoft/callback",
  passport.authenticate("microsoft"),
  async (req, res) => {
    try {
      const authUser = req.user;

      const { user, token, UserMenus } =
        await authService.authenticateUserService({
          email: authUser?.email,
          isDirect: true,
        });

      res.redirect(`https://teachas.online?token=${token}`);
      // res.redirect(`http://localhost:3032?token=${token}`);
    } catch (error) {
      if (error.statusCode == 403) {
        responses.forbidden(res, error);
      } else {
        responses.internalServerError(res, error);
      }
    }
  }
);

app.get(
  "/auth/microsoft",
  passport.authenticate("microsoft"),
  async (req, res) => {
    try {
    } catch (error) {
      if (error.statusCode == 403) {
        responses.forbidden(res, error);
      } else {
        responses.internalServerError(res, error);
      }
    }
  }
);


app.get("/.well-known/microsoft-identity-association.json", (req, res) => {
  // Define the content of the microsoft-identity-association.json file
  const microsoftIdentityAssociation = {
    associatedApplications: [
      {
        applicationId: "81c67076-9db8-401b-b0f1-0fc46b20f778",
      },
    ],
  };
  res.setHeader("Content-Type", "application/json");

  res.json(microsoftIdentityAssociation);
});

module.exports = app;
