import express from "express";
import bodyParser from "body-parser";
import pkg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import dotenv from "dotenv";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import flash from "connect-flash";
import helmet from "helmet";
import compression from "compression";
import connectPg from "connect-pg-simple";

import { DateTime } from "luxon";

dotenv.config();

const app = express();
// ----------------------------
// HTTPS Redirect Middleware
// ----------------------------
app.use((req, res, next) => {
  // Only redirect in production
  if (
    process.env.NODE_ENV === "production" &&
    req.headers["x-forwarded-proto"] !== "https"
  ) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});
// ----------------------------
// Compression & Security
// ----------------------------
app.use(compression());
app.set("trust proxy", 1);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.set("views", path.join(__dirname, "views"));
const nowChicago = DateTime.now().setZone("America/Chicago").toISO();
// Refer to Line 19
console.log(nowChicago);

//change to https
// Canonical URL Middleware (Production Only)
// ----------------------------
function getCanonicalUrl(req) {
  const baseUrl = process.env.BASE_URL || "https://hieuncpa.com";
  return `${baseUrl}${req.originalUrl}`;
}

if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    res.locals.canonical = getCanonicalUrl(req);
    next();
  });
} else {
  // Optional: helpful for local testing
  app.use((req, res, next) => {
    res.locals.canonical = `http://localhost:${process.env.PORT || 3000}${
      req.originalUrl
    }`;
    next();
  });
}

//end change to htttps
// function name plugged into app.get
//function getToday() {
// return new Date().toISOString().split("T")[0];
//}
//function getToday() {
// const today = new Date();
//  const year = today.getFullYear();
//  const month = String(today.getMonth() + 1).padStart(2, "0");
// const day = String(today.getDate()).padStart(2, "0");
// return `${year}-${month}-${day}`;
//}

function getToday() {
  return DateTime.now().setZone("America/Chicago").toFormat("yyyy-MM-dd");
}
// ----------------------------
// PostgreSQL Connection
// ----------------------------
const { Pool } = pkg;
const port = process.env.PORT || 3000;

const db = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: parseInt(process.env.PGPORT, 10),
  ssl: { rejectUnauthorized: false },
});
db.connect()
  .then(() => console.log("✅ Postgres connected"))
  .catch((err) => console.error("❌ Postgres connection error:", err));

// ----------------------------
// Session Handling
//store: save new PgSession in the table
// ----------------------------
const PgSession = connectPg(session);
app.use(
  session({
    store: new PgSession({
      pool: db,
      tableName: "session",
      createTableIfMissing: true, // 👈 This line auto-creates the table if it's missing
    }),
    secret: process.env.SESSION_SECRET || "fallbacksecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 1000 * 60 * 30, // 30 minutes
    },
  })
);
//The secret is used to sign and verify session cookies.The secret: A password for cookies so no one can fake them.
//app.use(session):use session for all incoming request
//cookie is a small piece of data your server tells the browser to store. : the backend
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req, res, next) => {
  res.locals.message = req.flash("error");
  next();
});

// ----------------------------
// Security & Rate Limiting
// ----------------------------
const authLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Try again later.",
});
app.use("/login", authLimiter);

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

// ----------------------------
// Password & Admin Utilities
// ----------------------------
const saltRounds = 12;
// take parameter password
function isValidPassword(password) {
  const minLength = 8;
  const hasNumber = /\d/;
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/;
  const hasUppercase = /[A-Z]/;
  if (!password || typeof password !== "string") return false;
  return (
    password.length >= minLength &&
    hasNumber.test(password) &&
    hasSpecialChar.test(password) &&
    hasUppercase.test(password)
  );
}
// test is a method name
//const hasNumber = /\d/;  pattern: any digit (0–9)
const adminEmails = process.env.ADMIN_EMAILS
  ? process.env.ADMIN_EMAILS.split(",").map((email) => email.trim())
  : [];

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}
//end ensure Authenticated
// function ensureAdmin
//track
function ensureAdmin(req, res, next) {
  if (
    req.isAuthenticated &&
    req.isAuthenticated() &&
    adminEmails.includes(req.user.email)
    //adminEmails line 180
  ) {
    return next();
  }

  return res.status(403).render("HN.ejs", {
    message: "Thank you for visiting Hieu Nguyen Page.",
    defaultDate: getToday(),
  });
}
// ----end track------------------------

