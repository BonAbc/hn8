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

import http from "http";

import { Server } from "socket.io";

import { authenticator } from "@otplib/preset-default";
import QRCode from "qrcode";

import liveSocket from "./sockets/liveSocket.js";

import webtraffic from "./middleware/webtraffic.js";

import { ensureAdmin } from "./middleware/author.js";

import socialFileUpload from "./middleware/socialImageUpload.js";

import methodOverride from "method-override";

import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
//allow public reaction
import crypto from "crypto";
import cookieParser from "cookie-parser";
//
dotenv.config();

const app = express();
app.set("trust proxy", 1);
//

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

app.use(compression());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.use(methodOverride("_method"));

app.use(express.static("public"));

app.set("view engine", "ejs");
//
// allow public react
app.use(cookieParser());
//
app.use("/uploads", express.static("/uploads"));

//
const thumbnailDir = "/uploads/social/thumbnails";

if (!fs.existsSync(thumbnailDir)) {
  fs.mkdirSync(thumbnailDir, { recursive: true });
}
//
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.set("views", path.join(__dirname, "views"));
const nowChicago = DateTime.now().setZone("America/Chicago").toISO();

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
  }),
);
//The secret is used to sign and verify session cookies.The secret: A password for cookies so no one can fake them.
//app.use(session):use session for all incoming request
//cookie is a small piece of data your server tells the browser to store. : the backend
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.message = req.flash("error");
  next();
});
const server = http.createServer(app);

const io = new Server(server);

liveSocket(io);

app.use(webtraffic(db, io));

const secret = authenticator.generateSecret();

authenticator.options = {
  digits: 6,
  step: 30,
};

const token = authenticator.generate(secret);

const authLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 30,
  message: "Too many login attempts. Try again later.",
});

app.use("/login", authLimiter);
//
const connectReactionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 15, // 15 reaction requests per IP
  message: {
    success: false,
    message: "Too many reaction requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

//

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
      },
    },
    crossOriginEmbedderPolicy: true,
  }),
);

const saltRounds = 12;
// take parameter password
function isValidPassword(password) {
  const minLength = 8;
  const hasNumber = /\d/;
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|/<>]/;
  const hasUppercase = /[A-Z]/;
  if (!password || typeof password !== "string") return false;
  return (
    password.length >= minLength &&
    hasNumber.test(password) &&
    hasSpecialChar.test(password) &&
    hasUppercase.test(password)
  );
}

const adminEmails = process.env.ADMIN_EMAILS
  ? process.env.ADMIN_EMAILS.split(",").map((email) => email.trim())
  : [];
//

//
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}

//function ensureAdmin(req, res, next) {

app.get("/", (req, res) =>
  res.render("index.ejs", { defaultDate: getToday() }),
);
app.get("/about", (req, res) =>
  res.render("about.ejs", { defaultDate: getToday() }),
);

// Contact
app.get("/contact", (req, res) =>
  res.render("contact.ejs", { defaultDate: getToday(), thanks: null }),
);
//app.post/contact

// Additional Links & Tools
app.get("/link", (req, res) =>
  res.render("link.ejs", { defaultDate: getToday() }),
);

app.get("/anotherlink", async (req, res) => {
  try {
    // Query tax data from database
    const pr = await db.query("SELECT * FROM obbpr ORDER BY id");

    // Render tax page with data
    res.render("anotherlink.ejs", {
      defaultDate: getToday(),
      prs: pr.rows,
    });
  } catch (err) {
    console.error("Error loading tax data:", err);
    res.status(500).send("Error loading tax data");
  }
});

app.get("/otherlink", async (req, res) => {
  try {
    // Query tax data from database
    const results = await db.query("SELECT * FROM obb ORDER BY id");

    // Render tax page with data
    res.render("otherlink.ejs", {
      defaultDate: getToday(),
      taxDatas: results.rows,
    });
  } catch (err) {
    console.error("Error loading tax data:", err);
    res.status(500).send("Error loading tax data");
  }
});
app.get("/calculate", (req, res) =>
  res.render("calculator.ejs", { defaultDate: getToday() }),
);
app.get("/mortgage", (req, res) =>
  res.render("mortgage.ejs", { defaultDate: getToday() }),
);
app.get("/hana", (req, res) =>
  res.render("hana.ejs", { defaultDate: getToday() }),
);
app.get("/hnpage", (req, res) =>
  res.render("HN.ejs", {
    defaultDate: getToday(),
    message: "Thank you for your business.",
  }),
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
//Tax calculation tool
app.get("/apti", async (req, res) => {
  try {
    // Query Table1: fs.fs
    const fsResult = await db.query("SELECT fs FROM fs order by fs");
    const fsValues = fsResult.rows.map((row) => row.fs);

    const stResult = await db.query("SELECT st, tr FROM st order by st");
    const stValues = stResult.rows.map((row) => row.st);

    // Build mapping { state: rate }
    const stateRates = {};
    stResult.rows.forEach((row) => {
      stateRates[row.st] = row.tr;
    });

    // ✅ Render view
    res.render("apti.ejs", {
      defaultDate: getToday(),
      fsValues,
      stValues,
      stateRates: stateRates || {}, // fallback if empty
    });
  } catch (err) {
    console.error("Error loading /sap:", err);
    res.status(500).send("Database error");
  }
});

app.get("/invoices", async (req, res) => {
  try {
    // Fetch all companies from the "companies" table
    // These will populate the "From:" dropdown in the invoice form
    const companies = (await db.query("SELECT * FROM companies")).rows;

    // Fetch all clients from the "clients" table
    // These will populate the "To:" dropdown in the invoice form
    const clients = (await db.query("SELECT * FROM clients")).rows;

    // Render the "new-invoice" EJS (or template) view
    // Fetch distinct existing states from invoice_items
    const statesResult = await db.query(
      "SELECT DISTINCT st FROM st ORDER BY st",
    );
    const states = statesResult.rows.map((r) => r.st).filter((v) => v); // remove null/empty

    // Fetch distinct existing locals from invoice_items
    const localsResult = await db.query(
      "SELECT DISTINCT local FROM st ORDER BY local",
    );
    const locals = localsResult.rows.map((r) => r.local).filter((v) => v);
    // Pass the fetched data and today's date to the view
    res.render("invoices", {
      companies,
      clients,
      defaultDate: getToday(),
      states,
      locals,
    });
  } catch (err) {
    // Log and handle any errors (e.g., DB connection failure)
    console.error(err);
    res.status(500).send("Error loading form");
  }
});

// ----------------------------
app.get("/login", (req, res) => {
  const showLoginModal = req.session.showLoginModal || false;
  const showAdminLoginModal = req.session.showAdminLoginModal || false;

  req.session.showLoginModal = false;
  req.session.showAdminLoginModal = false;

  res.render("signin.ejs", {
    defaultDate: getToday(),

    showLoginModal,
    showAdminLoginModal,
    alert: null,
  });
});

app.get("/chapw", (req, res) =>
  res.render("chapw.ejs", { defaultDate: getToday(), message: null }),
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
//
passport.use(
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM my_user WHERE email = $1", [
        username,
      ]);

      if (result.rows.length === 0) {
        return cb(null, false, {
          message: "Invalid username or password.",
        });
      }

      const user = result.rows[0];

      if (!user.is_active) {
        return cb(null, false, {
          message: "Your account is inactive. Please contact admin.",
        });
      }

      if (!user.pw) {
        console.warn("User authentication failed: password  missing");

        return cb(null, false, {
          message: "Invalid username or password.",
        });
      }

      //
      const match = await bcrypt.compare(password, user.pw);

      if (!match) {
        console.warn("User authentication failed");

        return cb(null, false, {
          message: "Invalid username or password.",
        });
      }

      return cb(null, user);
    } catch (err) {
      console.error("❌ PASSPORT STRATEGY ERROR:", err);
      return cb(err);
    }
  }),
);
//
passport.serializeUser((user, cb) => {
  cb(null, user.id);
});

