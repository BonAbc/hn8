import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import passport from "passport";
import dotenv from "dotenv";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import flash from "connect-flash";
import helmet from "helmet";
import compression from "compression";

dotenv.config();
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

// ----------------------------
// Compression & Security
// ----------------------------
app.use(compression());
app.set("trust proxy", 1);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

function getToday() {
  return new Date().toISOString().split("T")[0];
}

// ----------------------------
// TEMP: No DB Mode
// ----------------------------
const db = {
  query: async () => {
    console.warn("⚠️ DB is disabled.");
    return { rows: [], rowCount: 0 };
  },
};

// ----------------------------
// TEMP: In-Memory Session for Dev
// ----------------------------
app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallbacksecret",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false,
      sameSite: "lax",
      httpOnly: true,
      maxAge: 1000 * 60 * 30,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req, res, next) => {
  res.locals.message = req.flash("error");
  next();
});

// ----------------------------
// Helmet & Rate Limiting
// ----------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: true,
  })
);

const authLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Try again later.",
});
app.use("/login", authLimiter);

// ----------------------------
// Static Routes Only
// ----------------------------
app.get("/", (req, res) =>
  res.render("index.ejs", { defaultDate: getToday() })
);
app.get("/about", (req, res) =>
  res.render("about.ejs", { defaultDate: getToday() })
);
app.get("/contact", (req, res) =>
  res.render("contact.ejs", { defaultDate: getToday(), thanks: null })
);
app.get("/link", (req, res) =>
  res.render("link.ejs", { defaultDate: getToday() })
);
app.get("/anotherlink", (req, res) =>
  res.render("anotherlink.ejs", { defaultDate: getToday() })
);
app.get("/otherlink", (req, res) =>
  res.render("otherlink.ejs", { defaultDate: getToday() })
);
app.get("/calculate", (req, res) =>
  res.render("calculator.ejs", { defaultDate: getToday() })
);
app.get("/mortgage", (req, res) =>
  res.render("mortgage.ejs", { defaultDate: getToday() })
);
app.get("/hana", (req, res) =>
  res.render("hana.ejs", { defaultDate: getToday() })
);
app.get("/hnpage", (req, res) =>
  res.render("HN.ejs", { defaultDate: getToday() })
);
app.get("/login", (req, res) =>
  res.render("login.ejs", { defaultDate: getToday() })
);
app.get("/signup", (req, res) =>
  res.render("register.ejs", {
    errors: {},
    defaultDate: getToday(),
    formData: {},
  })
);
app.get("/chapw", (req, res) =>
  res.render("chapw.ejs", { defaultDate: getToday(), message: null })
);

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.redirect("/");
    });
  });
});
// ----------------------------
// Disabled DB Features (Safe Notices)
// ----------------------------
app.post("/signup", (req, res) =>
  res.send("🔧 Signup is currently disabled (DB not connected).")
);
app.post("/login", (req, res) =>
  res.send("🔧 Login is currently disabled (DB not connected).")
);
app.get("/tax", (req, res) =>
  res.send("🔧 Tax page is disabled (DB not connected).")
);
app.get("/mes", (req, res) =>
  res.send("🔧 Admin messages are disabled (DB not connected).")
);

// ----------------------------
// Healthcheck (For Render)
// ----------------------------
app.get("/health", (req, res) => {
  res.send("OK");
});

// ----------------------------
// Global Error Handler
// ----------------------------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Server error");
});

// ----------------------------
// Start Server
// ----------------------------
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