// end function ensureAdmin

app.get("/", (req, res) =>
  res.render("index.ejs", { defaultDate: getToday() })
);
app.get("/about", (req, res) =>
  res.render("about.ejs", { defaultDate: getToday() })
);

// Contact
app.get("/contact", (req, res) =>
  res.render("contact.ejs", { defaultDate: getToday(), thanks: null })
);
//app.post/contact

// Additional Links & Tools
app.get("/link", (req, res) =>
  res.render("link.ejs", { defaultDate: getToday() })
);
app.get("/anotherlink", (req, res) =>
  res.render("anotherlink.ejs", { defaultDate: getToday() })
);
//app.get("/otherlink", (req, res) =>
//  res.render("otherlink.ejs", { defaultDate: getToday() })
//);
app.get("/otherlink", async (req, res) => {
  try {
    // Query tax data from database
    const results = await db.query("SELECT * FROM obb ORDER BY id");

    // Render tax page with data
    res.render("otherlink.ejs", {
      defaultDate: getToday,
      taxDatas: results.rows,
    });
  } catch (err) {
    console.error("Error loading tax data:", err);
    res.status(500).send("Error loading tax data");
  }
});
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
  res.render("HN.ejs", {
    defaultDate: getToday(),
    message: "Thank you for your business.",
  })
);

app.get("/tax", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM taxrate_2025 ORDER BY id");
    res.render("tax.ejs", { defaultDate: getToday(), taxData: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading tax data");
  }
});

//app.get("/mes", async (req, res) => {
//  if (!adminEmails.includes(req.user.email))
//    return res.status(403).render("denied.ejs", {
//      defaultDate: getToday(),
//      message: "Access denied",
//    });
//  try {
//    const result = await db.query("SELECT * FROM cliinfo ORDER BY id");
//    res.render("mes.ejs", { defaultDate: getToday(), mes: result.rows });
// } catch (err) {
//    console.error(err);
//    res.status(500).send("Error loading data");
//  }
//});

// ----------------------------
// Login / Signup / Change Password
// ----------------------------
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

// Signup POST

// Passport
passport.use(
  new Strategy(async (username, password, cb) => {
    try {
      const result = await db.query("SELECT * FROM my_user WHERE email=$1", [
        username,
      ]);
      if (result.rows.length === 0) return cb(null, false);
      const user = result.rows[0];
      bcrypt.compare(password, user.pw, (err, match) => {
        if (err) return cb(err);
        if (match) return cb(null, user);
        return cb(null, false);
      });
    } catch (err) {
      cb(err);
    }
  })
);
//end passport: cb is a function return: stop right there and cb function return some values.

passport.serializeUser((user, cb) => cb(null, user.id));
passport.deserializeUser(async (id, cb) => {
  try {
    const result = await db.query("SELECT * FROM my_user WHERE id=$1", [id]);
    if (result.rows.length === 0) return cb(null, false);
    cb(null, result.rows[0]);
  } catch (err) {
    cb(err);
  }
});

// Login POST

// Change password POST

//add track
app.set("trust proxy", true); // needed to capture real IP behind proxies

// Visitor Tracking Route

//end track

// Global Error Handler
// ----------------------------
app.use((err, req, res, next) => {
  console.error("❌ Uncaught error:", err);
  res.status(500).send("Server error");
});

// ----------------------------
// Start Server for both production and local.
// ----------------------------
app.listen(port, () => {
  const mode = process.env.NODE_ENV || "production";
  console.log(`✅ Server running in ${mode} mode on port ${port}`);
});
// for local dev only
//app.listen(port, () => {
// console.log(`🚀 Server running on http://localhost:${port}`);
//});