passport.deserializeUser(async (id, cb) => {
  try {
    const result = await db.query(
      `
      SELECT *
      FROM my_user
      WHERE id = $1
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return cb(null, false);
    }

    return cb(null, result.rows[0]);
  } catch (err) {
    return cb(err);
  }
});
//
app.post("/login", (req, res, next) => {
  const requestId =
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);

  passport.authenticate("local", (err, user, info) => {
    if (err) {
      console.error("❌ PASSPORT ERROR:", err);
      return next(err);
    }

    if (!user) {
      req.flash("error", info?.message || "Invalid username or password.");

      return res.redirect("/login");
    }

    // ==========================================
    // FIRST-TIME 2FA
    // ==========================================

    if (!user.two_factor_enabled) {
      req.session.pendingSetupUser = user.id;
      req.session.pending2FAUser = null;
      req.session.isAdmin = adminEmails.includes(user.email);

      return req.session.save((sessionErr) => {
        if (sessionErr) {
          console.error("❌ SESSION SAVE ERROR:", sessionErr);
          return next(sessionErr);
        }

        return res.redirect("/enable-2fa");
      });
    }

    req.session.pending2FAUser = user.id;
    req.session.pendingSetupUser = null;
    req.session.isAdmin = adminEmails.includes(user.email);

    return req.session.save((sessionErr) => {
      if (sessionErr) {
        console.error("❌ SESSION SAVE ERROR:", sessionErr);
        return next(sessionErr);
      }

      return res.redirect("/2fa/verify-2fa");
    });
  })(req, res, next);
});
//Admin add user 👆

app.get("/enable-2fa", (req, res) => {
  if (!req.session.pendingSetupUser) {
    return res.redirect("/login");
  }

  return res.render("enable-2fa.ejs", {
    defaultDate: getToday(),
  });
});

//Add 2FA Page 👌👌👌👌👌👌
app.post("/enable-2fa", async (req, res, next) => {
  try {
    const userId = req.session.pendingSetupUser;

    if (!userId) {
      return res.redirect("/login");
    }

    const result = await db.query(
      `
      SELECT id, email
      FROM my_user
      WHERE id = $1
      `,
      [userId],
    );

    if (result.rows.length === 0) {
      return res.redirect("/login");
    }

    const email = result.rows[0].email;

    const secret = authenticator.generateSecret();

    // Save secret
    await db.query(
      `
      UPDATE my_user
      SET two_factor_secret = $1
      WHERE id = $2
      `,
      [secret, userId],
    );

    const otpauth = authenticator.keyuri(email, "HieuCPA", secret);

    // Generate QR
    const qrCode = await QRCode.toDataURL(otpauth);

    return res.render("setup-2fa.ejs", {
      defaultDate: getToday(),
      qrCode,
    });
  } catch (err) {
    console.error("❌ ENABLE 2FA ERROR:", err);

    return next(err);
  }
});
//Add 2FA enable 👌👌👌👌👌👌
//Add Add 2FA enable 👌👌👌👌👌👌
//Add Add 2FA enable 👌👌👌👌👌👌
//app.get("/verify-2fa-setup", (req, res) => {
// res.render("setup-2fa", { qrCode: "", defaultDate: getToday() });
//});
//Add 2FA enable 👌👌👌👌👌👌
//Add Add 2FA enable 👌👌👌👌👌👌

//Add message table 👌👌👌👌👌👌
//Add 2FA Page 👌👌👌👌👌👌
//Add message table 👌👌👌👌👌👌
app.post("/verify-2fa-setup", async (req, res, next) => {
  try {
    const userId = req.session.pendingSetupUser;
    const code = String(req.body.code || "").trim();

    if (!userId) {
      return res.redirect("/login");
    }

    if (!/^\d{6}$/.test(code)) {
      return res.render("setup-2fa.ejs", {
        qrCode: "",
        message: "Please enter the 6-digit verification code.",
        defaultDate: getToday(),
      });
    }

    const result = await db.query(
      `
      SELECT *
      FROM my_user
      WHERE id = $1
      `,
      [userId],
    );

    const user = result.rows[0];

    if (!user) {
      return res.redirect("/login");
    }

    if (!user.two_factor_secret) {
      return res.send("2FA secret is missing. Please restart 2FA setup.");
    }

    const isValid = authenticator.verify({
      token: code,
      secret: user.two_factor_secret,
    });

    if (!isValid) {
      return res.render("setup-2fa.ejs", {
        qrCode: "",
        message: "Wrong verification code.",
        defaultDate: getToday(),
      });
    }

    await db.query(
      `
      UPDATE my_user
      SET
        two_factor_enabled = true,
        failed_2fa_attempts = 0,
        two_fa_lock_until = NULL
      WHERE id = $1
      `,
      [userId],
    );

    req.logIn(user, (err) => {
      if (err) {
        console.error("❌ req.logIn ERROR:", err);
        return next(err);
      }

      req.session.isAdmin = adminEmails.includes(user.email);

      delete req.session.pendingSetupUser;
      delete req.session.pending2FAUser;

      return req.session.save((sessionErr) => {
        if (sessionErr) {
          console.error("❌ SESSION SAVE ERROR:", sessionErr);
          return next(sessionErr);
        }

        return res.redirect("/");
      });
    });
  } catch (err) {
    console.error("❌ VERIFY INITIAL 2FA ERROR:", err);
    return next(err);
  }
});

app.get("/2fa/verify-2fa", (req, res) => {
  res.render("verify-2fa.ejs", {
    defaultDate: getToday(),
  });
});

// Add 2FA Verify 👌👌👌👌👌👌
app.post("/2fa/verify-2fa", async (req, res, next) => {
  const code = req.body.code;

  const userId = req.session.pending2FAUser;

  // Safety check: no pending 2FA session
  if (!userId) {
    return res.redirect("/login");
  }

  const result = await db.query(
    `
    SELECT *
    FROM my_user
    WHERE id = $1 
    `,
    [userId],
  );

  const user = result.rows[0];

  // Safety check: user not found
  if (!user) {
    delete req.session.pending2FAUser;
    return res.redirect("/login");
  }

  // =====================================
  // CHECK 2FA LOCK
  // =====================================

  if (user.two_fa_lock_until && new Date(user.two_fa_lock_until) > new Date()) {
    return res.render("verify-2fa.ejs", {
      message: "Your account is locked. Please try again later.",
      defaultDate: getToday(),
    });
  }
  // =====================================
  // LOCK EXPIRED -> RESET COUNTER
  // =====================================

  if (
    user.two_fa_lock_until &&
    new Date(user.two_fa_lock_until) <= new Date()
  ) {
    await db.query(
      `
    UPDATE my_user
    SET
      failed_2fa_attempts = 0,
      two_fa_lock_until = NULL
    WHERE id = $1
    `,
      [user.id],
    );

    user.failed_2fa_attempts = 0;
    user.two_fa_lock_until = null;
  }

  // =====================================
  // VERIFY AUTHENTICATOR CODE
  // =====================================

  const isValid = authenticator.verify({
    token: code,
    secret: user.two_factor_secret,
  });
  // use field: user.two_factor_secret,
  // =====================================
  // INVALID 2FA CODE
  // =====================================

  if (!isValid) {
    const attempts = user.failed_2fa_attempts + 1;

    // Third failed attempt = lock 1 hour
    if (attempts >= 3) {
      await db.query(
        `
        UPDATE my_user
        SET
          failed_2fa_attempts = $1,
          two_fa_lock_until = NOW() + INTERVAL '1 minute'
        WHERE id = $2
        `,
        [attempts, user.id],
      );
      // interval ' 1 second'
      return res.render("verify-2fa.ejs", {
        message:
          "Too many failed verification attempts. Account locked for 1 hour.",
        defaultDate: getToday(),
      });
    }

    // First and second failures

    await db.query(
      `
      UPDATE my_user
      SET failed_2fa_attempts = $1
      WHERE id = $2
      `,
      [attempts, user.id],
    );

    return res.render("verify-2fa.ejs", {
      message: `Invalid verification code. ${2 - attempts} attempt(s) remaining. 2nd failure, your account will be locked for 1 hour`,
      defaultDate: getToday(),
    });
  }

  await db.query(
    `
    UPDATE my_user
    SET
      failed_2fa_attempts = 0,
      two_fa_lock_until = NULL
    WHERE id = $1
    `,
    [user.id],
  );

  if (req.session.pendingPasswordChange) {
    const { userId, newPassword, expires } = req.session.pendingPasswordChange;

    // Check expiration

    if (Date.now() > expires) {
      delete req.session.pendingPasswordChange;
      delete req.session.pending2FAUser;

      return res.send("Password change request expired");
    }

    // bcrypt AFTER successful 2FA

    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await db.query(
      `
      UPDATE my_user
      SET 
      pw = $1,
      pw_change_approved = false
      WHERE id = $2
      `,
      [hashedPassword, userId],
    );
    // when change > move here for 2 FA, set field to false not from route chapw
    delete req.session.pendingPasswordChange;
    delete req.session.pending2FAUser;

    return res.render("chapw.ejs", {
      message: "Password updated successfully!",
      defaultDate: getToday(),
    });
  }

  req.logIn(user, (err) => {
    if (err) {
      return next(err);
    }
    // Recompute admin status
    req.session.isAdmin = adminEmails.includes(user.email);

    delete req.session.pending2FAUser;

    return res.redirect(`/social/post`);
    //
  });
});
app.get("/reset-2fa", ensureAdmin, async (req, res) => {
  res.render("startover2fa.ejs", { defaultDate: getToday() });
});
//Add message table 👌👌👌👌👌👌 Use when a hack use selectively
app.post("/reset-2fa", ensureAdmin, async (req, res) => {
  // const userId = req.user.id;
  //const userId = req.body.userId;
  const email = req.body.email;

  // Remove old secret 👌👌👌👌👌👌 from startover2fa.js👌👌👌👌👌👌
  await db.query(
    `
    UPDATE my_user
    SET 
      two_factor_secret = NULL,
      two_factor_enabled = false,
      failed_2fa_attempts = 0,
    two_fa_lock_until = NULL
    WHERE email = $1  
   
    `,
    [email],
  );

  res.redirect("/login");
});
//
//Admin add user 👆
app.get("/add-user", ensureAdmin, (req, res) => {
  res.render("adduserbyadmin.ejs", { defaultDate: getToday() });
});
//
app.post("/add-user", ensureAdmin, async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  const group_id = parseInt(req.body.group_id, 10);

  // Validate group ID
  if (!Number.isInteger(group_id) || group_id < 1) {
    return res.send("Invalid group ID.");
  }

  try {
    // Check existing user
    const checkUser = await db.query("SELECT * FROM my_user WHERE email = $1", [
      email,
    ]);

    if (checkUser.rows.length > 0) {
      return res.send("Email already exists.");
    }

    // Same validation as signup
    if (!isValidPassword(password)) {
      return res.send("Invalid password.");
    }

    // Hash password
    bcrypt.hash(password, saltRounds, async (err, hash) => {
      if (err) {
        console.error("Error hashing password:", err);
        return res.status(500).send("Error creating user");
      }

      try {
        await db.query(
          `INSERT INTO my_user
           (email, pw, is_active, two_factor_enabled, group_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [email, hash, true, false, group_id],
        );

        // Admin stays logged in
        return res.redirect("/web/traffic/test");
      } catch (insertErr) {
        console.error("Error inserting user:", insertErr);
        return res.status(500).send("Error creating user");
      }
    });
  } catch (error) {
    console.error("Add user route error:", error);
    res.status(500).send("Error creating user");
  }
});
//
app.get("/users/loveme", ensureAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 6;
    const offset = (page - 1) * limit;

    const groupId = req.query.group_id || "";

    // Get group IDs dynamically
    const groupsResult = await db.query(`
      SELECT DISTINCT group_id
      FROM my_user
      WHERE group_id IS NOT NULL
      ORDER BY group_id
    `);

    const groups = groupsResult.rows;

    let result;
    let countResult;

    if (groupId) {
      result = await db.query(
        `SELECT id, email, is_active, group_id
         FROM my_user
         WHERE group_id = $1
         ORDER BY id
         LIMIT $2 OFFSET $3`,
        [groupId, limit, offset],
      );

      countResult = await db.query(
        `SELECT COUNT(*)
         FROM my_user
         WHERE group_id = $1`,
        [groupId],
      );
    } else {
      result = await db.query(
        `SELECT id, email, is_active, group_id
         FROM my_user
         ORDER BY id
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      );

      countResult = await db.query(`
        SELECT COUNT(*)
        FROM my_user
      `);
    }

    const totalUsers = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalUsers / limit);

    res.render("users.ejs", {
      users: result.rows,
      currentPage: page,
      totalPages,
      groupId,
      groups,
      defaultDate: getToday(),
      message: req.query.message,
    });
  } catch (err) {
    console.error("Load users error:", err);
    res.status(500).send("Error loading users");
  }
});

//
app.delete("/user/:id", ensureAdmin, async (req, res) => {
  const userId = req.params.id;
  const groupId = req.query.group_id;

  try {
    await db.query("UPDATE my_user SET is_active = false WHERE id = $1", [
      userId,
    ]);

    const redirectUrl = groupId
      ? `/users/loveme?group_id=${encodeURIComponent(groupId)}&message=disabled`
      : `/users/loveme?message=disabled`;

    res.redirect(redirectUrl);
  } catch (err) {
    console.error("Deactivate user error:", err);
    res.status(500).send("Error deactivating user");
  }
});
//Admin add user edit 👆
//Admin add user/reactivate 👆
app.put("/user/:id", ensureAdmin, async (req, res) => {
  const userId = req.params.id;

  try {
    await db.query("UPDATE my_user SET is_active = true WHERE id = $1", [
      userId,
    ]);

    res.redirect("/users/loveme?message=reactivated");
  } catch (err) {
    console.error("Reactivate user error:", err);
    res.status(500).send("Error reactivating user");
  }
});
//Admin add user edit 👆
app.get("/user/:id/edit", ensureAdmin, async (req, res) => {
  const userId = req.params.id;
  const groupId = req.query.group_id;

  try {
    const result = await db.query(
      `SELECT *
       FROM my_user
       WHERE id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).send("User not found");
    }

    res.render("users-edit.ejs", {
      user: result.rows[0],
      groupId,
      defaultDate: getToday(),
    });
  } catch (err) {
    console.error("Load edit user error:", err);
    res.status(500).send("Error loading user");
  }
});
//Admin add user edit 👆
app.patch("/user/:id", ensureAdmin, async (req, res) => {
  const userId = req.params.id;
  const { email, group_id } = req.body;

  // Preserve the filter that was used when opening Edit
  const filterGroupId = req.query.group_id;

  try {
    await db.query(
      `UPDATE my_user
       SET email = $1,
           group_id = $2
       WHERE id = $3`,
      [email, group_id, userId],
    );

    const redirectUrl = filterGroupId
      ? `/users/loveme?group_id=${encodeURIComponent(filterGroupId)}&message=updated`
      : `/users/loveme?message=updated`;

    res.redirect(redirectUrl);
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).send("Error updating user");
  }
});
app.get("/web/traffic/test", ensureAdmin, async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  const result = await db.query(
    `
        SELECT *
        FROM webtraffic
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
        `,
    [limit, offset],
  );

  const count = await db.query(
    `
        SELECT COUNT(*) 
        FROM webtraffic
        `,
  );

  const total = Number(count.rows[0].count);
  const totalPages = Math.ceil(total / limit);

  res.render("webtraffic", {
    visitors: result.rows,
    page,
    total, // add this
    totalPages,
    defaultDate: getToday(),
  });
});
//
app.post("/web/traffic/test/delete-selected", ensureAdmin, async (req, res) => {
  try {
    let ids = req.body.ids;

    if (!ids) {
      return res.redirect("/web/traffic/test");
    }

    // If only one checkbox was selected
    if (!Array.isArray(ids)) {
      ids = [ids];
    }

    ids = ids.map(Number).filter((id) => Number.isInteger(id));

    if (ids.length > 0) {
      await db.query(
        `
        DELETE FROM webtraffic
        WHERE id = ANY($1::int[])
        `,
        [ids],
      );
    }

    const page = Number(req.body.page) || 1;

    res.redirect(`/web/traffic/test?page=${page}`);
  } catch (error) {
    console.error("Delete selected error:", error);
    res.status(500).send("Failed to delete selected visitors");
  }
});

// Change password POST
app.post("/chapw", async (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const { email, newPassword, confirmPassword } = req.body;

  if (!email || !newPassword || !confirmPassword) {
    return res.render("chapw.ejs", {
      message: "All fields are required",
      defaultDate: getToday,
    });
  }

  if (newPassword !== confirmPassword) {
    return res.render("chapw.ejs", {
      message: "Passwords do not match",
      defaultDate: getToday,
    });
  }

  if (!isValidPassword(newPassword)) {
    return res.render("chapw.ejs", {
      message:
        "Password must be at least 8 characters and include a number, special character, and a capital letter",
      defaultDate: getToday,
    });
  }

  try {
    const userResult = await db.query("SELECT * FROM my_user WHERE email=$1", [
      email,
    ]);

    if (userResult.rows.length === 0) {
      return res.render("chapw.ejs", {
        message: "Email not registered",
        defaultDate: getToday,
      });
    }

    const user = userResult.rows[0];

    // Store password change request temporarily
    // Store password change request temporarily
    req.session.pendingPasswordChange = {
      userId: user.id,
      email: user.email,
      newPassword: newPassword,
      expires: Date.now() + 5 * 60 * 1000,
    };
    // bcrypt AFTER successful 2FA  👌👌👌👌👌👌
    // Admin approval check
    if (!user.two_factor_enabled) {
      if (!user.pw_change_approved) {
        return res.render("chapw.ejs", {
          message:
            "Password change requires administrator approval. Please contact your administrator.",
          defaultDate: getToday,
        });
      }

      // Approved by admin, continue password change
      return res.redirect("/complete-password-change");
    }

    // User has 2FA enabled
    req.session.pending2FAUser = user.id;

    return res.redirect("/2fa/verify-2fa");
    // bcrypt AFTER successful 2FA  👌👌👌👌👌👌 Refer to Line 771
  } catch (err) {
    console.error("Error preparing password update:", err);

    return res.render("chapw.ejs", {
      message: "Something went wrong, try again later",
      defaultDate: getToday,
    });
  }
});

//add track

app.get("/admin/password-approval", (req, res) => {
  if (!req.user || !adminEmails.includes(req.user.email)) {
    return res.status(403).send("Access denied");
  }

  res.render("password-approval.ejs", {
    defaultDate: getToday(),
    message: req.query.message || "",
  });
});
//✌✌✌ end sign up ✌✌✌
//✌✌✌ end sign up ✌✌✌
app.post("/admin/password-approval", async (req, res) => {
  if (!req.user || !adminEmails.includes(req.user.email)) {
    return res.status(403).send("Access denied");
  }

  const { email } = req.body;

  try {
    const checkUser = await db.query(
      `
  SELECT email, pw_change_approved
  FROM my_user
  WHERE email = $1
  `,
      [email],
    );

    if (checkUser.rows.length === 0) {
      return res.redirect(
        "/admin/password-approval?message=User email not found",
      );
    }

    if (checkUser.rows[0].pw_change_approved) {
      return res.redirect(
        "/admin/password-approval?message=This password change is already approved",
      );
    }

    await db.query(
      `
  UPDATE my_user
  SET pw_change_approved = true
  WHERE email = $1
  `,
      [email],
    );

    return res.redirect(
      "/admin/password-approval?message=Password change approved",
    );
    // res.send("Password change approved");
  } catch (err) {
    console.error(err);
    res.send("Error approving password change");
  }
});
//✌✌✌ end sign up ✌✌✌
//✌✌✌ end sign up authenticator ✌✌✌
//✌✌✌ end sign up authenticator ✌✌✌
app.get("/complete-password-change", async (req, res) => {
  const pending = req.session.pendingPasswordChange;

  if (!pending) {
    return res.redirect("/chapw");
  }
  // when enter > render below. First /chapw ✌✌✌ ✌✌✌
  res.render("complete-password-change.ejs", {
    message: "Your password change has been approved.",
    defaultDate: getToday(),
  });
});

//✌✌✌ end sign up ✌✌✌
app.post("/complete-password-change", async (req, res) => {
  const { newPassword, confirmPassword } = req.body;

  const pending = req.session.pendingPasswordChange;

  if (!pending) {
    return res.redirect("/chapw");
  }

  if (newPassword !== confirmPassword) {
    return res.render("complete-password-change.ejs", {
      message: "Passwords do not match.",
      defaultDate: getToday(),
    });
  }

  try {
    // Check admin approval
    const result = await db.query(
      `
      SELECT pw_change_approved
      FROM my_user
      WHERE id = $1
      `,
      [pending.userId],
    );

    if (result.rows.length === 0) {
      return res.render("complete-password-change.ejs", {
        message: "User not found.",
        defaultDate: getToday(),
      });
    }

    if (!result.rows[0].pw_change_approved) {
      return res.render("complete-password-change.ejs", {
        message: "Waiting for administrator approval.",
        defaultDate: getToday(),
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await db.query(
      `
      UPDATE my_user
      SET 
        pw = $1,
        pw_change_approved = false
      WHERE id = $2
      `,
      [hashedPassword, pending.userId],
    );

    delete req.session.pendingPasswordChange;

    return res.redirect("/login");
  } catch (err) {
    console.error("Password change error:", err);

    return res.render("complete-password-change.ejs", {
      message: "Something went wrong. Try again later.",
      defaultDate: getToday(),
    });
  }
});
//
const colors = [
  "#e1ffe4",
  "#ffe4e1",
  "#e4e1ff",
  "#fff8dc",
  "#7fc8a9",
  "#e0ffff",
  "#f2cc8f",
  "#add8e6",
  "#e9c46a",
  "#a8dadc",
];

const ALLOWED_TARGETS = ["post", "comment", "reply"];

const ALLOWED_REACTIONS = [
  "like",
  "dislike",
  "heart",
  "horse",
  "rose",
  "fly",
  "call",
  "website",
  "email",
  "smile",
  "bell",
  "trophy",
  "victory",
];

// ============================================================
// SOCIAL POST / FEED
// ============================================================
app.get("/social/post", ensureAuthenticated, async (req, res) => {
  try {
    // ========================================================
    // CURRENT USER
    // ========================================================

    const userId = req.user?.id || null;
    const userEmail = req.user?.email || null;

    const postId = req.query.postId ? parseInt(req.query.postId, 10) : null;

    if (req.query.postId && !Number.isInteger(postId)) {
      return res.status(400).send("Invalid post ID.");
    }

    // ========================================================
    // CURRENT USER GROUP
    // ========================================================

    let userGroupId = null;

    if (userId) {
      const groupResult = await db.query(
        `
        SELECT group_id
        FROM my_user
        WHERE id = $1
        `,
        [userId],
      );

      userGroupId = groupResult.rows[0]?.group_id ?? null;
    }

    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    const normalizedUserEmail = String(userEmail || "")
      .trim()
      .toLowerCase();

    const isAdmin =
      !!normalizedUserEmail && adminEmails.includes(normalizedUserEmail);

    const emailsAdmin = isEmailsAdmin(userEmail);

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const limit = 6;
    const offset = (page - 1) * limit;

    let totalPosts = 0;
    let totalPages = 1;

    // ========================================================
    // COUNT FEED
    // ========================================================

    if (!postId) {
      let totalPostsResult;

      // ======================================================
      // FULL ADMIN
      //
      // ADMIN_EMAILS can see ANY post
      // ======================================================

      if (isAdmin) {
        totalPostsResult = await db.query(
          `
          SELECT COUNT(*)::INTEGER AS total
          FROM social_posts
          `,
        );
      }

      // ======================================================
      // EMAILS ADMIN
      //
      // SPECIAL / HN CPA ADMIN can see:
      //   loggedin users
      //   ANY group_only
      //   own posts
      //
      // admin_only is NOT included here unless it is their
      // own post.
      // ======================================================
      else if (emailsAdmin) {
        totalPostsResult = await db.query(
          `
          SELECT COUNT(*)::INTEGER AS total
          FROM social_posts p

          WHERE
            p.visibility = 'loggedin users'

            OR p.visibility = 'group_only'

            OR p.user_id = $1
          `,
          [userId],
        );
      }

      // ======================================================
      // NORMAL USER
      // ======================================================
      else {
        totalPostsResult = await db.query(
          `
          SELECT COUNT(*)::INTEGER AS total
          FROM social_posts p

          JOIN my_user u
            ON u.id = p.user_id

          WHERE
            p.visibility = 'loggedin users'

            OR p.user_id = $1

            OR (
              p.visibility = 'group_only'
              AND $2::INTEGER IS NOT NULL
              AND u.group_id = $2::INTEGER
            )
          `,
          [userId, userGroupId],
        );
      }

      totalPosts = Number(totalPostsResult.rows[0]?.total) || 0;

      totalPages = Math.max(Math.ceil(totalPosts / limit), 1);

      if (page > totalPages && totalPosts > 0) {
        return res.redirect(`/social/post?page=${totalPages}`);
      }
    }

    // ========================================================
    // LOAD POSTS
    // ========================================================

    let postsResult;

    // ========================================================
    // SINGLE POST
    //
    // /social/post?postId=26
    // ========================================================

    if (postId) {
      postsResult = await db.query(
        `
        SELECT
          p.id,
          p.user_id,
          p.content,
          p.color,
          p.visibility,
          p.created_at,
          p.updated_at,
          u.email,
          u.group_id

        FROM social_posts p

        JOIN my_user u
          ON u.id = p.user_id

        WHERE
          p.id = $1

          AND (
            -- Everyone logged in can see public-to-users posts
            p.visibility = 'loggedin users'

            -- Owner can always see own post
            OR p.user_id = $2

            -- Full ADMIN_EMAILS admin can see ANY post
            OR $3 = TRUE

            -- HN CPA / EMAILS ADMIN can see ANY group post
            OR (
              $4 = TRUE
              AND p.visibility = 'group_only'
            )

            -- Normal user can see own group's posts
            OR (
              p.visibility = 'group_only'
              AND $5::INTEGER IS NOT NULL
              AND u.group_id = $5::INTEGER
            )
          )

        LIMIT 1
        `,
        [postId, userId, isAdmin, emailsAdmin, userGroupId],
      );

      if (!postsResult.rowCount) {
        return res.status(404).send("Post not found.");
      }
    }

    // ========================================================
    // FULL ADMIN FEED
    //
    // ADMIN_EMAILS can see ANY post
    // ========================================================
    else if (isAdmin) {
      postsResult = await db.query(
        `
        SELECT
          p.id,
          p.user_id,
          p.content,
          p.color,
          p.visibility,
          p.created_at,
          p.updated_at,
          u.email,
          u.group_id

        FROM social_posts p

        JOIN my_user u
          ON u.id = p.user_id

        ORDER BY
          p.created_at DESC,
          p.id DESC

        LIMIT $1
        OFFSET $2
        `,
        [limit, offset],
      );
    }

    // ========================================================
    // EMAILS ADMIN FEED
    //
    // HN CPA / SPECIAL ADMIN can see:
    //   loggedin users
    //   ANY group_only
    //   own posts
    // ========================================================
    else if (emailsAdmin) {
      postsResult = await db.query(
        `
        SELECT
          p.id,
          p.user_id,
          p.content,
          p.color,
          p.visibility,
          p.created_at,
          p.updated_at,
          u.email,
          u.group_id

        FROM social_posts p

        JOIN my_user u
          ON u.id = p.user_id

        WHERE
          p.visibility = 'loggedin users'

          OR p.visibility = 'group_only'

          OR p.user_id = $1

        ORDER BY
          p.created_at DESC,
          p.id DESC

        LIMIT $2
        OFFSET $3
        `,
        [userId, limit, offset],
      );
    }

    // ========================================================
    // NORMAL USER FEED
    // ========================================================
    else {
      postsResult = await db.query(
        `
        SELECT
          p.id,
          p.user_id,
          p.content,
          p.color,
          p.visibility,
          p.created_at,
          p.updated_at,
          u.email,
          u.group_id

        FROM social_posts p

        JOIN my_user u
          ON u.id = p.user_id

        WHERE
          p.visibility = 'loggedin users'

          OR p.user_id = $1

          OR (
            p.visibility = 'group_only'
            AND $2::INTEGER IS NOT NULL
            AND u.group_id = $2::INTEGER
          )

        ORDER BY
          p.created_at DESC,
          p.id DESC

        LIMIT $3
        OFFSET $4
        `,
        [userId, userGroupId, limit, offset],
      );
    }

    // ========================================================
    // POST MEDIA
    // ========================================================

    const mediaResult = await db.query(`
      SELECT
        id,
        post_id,
        file_url,
        file_name,
        mime_type,
        file_size,
        media_text,
         thumbnail_url,
        created_at

      FROM social_post_media

      ORDER BY
        created_at ASC,
        id ASC
    `);

    const mediaByPost = {};

    for (const row of mediaResult.rows) {
      if (!mediaByPost[row.post_id]) {
        mediaByPost[row.post_id] = [];
      }

      mediaByPost[row.post_id].push({
        id: row.id,
        postId: row.post_id,
        fileUrl: row.file_url,
        fileName: row.file_name,
        mimeType: row.mime_type,
        fileSize: row.file_size,
        mediaText: row.media_text,
        thumbnailUrl: row.thumbnail_url || null,
        createdAt: row.created_at,
      });
    }

    // ========================================================
    // COMMENTS
    // ========================================================

    const commentsResult = await db.query(`
      SELECT
        c.id,
        c.post_id,
        c.user_id,
        c.content,
        c.created_at,
        c.updated_at,
        u.email

      FROM social_comments c

      JOIN my_user u
        ON u.id = c.user_id

      ORDER BY
        c.created_at ASC,
        c.id ASC
    `);

    // ========================================================
    // REPLIES
    // ========================================================

    const repliesResult = await db.query(`
      SELECT
        r.id,
        r.comment_id,
        r.parent_reply_id,
        r.user_id,
        r.content,
        r.created_at,
        r.updated_at,
        u.email

      FROM social_replies r

      JOIN my_user u
        ON u.id = r.user_id

      ORDER BY
        r.created_at ASC,
        r.id ASC
    `);

    // ========================================================
    // REACTION COUNTS
    // ========================================================

    const reactionsResult = await db.query(`
      SELECT
        target_type,
        target_id,
        reaction_type,
        COUNT(*)::INTEGER AS count

      FROM social_reactions

      GROUP BY
        target_type,
        target_id,
        reaction_type
    `);

    // ========================================================
    // CURRENT USER REACTIONS
    // ========================================================

    let myReactionsResult = {
      rows: [],
    };

    if (userId) {
      myReactionsResult = await db.query(
        `
        SELECT
          target_type,
          target_id,
          reaction_type

        FROM social_reactions

        WHERE user_id = $1
        `,
        [userId],
      );
    }

    // ========================================================
    // REACTION COUNTS LOOKUP
    // ========================================================

    const reactionCounts = {};

    for (const row of reactionsResult.rows) {
      const key = `${row.target_type}:${row.target_id}`;

      if (!reactionCounts[key]) {
        reactionCounts[key] = {};
      }

      reactionCounts[key][row.reaction_type] = Number(row.count);
    }

    // ========================================================
    // MY REACTIONS LOOKUP
    // ========================================================

    const myReactions = {};

    for (const row of myReactionsResult.rows) {
      const key = `${row.target_type}:${row.target_id}`;

      myReactions[key] = row.reaction_type;
    }

    // ========================================================
    // REACTION HELPER
    // ========================================================

    function getReactions(targetType, targetId) {
      const key = `${targetType}:${targetId}`;

      return {
        like: reactionCounts[key]?.like || 0,
        dislike: reactionCounts[key]?.dislike || 0,
        heart: reactionCounts[key]?.heart || 0,
        horse: reactionCounts[key]?.horse || 0,
        rose: reactionCounts[key]?.rose || 0,
        fly: reactionCounts[key]?.fly || 0,
        call: reactionCounts[key]?.call || 0,
        website: reactionCounts[key]?.website || 0,
        email: reactionCounts[key]?.email || 0,
        smile: reactionCounts[key]?.smile || 0,
        victory: reactionCounts[key]?.victory || 0,
        // NEW
        bell: reactionCounts[key]?.bell || 0,
        trophy: reactionCounts[key]?.trophy || 0,
        myReaction: myReactions[key] || null,
      };
    }

    // ========================================================
    // BUILD REPLIES
    // ========================================================

    const repliesById = {};
    const repliesByComment = {};

    for (const row of repliesResult.rows) {
      repliesById[row.id] = {
        id: row.id,
        commentId: row.comment_id,
        parentReplyId: row.parent_reply_id || null,
        userId: row.user_id,
        email: row.email,
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        reactions: getReactions("reply", row.id),
        replies: [],
      };
    }

    for (const row of repliesResult.rows) {
      const reply = repliesById[row.id];

      if (!row.parent_reply_id) {
        if (!repliesByComment[row.comment_id]) {
          repliesByComment[row.comment_id] = [];
        }

        repliesByComment[row.comment_id].push(reply);
      } else {
        const parentReply = repliesById[row.parent_reply_id];

        if (parentReply) {
          parentReply.replies.push(reply);
        }
      }
    }

    // ========================================================
    // BUILD COMMENTS
    // ========================================================

    const commentsByPost = {};

    for (const row of commentsResult.rows) {
      if (!commentsByPost[row.post_id]) {
        commentsByPost[row.post_id] = [];
      }

      commentsByPost[row.post_id].push({
        id: row.id,
        postId: row.post_id,
        userId: row.user_id,
        email: row.email,
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        reactions: getReactions("comment", row.id),
        replies: repliesByComment[row.id] || [],
      });
    }

    // ========================================================
    // BUILD POSTS
    // ========================================================

    const posts = postsResult.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      email: row.email,
      content: row.content,
      color: row.color,
      visibility: row.visibility,

      media: mediaByPost[row.id] || [],

      createdAt: row.created_at,
      updatedAt: row.updated_at,

      reactions: getReactions("post", row.id),

      comments: commentsByPost[row.id] || [],
    }));

    // ========================================================
    // DEBUG
    // ========================================================

    console.log(
      "SOCIAL POSTS:",
      posts.map((p) => ({
        id: p.id,
        mediaCount: p.media.length,
        media: p.media,
        content: p.content,
      })),
    );

    return res.render("social", {
      posts,

      media: mediaResult.rows,

      currentUserId: userId,
      currentUserEmail: userEmail,

      isAdmin,

      isEmailsAdmin: emailsAdmin,

      defaultDate: getToday(),

      page,
      totalPosts,
      totalPages,
    });
  } catch (err) {
    console.error("========================================");
    console.error("LOAD SOCIAL FEED ERROR");
    console.error("message:", err.message);
    console.error("code:", err.code);
    console.error("detail:", err.detail);
    console.error("stack:", err.stack);
    console.error("========================================");

    return res.status(500).send(`Unable to load social feed: ${err.message}`);
  }
});

//
// socialFileUpload handle upload and pasted from multer
app.post(
  "/social/post/create",
  ensureAuthenticated,
  socialFileUpload.array("files", 10),

  async (req, res) => {
    const client = await db.connect();

    try {
      // ======================================================
      // CURRENT USER
      // ======================================================

      const userId = req.user?.id;
      const userEmail = req.user?.email || null;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "Please log in.",
        });
      }

      const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const normalizedUserEmail = String(userEmail || "")
        .trim()
        .toLowerCase();

      const isAdmin =
        !!normalizedUserEmail && adminEmails.includes(normalizedUserEmail);

      const userIsEmailsAdmin = isEmailsAdmin(userEmail);

      const content = String(req.body.content || "").trim();

      const files = req.files || [];

      const videoFiles = files.filter((file) =>
        ["video/mp4", "video/webm"].includes(file.mimetype),
      );

      if (videoFiles.length > 1) {
        return res.status(400).json({
          success: false,
          error: "You can upload only 1 video per post.",
        });
      }

      if (content.length > 5000) {
        return res.status(400).json({
          success: false,
          error: "Post is too long. Maximum 5000 characters.",
        });
      }

      // ======================================================
      // NO CONTENT + NO FILES
      // ======================================================

      if (!content && files.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Post cannot be empty.",
        });
      }

      // ======================================================
      // MEDIA TEXT
      // ======================================================

      let mediaTexts = req.body.media_text || [];

      if (!Array.isArray(mediaTexts)) {
        mediaTexts = [mediaTexts];
      }

      // ======================================================
      // VISIBILITY
      // ======================================================

      const requestedVisibility = String(
        req.body.visibility || "loggedin users",
      ).trim();

      let visibility = "loggedin users";

      if (requestedVisibility === "admin_only") {
        if (isAdmin || userIsEmailsAdmin) {
          visibility = "admin_only";
        }
      } else if (requestedVisibility === "group_only") {
        visibility = "group_only";
      } else if (requestedVisibility === "loggedin users") {
        visibility = "loggedin users";
      }

      // ======================================================
      // RANDOM COLOR
      // ======================================================

      const color = colors[Math.floor(Math.random() * colors.length)];

      const uploadDir = "/uploads/social";
      const thumbnailDir = "/uploads/social/thumbnails";

      await fs.promises.mkdir(uploadDir, {
        recursive: true,
      });

      await fs.promises.mkdir(thumbnailDir, {
        recursive: true,
      });

      await client.query("BEGIN");

      // ======================================================
      // CREATE POST
      // ======================================================

      const postResult = await client.query(
        `
        INSERT INTO social_posts
        (
          user_id,
          content,
          color,
          visibility
        )
        VALUES
        ($1, $2, $3, $4)
        RETURNING id
        `,
        [userId, content, color, visibility],
      );

      const postId = postResult.rows[0].id;

      console.log("NEW POST ID:", postId);

      const specialAdminEmails = (process.env.SPECIAL_ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      if (specialAdminEmails.length > 0) {
        const specialAdminsResult = await client.query(
          `
          SELECT id
          FROM my_user
          WHERE LOWER(email) = ANY($1::TEXT[])
          `,
          [specialAdminEmails],
        );

        for (const specialAdmin of specialAdminsResult.rows) {
          await client.query(
            `
            INSERT INTO social_notifications
            (
              recipient_user_id,
              actor_user_id,
              notification_type,
              post_id,
              message
            )
            VALUES
            (
              $1,
              $2,
              'new_post',
              $3,
              $4
            )
            `,
            [specialAdmin.id, userId, postId, "A new social post was created."],
          );
        }
      }

      // ======================================================
      // SAVE MEDIA
      // ======================================================

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        console.log("SAVING FILE:", {
          filename: file.filename,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path,
        });

        // ====================================================
        // FILE URL
        // ====================================================

        const fileUrl = `/uploads/social/${file.filename}`;

        // ====================================================
        // MEDIA TEXT
        // ====================================================

        const mediaText =
          typeof mediaTexts[i] === "string"
            ? mediaTexts[i].trim().slice(0, 5000)
            : "";

        // ====================================================
        // VIDEO THUMBNAIL
        // ====================================================

        let thumbnailUrl = null;

        if (file.mimetype === "video/mp4" || file.mimetype === "video/webm") {
          const thumbnailFilename = `${file.filename}.jpg`;

          try {
            await new Promise((resolve, reject) => {
              ffmpeg(file.path)
                .screenshots({
                  timestamps: ["10%"],
                  filename: thumbnailFilename,
                  folder: thumbnailDir,
                  size: "640x?",
                })
                .on("end", resolve)
                .on("error", reject);
            });

            thumbnailUrl = `/uploads/social/thumbnails/${thumbnailFilename}`;

            console.log("VIDEO THUMBNAIL CREATED:", thumbnailUrl);
          } catch (err) {
            console.error("Thumbnail generation failed:", err.message);

            thumbnailUrl = null;
          }
        }

        // ====================================================
        // INSERT MEDIA
        // ====================================================

        await client.query(
          `
          INSERT INTO social_post_media
          (
            post_id,
            file_url,
            file_name,
            mime_type,
            file_size,
            media_text,
            thumbnail_url
          )
          VALUES
          ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            postId,
            fileUrl,
            file.originalname,
            file.mimetype,
            file.size,
            mediaText,
            thumbnailUrl,
          ],
        );

        console.log("MEDIA SAVED:", {
          postId,
          fileUrl,
          thumbnailUrl,
          mimeType: file.mimetype,
        });
      }

      await client.query("COMMIT");

      const postUrl = `/social/post?postId=${encodeURIComponent(
        String(postId),
      )}`;

      return res.status(200).json({
        success: true,
        postId: String(postId),
        url: postUrl,
      });
    } catch (err) {
      // ======================================================
      // ROLLBACK
      // ======================================================

      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
      }

      // ======================================================
      // ERROR
      // ======================================================

      console.error("========================================");
      console.error("CREATE POST ERROR");
      console.error("message:", err.message);
      console.error("code:", err.code);
      console.error("detail:", err.detail);
      console.error("constraint:", err.constraint);
      console.error("stack:", err.stack);
      console.error("========================================");

      return res.status(500).json({
        success: false,
        error: err.message || "Unable to create social post.",
      });
    } finally {
      client.release();
    }
  },
);

//
//
app.get("/notification", ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email || null;

    if (!userId) {
      return res.status(401).send("Please log in.");
    }

    // ========================================================
    // SPECIAL ADMIN EMAIL CHECK
    // ========================================================

    const specialAdminEmails = (process.env.SPECIAL_ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    const normalizedUserEmail = String(userEmail || "")
      .trim()
      .toLowerCase();

    const isSpecialAdmin =
      !!normalizedUserEmail && specialAdminEmails.includes(normalizedUserEmail);

    if (!isSpecialAdmin) {
      return res.status(403).send("Access denied.");
    }

    // ========================================================
    // LOAD NOTIFICATIONS
    // ========================================================

    const notificationsResult = await db.query(
      `
      SELECT
        n.id,
        n.recipient_user_id,
        n.actor_user_id,
        n.notification_type,
        n.post_id,
        n.message,
        n.is_read,
        n.created_at,

        u.email AS actor_email

      FROM social_notifications n

      LEFT JOIN my_user u
        ON u.id = n.actor_user_id

      WHERE
        n.recipient_user_id = $1
        AND n.is_read = FALSE

      ORDER BY
        n.created_at DESC,
        n.id DESC
      `,
      [userId],
    );

    // ========================================================
    // RENDER
    // ========================================================

    return res.render("notification", {
      notifications: notificationsResult.rows,

      currentUserId: userId,
      currentUserEmail: userEmail,
      defaultDate: getToday(),
    });
  } catch (err) {
    console.error("========================================");
    console.error("LOAD SOCIAL NOTIFICATIONS ERROR");
    console.error("message:", err.message);
    console.error("code:", err.code);
    console.error("detail:", err.detail);
    console.error("stack:", err.stack);
    console.error("========================================");

    return res.status(500).send("Unable to load notifications.");
  }
});
// remove notification
app.get(
  "/notification/:notificationId",
  ensureAuthenticated,
  async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).send("Please log in.");
      }

      const notificationId = parseInt(req.params.notificationId, 10);

      if (!Number.isInteger(notificationId)) {
        return res.status(400).send("Invalid notification.");
      }

      // ======================================================
      // MARK THIS NOTIFICATION AS READ
      //
      // IMPORTANT:
      // Only the recipient can mark their notification read.
      // ======================================================

      const result = await db.query(
        `
        UPDATE social_notifications
        SET is_read = TRUE
        WHERE id = $1
          AND recipient_user_id = $2
        RETURNING post_id
        `,
        [notificationId, userId],
      );

      if (!result.rowCount) {
        return res.status(404).send("Notification not found.");
      }

      const postId = result.rows[0].post_id;

      if (!postId) {
        return res.status(404).send("Post not found.");
      }

      // ======================================================
      // GO DIRECTLY TO THE POST
      // ======================================================

      return res.redirect(
        `/social/post?postId=${encodeURIComponent(String(postId))}`,
      );
    } catch (err) {
      console.error("========================================");
      console.error("NOTIFICATION CLICK ERROR");
      console.error("message:", err.message);
      console.error("code:", err.code);
      console.error("detail:", err.detail);
      console.error("stack:", err.stack);
      console.error("========================================");

      return res.status(500).send("Unable to open notification.");
    }
  },
);

//
// ============================================================
// EDIT POST
// ============================================================

app.post("/social/post/edit", ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;

    const postId = req.body.id;

    const content = (req.body.content || "").trim();

    if (!userId) {
      return res.status(401).send("Please log in.");
    }

    if (!postId) {
      return res.status(400).send("Post ID is required.");
    }

    if (!content) {
      return res.redirect("/social/post");
    }

    if (content.length > 5000) {
      return res.status(400).send("Post is too long.");
    }

    const result = await db.query(
      `
      UPDATE social_posts
      SET
        content = $1,
        updated_at = NOW()
      WHERE id = $2
        AND user_id = $3
      RETURNING id
      `,
      [content, postId, userId],
    );

    if (!result.rowCount) {
      return res.status(403).send("You cannot edit this post.");
    }

    //res.redirect("/social/post");
    res.redirect(`/social/post?postId=${postId}`);
  } catch (err) {
    console.error("Edit post error:", err);

    res.status(500).send("Unable to edit post.");
  }
});

// ============================================================
// DELETE POST
// ============================================================

// ============================================================
// DELETE POST
// Owner OR Admin can delete
// ============================================================

app.post("/social/post/delete", ensureAuthenticated, async (req, res) => {
  const client = await db.connect();

  try {
    const userId = req.user?.id || null;
    const userEmail = req.user?.email || null;

    const postId = req.body.id;

    // ========================================================
    // ADMIN CHECK
    // ========================================================

    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    const isAdmin =
      !!userEmail && adminEmails.includes(userEmail.toLowerCase());

    if (!userId) {
      client.release();

      return res.status(401).send("Please log in.");
    }

    if (!postId) {
      client.release();

      return res.status(400).send("Post ID is required.");
    }

    await client.query("BEGIN");

    // ========================================================
    // VERIFY PERMISSION
    //
    // Owner can delete own post.
    // Admin can delete ANY post.
    // ========================================================

    const postResult = await client.query(
      `
      SELECT id
      FROM social_posts
      WHERE id = $1
        AND (
          user_id = $2
          OR $3 = true
        )
      FOR UPDATE
      `,
      [postId, userId, isAdmin],
    );

    if (!postResult.rowCount) {
      await client.query("ROLLBACK");
      client.release();

      return res.status(403).send("You cannot delete this post.");
    }

    // ========================================================
    // DELETE REPLY REACTIONS
    // ========================================================

    await client.query(
      `
      DELETE FROM social_reactions
      WHERE target_type = 'reply'
        AND target_id IN (
          SELECT r.id
          FROM social_replies r
          JOIN social_comments c
            ON c.id = r.comment_id
          WHERE c.post_id = $1
        )
      `,
      [postId],
    );

    // ========================================================
    // DELETE COMMENT REACTIONS
    // ========================================================

    await client.query(
      `
      DELETE FROM social_reactions
      WHERE target_type = 'comment'
        AND target_id IN (
          SELECT id
          FROM social_comments
          WHERE post_id = $1
        )
      `,
      [postId],
    );

    // ========================================================
    // DELETE POST REACTIONS
    // ========================================================

    await client.query(
      `
      DELETE FROM social_reactions
      WHERE target_type = 'post'
        AND target_id = $1
      `,
      [postId],
    );

    // ========================================================
    // DELETE REPLIES
    // ========================================================

    await client.query(
      `
      DELETE FROM social_replies
      WHERE comment_id IN (
        SELECT id
        FROM social_comments
        WHERE post_id = $1
      )
      `,
      [postId],
    );

    // ========================================================
    // DELETE COMMENTS
    // ========================================================

    await client.query(
      `
      DELETE FROM social_comments
      WHERE post_id = $1
      `,
      [postId],
    );

    // ========================================================
    // DELETE POST
    //
    // Owner OR admin.
    // ========================================================

    await client.query(
      `
      DELETE FROM social_posts
      WHERE id = $1
        AND (
          user_id = $2
          OR $3 = true
        )
      `,
      [postId, userId, isAdmin],
    );

    // ========================================================
    // COMMIT
    // ========================================================

    await client.query("COMMIT");

    client.release();

    res.redirect("/social/post");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Rollback error:", rollbackErr);
    }

    client.release();

    console.error("Delete post error:", err);

    res.status(500).send("Unable to delete post.");
  }
});

app.post("/social/post/comment", ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;

    const postId = req.body.postId;

    const content = (req.body.comment || "").trim();

    if (!userId) {
      return res.status(401).send("Please log in.");
    }

    if (!postId) {
      return res.status(400).send("Post ID is required.");
    }

    if (!content) {
      return res.redirect("/social/post");
    }

    if (content.length > 2000) {
      return res.status(400).send("Comment is too long.");
    }

    // Verify post exists

    const postResult = await db.query(
      `
      SELECT id
      FROM social_posts
      WHERE id = $1
      `,
      [postId],
    );

    if (!postResult.rowCount) {
      return res.status(404).send("Post not found.");
    }

    await db.query(
      `
      INSERT INTO social_comments
        (
          post_id,
          user_id,
          content
        )
      VALUES
        ($1, $2, $3)
      `,
      [postId, userId, content],
    );

    //res.redirect("/social/post");
    res.redirect(`/social/post?postId=${postId}`);
  } catch (err) {
    console.error("Comment error:", err);

    res.status(500).send("Unable to add comment.");
  }
});

app.post("/social/comment/edit", ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    const commentId = req.body.id;
    const content = (req.body.content || "").trim();

    if (!userId) {
      return res.status(401).send("Please log in.");
    }

    const parsedCommentId = Number(commentId);

    if (!Number.isInteger(parsedCommentId) || parsedCommentId <= 0) {
      return res.status(400).send("Invalid comment ID.");
    }

    if (!content) {
      return res.status(400).send("Comment cannot be empty.");
    }

    if (content.length > 2000) {
      return res.status(400).send("Comment is too long.");
    }

    const commentResult = await db.query(
      `
      SELECT
        id,
        post_id,
        user_id
      FROM social_comments
      WHERE id = $1
      `,
      [parsedCommentId],
    );

    if (!commentResult.rowCount) {
      return res.status(404).send("Comment not found.");
    }

    const comment = commentResult.rows[0];

    if (String(comment.user_id) !== String(userId)) {
      return res.status(403).send("You cannot edit this comment.");
    }

    const postId = Number(comment.post_id);

    console.log("COMMENT POST ID:", postId);

    if (!Number.isInteger(postId) || postId <= 0) {
      console.error("BAD COMMENT POST ID:", comment.post_id);

      return res.status(500).send("Invalid post ID.");
    }

    const updateResult = await db.query(
      `
      UPDATE social_comments
      SET
        content = $1,
        updated_at = NOW()
      WHERE
        id = $2
        AND user_id = $3
      RETURNING
        id,
        post_id
      `,
      [content, parsedCommentId, userId],
    );

    console.log("COMMENT UPDATED:", updateResult.rows);

    if (!updateResult.rowCount) {
      return res.status(403).send("You cannot edit this comment.");
    }

    console.log("REDIRECT:", `/social/post?postId=${postId}`);

    return res.redirect(`/social/post?postId=${encodeURIComponent(postId)}`);
  } catch (err) {
    console.error("SOCIAL COMMENT EDIT ERROR:", err);

    return res.status(500).send("Unable to edit comment.");
  }
});

app.post("/social/comment/delete", ensureAuthenticated, async (req, res) => {
  const client = await db.connect();

  try {
    const userId = req.user?.id;
    const commentId = req.body.id;

    if (!userId) {
      client.release();
      return res.status(401).send("Please log in.");
    }

    if (!commentId) {
      client.release();
      return res.status(400).send("Comment ID is required.");
    }

    await client.query("BEGIN");

    const commentResult = await client.query(
      `
      SELECT
        id,
        post_id
      FROM social_comments
      WHERE id = $1
        AND user_id = $2
      FOR UPDATE
      `,
      [commentId, userId],
    );

    if (!commentResult.rowCount) {
      await client.query("ROLLBACK");
      client.release();

      return res.status(403).send("You cannot delete this comment.");
    }

    const postId = commentResult.rows[0].post_id;

    await client.query(
      `
      DELETE FROM social_reactions
      WHERE target_type = 'reply'
        AND target_id IN (
          SELECT id
          FROM social_replies
          WHERE comment_id = $1
        )
      `,
      [commentId],
    );

    await client.query(
      `
      DELETE FROM social_reactions
      WHERE target_type = 'comment'
        AND target_id = $1
      `,
      [commentId],
    );

    await client.query(
      `
      DELETE FROM social_replies
      WHERE comment_id = $1
      `,
      [commentId],
    );

    await client.query(
      `
      DELETE FROM social_comments
      WHERE id = $1
        AND user_id = $2
      `,
      [commentId, userId],
    );

    await client.query("COMMIT");

    client.release();

    res.redirect(`/social/post?postId=${postId}`);
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Comment delete rollback error:", rollbackErr);
    }

    client.release();

    console.error("Delete comment error:", err);

    res.status(500).send("Unable to delete comment.");
  }
});

app.post("/social/comment/reply", ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;

    const commentId = req.body?.commentId;

    const parentReplyId = req.body?.parentReplyId || null;

    const content = String(req.body?.reply || "").trim();

    if (!userId) {
      return res.status(401).send("Please log in.");
    }

    if (!content) {
      console.error("REPLY REJECTED: empty content");
      return res.status(400).send("Reply cannot be empty.");
    }

    if (content.length > 2000) {
      return res.status(400).send("Reply is too long.");
    }

    // ======================================================
    // REPLY TO ANOTHER REPLY
    // ======================================================

    if (parentReplyId) {
      const parentReplyResult = await db.query(
        `
        SELECT
          r.id,
          r.comment_id,
          r.parent_reply_id,
          c.post_id
        FROM social_replies r
        JOIN social_comments c
          ON c.id = r.comment_id
        WHERE r.id = $1
        `,
        [parentReplyId],
      );

      if (!parentReplyResult.rowCount) {
        return res.status(404).send("Parent reply not found.");
      }

      const parentReply = parentReplyResult.rows[0];

      if (commentId && String(commentId) !== String(parentReply.comment_id)) {
        return res.status(400).send("Reply does not belong to this comment.");
      }

      if (parentReply.parent_reply_id) {
        return res
          .status(400)
          .send("Replies can only be added one level deep.");
      }

      const insertResult = await db.query(
        `
        INSERT INTO social_replies
        (
          comment_id,
          parent_reply_id,
          user_id,
          content
        )
        VALUES
        ($1, $2, $3, $4)
        RETURNING id
        `,
        [parentReply.comment_id, parentReply.id, userId, content],
      );

      console.log("REPLY CREATED:", insertResult.rows[0]);

      return res.redirect(`/social/post?postId=${parentReply.post_id}`);
    }

    // ======================================================
    // REPLY DIRECTLY TO COMMENT
    // ======================================================

    if (!commentId) {
      return res.status(400).send("Comment ID is required.");
    }

    const commentResult = await db.query(
      `
      SELECT
        id,
        post_id
      FROM social_comments
      WHERE id = $1
      `,
      [commentId],
    );

    if (!commentResult.rowCount) {
      return res.status(404).send("Comment not found.");
    }

    const insertResult = await db.query(
      `
      INSERT INTO social_replies
      (
        comment_id,
        parent_reply_id,
        user_id,
        content
      )
      VALUES
      ($1, NULL, $2, $3)
      RETURNING id
      `,
      [commentId, userId, content],
    );

    console.log("REPLY CREATED:", insertResult.rows[0]);

    return res.redirect(`/social/post?postId=${commentResult.rows[0].post_id}`);
  } catch (err) {
    return res.status(500).send("Unable to add reply.");
  }
});
//
app.post("/social/reply/edit", ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    const replyId = req.body.id;
    const content = (req.body.content || "").trim();

    if (!userId) {
      return res.status(401).send("Please log in.");
    }

    const parsedReplyId = Number(replyId);

    if (!Number.isInteger(parsedReplyId) || parsedReplyId <= 0) {
      return res.status(400).send("Invalid reply ID.");
    }

    if (!content) {
      return res.status(400).send("Reply cannot be empty.");
    }

    if (content.length > 2000) {
      return res.status(400).send("Reply is too long.");
    }

    const result = await db.query(
      `
      UPDATE social_replies AS r
      SET
        content = $1,
        updated_at = NOW()
      FROM social_comments AS c
      WHERE
        r.id = $2
        AND r.user_id = $3
        AND c.id = r.comment_id
      RETURNING
        r.id,
        r.comment_id,
        c.post_id
      `,
      [content, parsedReplyId, userId],
    );

    if (!result.rowCount) {
      return res.status(403).send("You cannot edit this reply.");
    }

    const postId = Number(result.rows[0].post_id);

    if (!Number.isInteger(postId) || postId <= 0) {
      console.error(
        "Invalid post ID returned from reply edit:",
        result.rows[0],
      );

      return res.status(500).send("Invalid post ID.");
    }

    return res.redirect(`/social/post?postId=${encodeURIComponent(postId)}`);
  } catch (err) {
    console.error("Edit reply error:", err);

    return res.status(500).send("Unable to edit reply.");
  }
});

app.post("/social/reply/delete", ensureAuthenticated, async (req, res) => {
  const client = await db.connect();

  try {
    const userId = req.user?.id;

    const replyId = req.body.id;

    if (!userId) {
      client.release();

      return res.status(401).send("Please log in.");
    }

    if (!replyId) {
      client.release();

      return res.status(400).send("Reply ID is required.");
    }

    await client.query("BEGIN");

    const replyResult = await client.query(
      `
      SELECT
        r.id,
        r.parent_reply_id,
        c.post_id
      FROM social_replies r
      JOIN social_comments c
        ON c.id = r.comment_id
      WHERE r.id = $1
        AND r.user_id = $2
      FOR UPDATE
      `,
      [replyId, userId],
    );

    if (!replyResult.rowCount) {
      await client.query("ROLLBACK");

      client.release();

      return res.status(403).send("You cannot delete this reply.");
    }

    const reply = replyResult.rows[0];

    if (!reply.parent_reply_id) {
      await client.query(
        `
        DELETE FROM social_reactions
        WHERE target_type = 'reply'
          AND target_id IN (
            SELECT id
            FROM social_replies
            WHERE parent_reply_id = $1
          )
        `,
        [replyId],
      );
    }

    await client.query(
      `
      DELETE FROM social_reactions
      WHERE target_type = 'reply'
        AND target_id = $1
      `,
      [replyId],
    );

    await client.query(
      `
      DELETE FROM social_replies
      WHERE id = $1
        AND user_id = $2
      `,
      [replyId, userId],
    );

    await client.query("COMMIT");

    client.release();

    res.redirect(`/social/post?postId=${reply.post_id}`);
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Reply delete rollback error:", rollbackErr);
    }

    client.release();

    console.error("Delete reply error:", err);

    res.status(500).send("Unable to delete reply.");
  }
});
//
app.post("/social/reaction", ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;

    const targetType = req.body.targetType;

    const targetId = req.body.targetId;

    const reactionType = req.body.reactionType;

    if (!userId) {
      return res.status(401).send("Please log in.");
    }

    if (!ALLOWED_TARGETS.includes(targetType)) {
      return res.status(400).send("Invalid target.");
    }

    if (!ALLOWED_REACTIONS.includes(reactionType)) {
      return res.status(400).send("Invalid reaction.");
    }

    if (!targetId) {
      return res.status(400).send("Target ID is required.");
    }

    let targetResult;

    if (targetType === "post") {
      targetResult = await db.query(
        `
        SELECT
          id,
          id AS post_id
        FROM social_posts
        WHERE id = $1
        `,
        [targetId],
      );
    }

    if (targetType === "comment") {
      targetResult = await db.query(
        `
        SELECT
          c.id,
          c.post_id
        FROM social_comments c
        WHERE c.id = $1
        `,
        [targetId],
      );
    }

    if (targetType === "reply") {
      targetResult = await db.query(
        `
        SELECT
          r.id,
          c.post_id
        FROM social_replies r
        JOIN social_comments c
          ON c.id = r.comment_id
        WHERE r.id = $1
        `,
        [targetId],
      );
    }

    if (!targetResult?.rowCount) {
      return res.status(404).send("Target not found.");
    }

    const postId = targetResult.rows[0].post_id;

    const existing = await db.query(
      `
      SELECT
        id,
        reaction_type
      FROM social_reactions
      WHERE user_id = $1
        AND target_type = $2
        AND target_id = $3
      `,
      [userId, targetType, targetId],
    );

    if (
      existing.rows.length &&
      existing.rows[0].reaction_type === reactionType
    ) {
      await db.query(
        `
        DELETE FROM social_reactions
        WHERE id = $1
        `,
        [existing.rows[0].id],
      );
    } else if (existing.rows.length) {
      await db.query(
        `
        UPDATE social_reactions
        SET
          reaction_type = $1
        WHERE id = $2
        `,
        [reactionType, existing.rows[0].id],
      );
    } else {
      await db.query(
        `
        INSERT INTO social_reactions
          (
            user_id,
            target_type,
            target_id,
            reaction_type
          )
        VALUES
          ($1, $2, $3, $4)
        ON CONFLICT
          (
            user_id,
            target_type,
            target_id
          )
        DO UPDATE SET
          reaction_type = EXCLUDED.reaction_type
        `,
        [userId, targetType, targetId, reactionType],
      );
    }

    res.redirect(`/social/post?postId=${postId}`);
  } catch (err) {
    console.error("Reaction error:", err);

    res.status(500).send("Unable to process reaction.");
  }
});
//
function isEmailsAdmin(userEmail) {
  const emailsAdmin = (process.env.EMAILS_ADMIN || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return emailsAdmin.includes(
    String(userEmail || "")
      .trim()
      .toLowerCase(),
  );
}
//
app.get("/social/search", ensureAuthenticated, async (req, res) => {
  try {
    // ========================================================
    // CURRENT USER
    // ========================================================

    const userId = req.user?.id || null;
    const userEmail = req.user?.email || null;

    console.log("SOCIAL SEARCH req.user =", req.user);

    let userGroupId = null;

    if (userId) {
      const groupResult = await db.query(
        `
        SELECT group_id
        FROM my_user
        WHERE id = $1
        `,
        [userId],
      );

      userGroupId = groupResult.rows[0]?.group_id ?? null;
    }

    console.log("SOCIAL SEARCH userGroupId =", userGroupId);

    // ========================================================
    // FULL ADMIN CHECK
    // ADMIN_EMAILS
    //
    // Sees EVERYTHING
    // ========================================================

    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    const normalizedUserEmail = String(userEmail || "")
      .trim()
      .toLowerCase();

    const isAdmin =
      !!normalizedUserEmail && adminEmails.includes(normalizedUserEmail);

    const userIsEmailsAdmin = isEmailsAdmin(userEmail);

    // ========================================================
    // SEARCH INPUT
    // ========================================================

    const q = (req.query.q || "").trim();
    const user = (req.query.user || "").trim();

    // ========================================================
    // FILTER INPUT
    // ========================================================

    let visibility = "";

    let dateFrom = (req.query.dateFrom || "").trim();
    let dateTo = (req.query.dateTo || "").trim();

    // ========================================================
    // VISIBILITY FILTER
    //
    // FULL ADMIN:
    //   can filter all visibility types
    //
    // EMAILS ADMIN:
    //   can filter:
    //      loggedin users
    //      group_only
    //
    //   cannot filter admin_only
    //
    // NORMAL USER:
    //   no admin visibility filter
    // ========================================================

    if (isAdmin) {
      visibility = (req.query.visibility || "").trim();

      const allowedVisibility = ["loggedin users", "admin_only", "group_only"];

      if (!allowedVisibility.includes(visibility)) {
        visibility = "";
      }
    } else if (userIsEmailsAdmin) {
      visibility = (req.query.visibility || "").trim();

      const allowedEmailsAdminVisibility = ["loggedin users", "group_only"];

      if (!allowedEmailsAdminVisibility.includes(visibility)) {
        visibility = "";
      }
    }

    // ========================================================
    // DATE VALIDATION
    // ========================================================

    const validDate = (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
      }

      const [year, month, day] = value.split("-").map(Number);

      const date = new Date(Date.UTC(year, month - 1, day));

      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    };

    // ========================================================
    // VALIDATE DATE FROM
    // ========================================================

    if (dateFrom && !validDate(dateFrom)) {
      dateFrom = "";
    }

    // ========================================================
    // VALIDATE DATE TO
    // ========================================================

    if (dateTo && !validDate(dateTo)) {
      dateTo = "";
    }

    // ========================================================
    // INVALID DATE RANGE
    // ========================================================

    if (dateFrom && dateTo && dateFrom > dateTo) {
      dateFrom = "";
      dateTo = "";
    }

    console.log("SOCIAL SEARCH filters =", {
      visibility,
      dateFrom,
      dateTo,
    });

    // ========================================================
    // PAGINATION
    // ========================================================

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const limit = 6;
    const offset = (page - 1) * limit;

    // ========================================================
    // BUILD WHERE CONDITIONS
    // ========================================================

    const conditions = [];
    const values = [];

    // ========================================================
    // VISIBILITY SECURITY
    //
    // FULL ADMIN:
    //   sees everything
    //
    // EMAILS ADMIN:
    //   loggedin users
    //   group_only
    //   own posts
    //   NOT admin_only
    //
    // NORMAL USER:
    //   loggedin users
    //   own posts
    //   group_only from own group
    // ========================================================

    if (isAdmin) {
      // FULL ADMIN sees everything.
      // No security condition needed.
    } else if (userIsEmailsAdmin) {
      const userIdParam = values.length + 1;

      values.push(userId);

      conditions.push(`
        (
          p.visibility = 'loggedin users'

          OR p.visibility = 'group_only'

          OR p.user_id = $${userIdParam}
        )
      `);
    } else {
      // ------------------------------------------------------
      // NORMAL USER
      // ------------------------------------------------------

      const userIdParam = values.length + 1;

      values.push(userId);

      const groupIdParam = values.length + 1;

      values.push(userGroupId);

      conditions.push(`
        (
          p.visibility = 'loggedin users'

          OR p.user_id = $${userIdParam}

          OR (
            p.visibility = 'group_only'
            AND $${groupIdParam}::INTEGER IS NOT NULL
            AND u.group_id = $${groupIdParam}::INTEGER
          )
        )
      `);
    }

    // ========================================================
    // VISIBILITY FILTER
    // ========================================================

    if ((isAdmin || userIsEmailsAdmin) && visibility) {
      values.push(visibility);

      conditions.push(`p.visibility = $${values.length}`);
    }

    // ========================================================
    // DATE FROM
    // ========================================================

    if (dateFrom) {
      values.push(dateFrom);

      conditions.push(`p.created_at >= $${values.length}::DATE`);
    }

    // ========================================================
    // DATE TO
    // ========================================================

    if (dateTo) {
      values.push(dateTo);

      conditions.push(
        `p.created_at < ($${values.length}::DATE + INTERVAL '1 day')`,
      );
    }

    // ========================================================
    // CONTENT SEARCH
    // ========================================================

    if (q) {
      values.push(`%${q}%`);

      conditions.push(`p.content ILIKE $${values.length}`);
    }

    // ========================================================
    // USER / EMAIL SEARCH
    // ========================================================

    if (user) {
      values.push(`%${user}%`);

      conditions.push(`u.email ILIKE $${values.length}`);
    }

    // ========================================================
    // WHERE CLAUSE
    // ========================================================

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    console.log("SOCIAL SEARCH whereClause =", whereClause);
    console.log("SOCIAL SEARCH values =", values);

    // ========================================================
    // TOTAL SEARCH RESULTS
    // ========================================================

    const totalResult = await db.query(
      `
      SELECT
        COUNT(*)::INTEGER AS total

      FROM social_posts p

      JOIN my_user u
        ON u.id = p.user_id

      ${whereClause}
      `,
      values,
    );

    const totalPosts = Number(totalResult.rows[0]?.total) || 0;

    // ========================================================
    // VISIBILITY BREAKDOWN
    //
    // FULL ADMIN:
    //   all three types
    //
    // EMAILS ADMIN:
    //   loggedin users + group_only
    //   admin_only remains 0 / hidden
    // ========================================================

    let everyonePosts = 0;
    let userAdminPosts = 0;
    let groupPosts = 0;

    if (isAdmin || userIsEmailsAdmin) {
      const breakdownResult = await db.query(
        `
        SELECT

          COUNT(*) FILTER (
            WHERE p.visibility = 'loggedin users'
          )::INTEGER AS everyone_posts,

          COUNT(*) FILTER (
            WHERE p.visibility = 'admin_only'
          )::INTEGER AS user_admin_posts,

          COUNT(*) FILTER (
            WHERE p.visibility = 'group_only'
          )::INTEGER AS group_posts

        FROM social_posts p

        JOIN my_user u
          ON u.id = p.user_id

        ${whereClause}
        `,
        values,
      );

      everyonePosts = Number(breakdownResult.rows[0]?.everyone_posts) || 0;

      groupPosts = Number(breakdownResult.rows[0]?.group_posts) || 0;

      // ------------------------------------------------------
      // EMAILS_ADMIN must NEVER expose admin_only count.
      // ------------------------------------------------------

      if (isAdmin) {
        userAdminPosts = Number(breakdownResult.rows[0]?.user_admin_posts) || 0;
      } else {
        userAdminPosts = 0;
      }
    }

    // ========================================================
    // TOTAL PAGES
    // ========================================================

    const totalPages = Math.max(Math.ceil(totalPosts / limit), 1);

    // ========================================================
    // INVALID PAGE
    // ========================================================

    if (page > totalPages && totalPosts > 0) {
      const params = new URLSearchParams();

      if (q) {
        params.set("q", q);
      }

      if (user) {
        params.set("user", user);
      }

      if (dateFrom) {
        params.set("dateFrom", dateFrom);
      }

      if (dateTo) {
        params.set("dateTo", dateTo);
      }

      if ((isAdmin || userIsEmailsAdmin) && visibility) {
        params.set("visibility", visibility);
      }

      params.set("page", totalPages);

      return res.redirect(`/social/search?${params.toString()}`);
    }

    // ========================================================
    // SEARCH RESULTS
    // ========================================================

    const limitParam = values.length + 1;
    const offsetParam = values.length + 2;

    const searchResult = await db.query(
      `
      SELECT
        p.id,
        p.user_id,
        p.content,
        p.color,
        p.visibility,
        p.public_enabled,
        p.public_reactions_enabled,
        p.created_at,
        p.updated_at,
        u.email

      FROM social_posts p

      JOIN my_user u
        ON u.id = p.user_id

      ${whereClause}

      ORDER BY
        p.created_at DESC,
        p.id DESC

      LIMIT $${limitParam}
      OFFSET $${offsetParam}
      `,
      [...values, limit, offset],
    );

    // ========================================================
    // BUILD POSTS
    // ========================================================

    const posts = searchResult.rows.map((row) => ({
      id: row.id,

      userId: row.user_id,

      email: row.email,

      content: row.content,

      color: row.color,

      visibility: row.visibility,

      publicEnabled: row.public_enabled,

      publicReactionsEnabled: row.public_reactions_enabled,

      createdAt: row.created_at,

      updatedAt: row.updated_at,
    }));

    // ========================================================
    // RENDER
    // ========================================================

    return res.render("social-search", {
      defaultDate: getToday(),

      posts,

      currentUserId: userId,

      currentUserEmail: userEmail,

      isAdmin,

      isEmailsAdmin: userIsEmailsAdmin,

      // Search
      q,
      user,

      // Filters
      visibility,
      dateFrom,
      dateTo,

      // Pagination
      page,

      totalPosts,

      everyonePosts,

      userAdminPosts,

      groupPosts,

      totalPages,
    });
  } catch (err) {
    console.error("Social search error:", err);

    return res.status(500).send("Unable to search social posts.");
  }
});

// ============================================================
// SOCIAL SEARCH
//
// publish a few specific post ids
app.post(
  "/social/post/make-public/:postId",
  ensureAuthenticated,
  async (req, res) => {
    try {
      const userEmail = req.user?.email || null;

      // =========================================
      // ADMIN CHECK
      // =========================================

      const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const isAdmin =
        !!userEmail && adminEmails.includes(userEmail.toLowerCase());

      if (!isAdmin) {
        return res.status(403).send("Admin access required.");
      }

      // =========================================
      // VALIDATE POST ID
      // =========================================

      const postId = parseInt(req.params.postId, 10);

      if (!Number.isInteger(postId)) {
        return res.status(400).send("Invalid post ID.");
      }

      // =========================================
      // PUBLISH POST
      // =========================================

      const result = await db.query(
        `
        UPDATE social_posts
        SET public_enabled = TRUE
        WHERE id = $1
        RETURNING id, public_enabled
        `,
        [postId],
      );

      if (!result.rowCount) {
        return res.status(404).send("Post not found.");
      }

      console.log("POST MADE PUBLIC:", postId);

      return res.redirect("/social/search");
    } catch (err) {
      console.error("MAKE PUBLIC ERROR:", err);

      return res.status(500).send("Unable to make post public.");
    }
  },
);

// Unpublic
app.post(
  "/social/post/make-unpublic/:postId",
  ensureAuthenticated,
  async (req, res) => {
    try {
      const userEmail = req.user?.email || null;

      const postId = parseInt(req.params.postId, 10);

      // =========================================
      // ADMIN CHECK
      // =========================================

      const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const isAdmin =
        !!userEmail && adminEmails.includes(userEmail.toLowerCase());

      if (!isAdmin) {
        return res.status(403).send("Admin access required.");
      }

      // =========================================
      // VALIDATE POST ID
      // =========================================

      if (!Number.isInteger(postId)) {
        return res.status(400).send("Invalid post ID.");
      }

      // =========================================
      // MAKE POST PRIVATE FROM PUBLIC PAGE
      // =========================================

      const result = await db.query(
        `
        UPDATE social_posts
        SET public_enabled = FALSE
        WHERE id = $1
        RETURNING id
        `,
        [postId],
      );

      if (!result.rowCount) {
        return res.status(404).send("Post not found.");
      }

      console.log("POST REMOVED FROM PUBLIC:", postId);

      // Return to search page
      return res.redirect("/social/search");
    } catch (err) {
      console.error("MAKE UNPUBLIC ERROR:", err);

      return res.status(500).send("Unable to remove post from public page.");
    }
  },
);

//publish a few specific post ids : show need ejs here
app.get("/social/exchange", async (req, res) => {
  try {
    // ========================================================
    // PAGINATION
    // ========================================================

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = 2;

    const countResult = await db.query(`
      SELECT COUNT(*)::INTEGER AS total
      FROM social_posts
      WHERE public_enabled = TRUE
    `);

    const totalPosts = Number(countResult.rows[0]?.total) || 0;

    const totalPages = Math.max(Math.ceil(totalPosts / limit), 1);

    const currentPage = Math.min(page, totalPages);

    const offset = (currentPage - 1) * limit;

    // ========================================================
    // PUBLIC POSTS
    // ========================================================

    const result = await db.query(
      `
      SELECT
        p.id,
        p.user_id,
        p.content,
        p.color,
        p.visibility,
        p.public_enabled,
        p.created_at,
        p.updated_at,
        u.email

      FROM social_posts p

      JOIN my_user u
        ON u.id = p.user_id

      WHERE
        p.public_enabled = TRUE

      ORDER BY
        p.created_at DESC,
        p.id DESC

      LIMIT $1
      OFFSET $2
      `,
      [limit, offset],
    );

    // ========================================================
    // POST IDS ON THIS PAGE
    // ========================================================

    const postIds = result.rows.map((row) => row.id);

    // ========================================================
    // POST REACTIONS
    // ONLY FOR POSTS ON THIS PAGE
    // ========================================================

    const reactionCounts = {};

    if (postIds.length > 0) {
      const reactionsResult = await db.query(
        `
        SELECT
          target_id,
          reaction_type,
          COUNT(*)::INTEGER AS count

        FROM social_reactions

        WHERE
          target_type = 'post'
          AND target_id = ANY($1::INTEGER[])

        GROUP BY
          target_id,
          reaction_type
        `,
        [postIds],
      );

      for (const row of reactionsResult.rows) {
        const key = String(row.target_id);

        if (!reactionCounts[key]) {
          reactionCounts[key] = {};
        }

        reactionCounts[key][row.reaction_type] = Number(row.count);
      }
    }

    // ========================================================
    // POST REACTION HELPER
    // ========================================================

    function getPostReactions(postId) {
      const key = String(postId);

      return {
        like: reactionCounts[key]?.like || 0,
        dislike: reactionCounts[key]?.dislike || 0,
        heart: reactionCounts[key]?.heart || 0,
        horse: reactionCounts[key]?.horse || 0,
        rose: reactionCounts[key]?.rose || 0,
        fly: reactionCounts[key]?.fly || 0,
        call: reactionCounts[key]?.call || 0,
        website: reactionCounts[key]?.website || 0,
        email: reactionCounts[key]?.email || 0,
        smile: reactionCounts[key]?.smile || 0,
        bell: reactionCounts[key]?.bell || 0,
        trophy: reactionCounts[key]?.trophy || 0,
        victory: reactionCounts[key]?.victory || 0,
      };
    }

    // ========================================================
    // MEDIA
    // ONLY FOR POSTS ON THIS PAGE
    // ========================================================

    const mediaByPost = {};

    if (postIds.length > 0) {
      const mediaResult = await db.query(
        `
        SELECT
          id,
          post_id,
          file_url,
          file_name,
          mime_type,
          file_size,
          media_text,
           thumbnail_url,
          created_at

        FROM social_post_media

        WHERE
          post_id = ANY($1::INTEGER[])

        ORDER BY
          created_at ASC,
          id ASC
        `,
        [postIds],
      );

      for (const row of mediaResult.rows) {
        if (!mediaByPost[row.post_id]) {
          mediaByPost[row.post_id] = [];
        }

        mediaByPost[row.post_id].push({
          id: row.id,
          postId: row.post_id,
          fileUrl: row.file_url,
          fileName: row.file_name,
          mimeType: row.mime_type,
          fileSize: row.file_size,
          mediaText: row.media_text,
          thumbnailUrl: row.thumbnail_url,
          createdAt: row.created_at,
        });
      }
    }

    // ========================================================
    // BUILD POSTS
    // ========================================================

    const posts = result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      email: row.email,
      content: row.content,
      color: row.color,
      visibility: row.visibility,
      publicEnabled: row.public_enabled,

      createdAt: row.created_at
        ? DateTime.fromJSDate(new Date(row.created_at))
            .setZone("America/Chicago")
            .toFormat("M/d/yyyy")
        : "",

      updatedAt: row.updated_at
        ? DateTime.fromJSDate(new Date(row.updated_at))
            .setZone("America/Chicago")
            .toFormat("M/d/yyyy")
        : "",

      media: mediaByPost[row.id] || [],

      reactions: getPostReactions(row.id),
    }));

    // ========================================================
    // PAGINATION
    // ========================================================

    const pagination = {
      page: currentPage,
      limit,

      totalPosts,
      totalPages,

      hasPrevious: currentPage > 1,
      hasNext: currentPage < totalPages,

      previousPage: currentPage > 1 ? currentPage - 1 : null,

      nextPage: currentPage < totalPages ? currentPage + 1 : null,
    };

    // ========================================================
    // RENDER
    // ========================================================

    return res.render("social-exchange", {
      defaultDate: getToday(),
      posts,
      pagination,
    });
  } catch (err) {
    console.error("PUBLIC POSTS ERROR:", err);

    return res.status(500).send("Unable to load public posts.");
  }
});

//
//allow public react
//allow public react
app.post(
  "/social/post/enable-public-reactions/:postId",
  ensureAuthenticated,
  async (req, res) => {
    try {
      const userEmail = req.user?.email || null;

      // ========================================================
      // ADMIN CHECK
      // ADMIN = ADMIN_EMAILS from .env
      // ========================================================

      const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const normalizedUserEmail = String(userEmail || "")
        .trim()
        .toLowerCase();

      const isAdmin =
        !!normalizedUserEmail && adminEmails.includes(normalizedUserEmail);

      // SPECIAL ADMIN CHECK
      // ========================================================

      const specialAdminEmails = (process.env.SPECIAL_ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const isSpecialAdmin =
        !!normalizedUserEmail &&
        specialAdminEmails.includes(normalizedUserEmail);
      // ========================================================
      // ADMIN OR SPECIAL ADMIN ONLY
      //
      // EMAIL ADMIN IS NOT USED
      // ========================================================

      if (!isAdmin && !isSpecialAdmin) {
        return res.status(403).send("Admin access required.");
      }

      const postId = parseInt(req.params.postId, 10);

      if (!Number.isInteger(postId)) {
        return res.status(400).send("Invalid post ID.");
      }

      const result = await db.query(
        `
        UPDATE social_posts
        SET public_reactions_enabled = TRUE
        WHERE id = $1
        RETURNING id, public_reactions_enabled
        `,
        [postId],
      );

      if (!result.rowCount) {
        return res.status(404).send("Post not found.");
      }

      return res.redirect("/social/search");
    } catch (err) {
      console.error("ENABLE PUBLIC REACTIONS ERROR:", err);

      return res.status(500).send("Unable to enable public reactions.");
    }
  },
);

app.post(
  "/social/post/disable-public-reactions/:postId",
  ensureAuthenticated,
  async (req, res) => {
    try {
      const userEmail = req.user?.email || null;

      const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const normalizedUserEmail = String(userEmail || "")
        .trim()
        .toLowerCase();

      const isAdmin =
        !!normalizedUserEmail && adminEmails.includes(normalizedUserEmail);

      const specialAdminEmails = (process.env.SPECIAL_ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const isSpecialAdmin =
        !!normalizedUserEmail &&
        specialAdminEmails.includes(normalizedUserEmail);

      if (!isAdmin && !isSpecialAdmin) {
        return res.status(403).send("Admin access required.");
      }

      const postId = parseInt(req.params.postId, 10);

      if (!Number.isInteger(postId)) {
        return res.status(400).send("Invalid post ID.");
      }

      const result = await db.query(
        `
        UPDATE social_posts
        SET public_reactions_enabled = FALSE
        WHERE id = $1
        RETURNING id, public_reactions_enabled
        `,
        [postId],
      );

      if (!result.rowCount) {
        return res.status(404).send("Post not found.");
      }

      return res.redirect("/social/search");
    } catch (err) {
      console.error("DISABLE PUBLIC REACTIONS ERROR:", err);

      return res.status(500).send("Unable to disable public reactions.");
    }
  },
);

app.get("/public/post/connect", async (req, res) => {
  try {
    let publicVisitorId = req.cookies.publicVisitorId;

    if (!publicVisitorId) {
      publicVisitorId = crypto.randomUUID();

      res.cookie("publicVisitorId", publicVisitorId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 365,
      });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const limit = 2;

    const countResult = await db.query(`
      SELECT COUNT(*)::INTEGER AS total
      FROM social_posts
      WHERE
        public_enabled = TRUE
        AND public_reactions_enabled = TRUE
    `);

    const totalPosts = Number(countResult.rows[0]?.total) || 0;

    const totalPages = Math.max(Math.ceil(totalPosts / limit), 1);

    const currentPage = Math.min(page, totalPages);

    const offset = (currentPage - 1) * limit;

    const postResult = await db.query(
      `
      SELECT
        p.id,
        p.user_id,
        p.content,
        p.color,
        p.visibility,
        p.public_enabled,
        p.public_reactions_enabled,
        p.created_at,
        p.updated_at,
        u.email

      FROM social_posts p

      JOIN my_user u
        ON u.id = p.user_id

      WHERE
        p.public_enabled = TRUE
        AND p.public_reactions_enabled = TRUE

      ORDER BY
        p.created_at DESC,
        p.id DESC

      LIMIT $1
      OFFSET $2
      `,
      [limit, offset],
    );

    // ==========================================================
    // POST IDS
    // ==========================================================

    const postIds = postResult.rows.map((row) => row.id);

    let reactionsResult = {
      rows: [],
    };

    if (postIds.length > 0) {
      reactionsResult = await db.query(
        `
        SELECT
          target_id,
          reaction_type,
          COUNT(*)::INTEGER AS count

        FROM social_public_reactions

        WHERE
          target_type = 'post'
          AND target_id = ANY($1::bigint[])

        GROUP BY
          target_id,
          reaction_type
        `,
        [postIds],
      );
    }

    // ==========================================================
    // REACTION COUNTS LOOKUP
    // ==========================================================

    const reactionCounts = {};

    for (const row of reactionsResult.rows) {
      const key = String(row.target_id);

      if (!reactionCounts[key]) {
        reactionCounts[key] = {};
      }

      reactionCounts[key][row.reaction_type] = Number(row.count);
    }

    // ==========================================================
    // REACTION HELPER
    // ==========================================================

    function getPostReactions(postId) {
      const key = String(postId);

      return {
        like: reactionCounts[key]?.like || 0,
        dislike: reactionCounts[key]?.dislike || 0,
        heart: reactionCounts[key]?.heart || 0,
        horse: reactionCounts[key]?.horse || 0,
        rose: reactionCounts[key]?.rose || 0,
        call: reactionCounts[key]?.call || 0,
        website: reactionCounts[key]?.website || 0,
        email: reactionCounts[key]?.email || 0,
        smile: reactionCounts[key]?.smile || 0,
        bell: reactionCounts[key]?.bell || 0,
        trophy: reactionCounts[key]?.trophy || 0,
        victory: reactionCounts[key]?.victory || 0,
        folder: reactionCounts[key]?.folder || 0,
        buom_xinh: reactionCounts[key]?.buom_xinh || 0,
        eagle: reactionCounts[key]?.eagle || 0,
      };
    }

    // ==========================================================
    // MEDIA
    // ONLY LOAD MEDIA FOR CURRENT PAGE POSTS
    // ==========================================================

    let mediaResult = {
      rows: [],
    };

    if (postIds.length > 0) {
      mediaResult = await db.query(
        `
        SELECT
          id,
          post_id,
          file_url,
          file_name,
          mime_type,
          file_size,
          media_text,
          created_at

        FROM social_post_media

        WHERE
          post_id = ANY($1::bigint[])

        ORDER BY
          created_at ASC,
          id ASC
        `,
        [postIds],
      );
    }

    // ==========================================================
    // MEDIA LOOKUP
    // ==========================================================

    const mediaByPost = {};

    for (const row of mediaResult.rows) {
      if (!mediaByPost[row.post_id]) {
        mediaByPost[row.post_id] = [];
      }

      mediaByPost[row.post_id].push({
        id: row.id,
        postId: row.post_id,
        fileUrl: row.file_url,
        fileName: row.file_name,
        mimeType: row.mime_type,
        fileSize: row.file_size,
        mediaText: row.media_text,
        createdAt: row.created_at,
      });
    }

    // ==========================================================
    // BUILD POSTS
    // ==========================================================

    const posts = postResult.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      email: row.email,

      content: row.content,
      color: row.color,
      visibility: row.visibility,

      publicEnabled: row.public_enabled,
      publicReactionsEnabled: row.public_reactions_enabled,

      createdAt: row.created_at,
      updatedAt: row.updated_at,

      media: mediaByPost[row.id] || [],

      reactions: getPostReactions(row.id),
    }));

    // ==========================================================
    // PAGINATION
    // ==========================================================

    const pagination = {
      page: currentPage,
      limit,

      totalPosts,
      totalPages,

      hasPrevious: currentPage > 1,
      hasNext: currentPage < totalPages,

      previousPage: currentPage > 1 ? currentPage - 1 : null,

      nextPage: currentPage < totalPages ? currentPage + 1 : null,
    };

    // ==========================================================
    // RENDER
    // ==========================================================

    return res.render("social-public-connect", {
      defaultDate: getToday(),

      // Keep your existing EJS variable name.
      posts,

      pagination,

      // Available for the reaction POST route if needed
      // by the rendered page/client logic.
      publicVisitorId,
    });
  } catch (err) {
    console.error("PUBLIC REACTION PAGE ERROR:", err);

    return res.status(500).send("Unable to load public reaction page.");
  }
});
//
app.post("/public/post/connect", connectReactionLimiter, async (req, res) => {
  try {
    // ========================================================
    // PUBLIC VISITOR ID
    // ========================================================

    let publicVisitorId = req.cookies.publicVisitorId;

    if (!publicVisitorId) {
      publicVisitorId = crypto.randomUUID();

      res.cookie("publicVisitorId", publicVisitorId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 365,
      });
    }

    // ========================================================
    // INPUT
    // ========================================================

    const postId = parseInt(req.body.postId, 10);
    const reactionType = String(req.body.reactionType || "").trim();

    if (!Number.isInteger(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID.",
      });
    }

    const allowedReactions = [
      "like",
      "dislike",
      "heart",
      "horse",
      "rose",
      "call",
      "website",
      "email",
      "smile",
      "bell",
      "trophy",
      "victory",
      "folder",
      "buom_xinh",
      "eagle",
    ];
    console.log("PUBLIC REACTION:", {
      ip: req.ip,
      postId,
      reactionType,
      visitorId: publicVisitorId,
      userAgent: req.get("user-agent"),
    });
    if (!allowedReactions.includes(reactionType)) {
      console.warn("🚨 BLOCKED PUBLIC REACTION:", {
        ip: req.ip,
        postId,
        reactionType,
        visitorId: publicVisitorId,
        userAgent: req.get("user-agent"),
      });

      return res.status(400).json({
        success: false,
        message: "Invalid reaction type.",
      });
    }

    const postResult = await db.query(
      `
      SELECT id
      FROM social_posts
      WHERE
        id = $1
        AND public_enabled = TRUE
        AND public_reactions_enabled = TRUE
      `,
      [postId],
    );

    if (!postResult.rowCount) {
      return res.status(404).json({
        success: false,
        message: "Post is not available for public reactions.",
      });
    }

    // ========================================================
    // INSERT OR CHANGE REACTION
    // ========================================================

    await db.query(
      `
      INSERT INTO social_public_reactions (
        public_visitor_id,
        target_type,
        target_id,
        reaction_type
      )
      VALUES ($1, 'post', $2, $3)

      ON CONFLICT (
        public_visitor_id,
        target_type,
        target_id
      )

      DO UPDATE SET
        reaction_type = EXCLUDED.reaction_type,
        updated_at = NOW()
      `,
      [publicVisitorId, postId, reactionType],
    );

    return res.json({
      success: true,
    });
  } catch (err) {
    console.error("PUBLIC REACTION SAVE ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Unable to save reaction.",
    });
  }
});
//
function canDownloadSocialMedia(userEmail) {
  const downloadAdminEmails = (process.env.SPECIAL_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return downloadAdminEmails.includes(
    String(userEmail || "")
      .trim()
      .toLowerCase(),
  );
}
//
app.get("/social-admin-downloads", ensureAuthenticated, async (req, res) => {
  try {
    const userEmail = req.user?.email || "";

    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    const isAdmin = adminEmails.includes(userEmail.toLowerCase());

    if (!isAdmin) {
      return res.status(403).send("Admin access required.");
    }

    const perPage = 2;

    let page = Number.parseInt(req.query.page, 10);

    if (!Number.isInteger(page) || page < 1) {
      page = 1;
    }

    const countResult = await db.query(`
        SELECT COUNT(DISTINCT p.id) AS total
        FROM social_posts p
        JOIN social_post_media m
          ON m.post_id = p.id
      `);

    const totalPosts = Number(countResult.rows[0].total);

    const totalPages = Math.max(1, Math.ceil(totalPosts / perPage));

    // Prevent page 999 when only 5 pages exist
    if (page > totalPages) {
      page = totalPages;
    }

    const offset = (page - 1) * perPage;

    const result = await db.query(
      `
        SELECT
          p.id AS post_id,
          p.content,
          p.created_at,
          p.user_id,

          u.email,

          m.id AS media_id,
          m.file_name,
          m.file_url,
          m.mime_type,
          m.file_size,
          m.created_at AS media_created_at

        FROM social_posts p

        JOIN my_user u
          ON u.id = p.user_id

        JOIN social_post_media m
          ON m.post_id = p.id

        WHERE p.id IN (
          SELECT p2.id
          FROM social_posts p2
          JOIN social_post_media m2
            ON m2.post_id = p2.id
          GROUP BY p2.id, p2.created_at
          ORDER BY p2.created_at DESC, p2.id DESC
          LIMIT $1
          OFFSET $2
        )

        ORDER BY
          p.created_at DESC,
          p.id DESC,
          m.created_at ASC,
          m.id ASC
        `,
      [perPage, offset],
    );

    const posts = [];

    for (const row of result.rows) {
      let post = posts.find((item) => String(item.id) === String(row.post_id));

      if (!post) {
        post = {
          id: row.post_id,
          content: row.content,
          createdAt: row.created_at,
          userId: row.user_id,
          email: row.email,
          media: [],
        };

        posts.push(post);
      }

      post.media.push({
        id: row.media_id,
        fileName: row.file_name,
        fileUrl: row.file_url,
        mimeType: row.mime_type,
        fileSize: row.file_size,
        createdAt: row.media_created_at,
      });
    }

    return res.render("social-admin-downloads", {
      defaultDate: getToday(),
      posts,
      isAdmin: true,
      canDownload: canDownloadSocialMedia(userEmail),
      page,
      perPage,
      totalPosts,
      totalPages,
    });
  } catch (err) {
    console.error("Social admin downloads error:", err);

    return res.status(500).send("Unable to load social downloads.");
  }
});
//
app.get(
  "/social-admin-downloads/file/:mediaId",
  ensureAuthenticated,
  async (req, res) => {
    try {
      const userEmail = req.user?.email || "";

      const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const isAdmin = adminEmails.includes(userEmail.toLowerCase());

      if (!isAdmin) {
        return res.status(403).send("Admin access required.");
      }
      // restricted admin below is a function from Line 5094
      if (!canDownloadSocialMedia(userEmail)) {
        return res
          .status(403)
          .send("You are not authorized to download social media files.");
      }
      // ---------------------------message above sent-----------------------------
      // MEDIA ID
      // --------------------------------------------------------

      const mediaId = Number(req.params.mediaId);

      if (!Number.isInteger(mediaId) || mediaId <= 0) {
        return res.status(400).send("Invalid media ID.");
      }

      // --------------------------------------------------------
      // GET MEDIA
      // --------------------------------------------------------

      const result = await db.query(
        `
        SELECT
          id,
          file_url,
          file_name,
          mime_type
        FROM social_post_media
        WHERE id = $1
        `,
        [mediaId],
      );

      if (!result.rows.length) {
        return res.status(404).send("Media file not found.");
      }

      const media = result.rows[0];

      // --------------------------------------------------------
      // SAFE FILE NAME
      // --------------------------------------------------------

      const filename = path.basename(media.file_url);

      const filePath = path.join(
        process.cwd(),
        "public",
        "uploads",
        "social",
        filename,
      );

      // --------------------------------------------------------
      // FILE EXISTS?
      // --------------------------------------------------------

      if (!fs.existsSync(filePath)) {
        return res.status(404).send("File no longer exists.");
      }

      // --------------------------------------------------------
      // DOWNLOAD
      // --------------------------------------------------------

      return res.download(filePath, media.file_name || filename);
    } catch (err) {
      console.error("Social admin file download error:", err);

      return res.status(500).send("Unable to download social media file.");
    }
  },
);
//
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
