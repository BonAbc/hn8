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

dotenv.config();

const app = express();

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

function getToday() {
  return new Date().toISOString().split("T")[0];
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

const adminEmails = process.env.ADMIN_EMAILS
  ? process.env.ADMIN_EMAILS.split(",").map((email) => email.trim())
  : [];

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}

function ensureAdmin(req, res, next) {
  if (
    req.isAuthenticated &&
    req.isAuthenticated() &&
    adminEmails.includes(req.user.email)
  ) {
    return next();
  }

  return res.status(403).render("HN.ejs", {
    message: "Thank you for visiting Hieu Nguyen Page.",
    defaultDate: getToday(),
  });
}
// ----------------------------
// Routes (Home, About, Contact, Links, Calculator, Mortgage, Hana)
// ----------------------------
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
app.post("/contact", async (req, res) => {
  const { name, phone, email, communication: commu, text: comment } = req.body;
  try {
    await db.query(
      "INSERT INTO cliinfo (name, phone, email, commu, comment) VALUES ($1,$2,$3,$4,$5)",
      [name, phone, email, commu, comment]
    );
    res.render("contact.ejs", {
      defaultDate: getToday(),
      thanks: "Thank you for your message",
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving contact message");
  }
});

// Additional Links & Tools
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

// ----------------------------
// Admin & Auth Routes
// ----------------------------
app.get("/tax", ensureAuthenticated, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM taxrate_2025 ORDER BY id");
    res.render("tax.ejs", { defaultDate: getToday(), taxData: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading tax data");
  }
});

app.get("/mes", ensureAuthenticated, async (req, res) => {
  if (!adminEmails.includes(req.user.email))
    return res.status(403).render("denied.ejs", {
      defaultDate: getToday(),
      message: "Access denied",
    });
  try {
    const result = await db.query("SELECT * FROM cliinfo ORDER BY id");
    res.render("mes.ejs", { defaultDate: getToday(), mes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading data");
  }
});

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
app.post("/signup", async (req, res) => {
  const { username: email, password } = req.body;
  const errors = {};
  const formData = { email, password };
  try {
    const checkUser = await db.query(
      "SELECT 1 FROM my_user WHERE email=$1 LIMIT 1",
      [email]
    );
    if (checkUser.rowCount > 0)
      return res.render("register.ejs", {
        errors: { email: "Email exists" },
        defaultDate: getToday(),
        formData,
      });
    if (!isValidPassword(password))
      return res.render("register.ejs", {
        errors: { password: "Password invalid" },
        defaultDate: getToday(),
        formData,
      });
    const hash = await bcrypt.hash(password, saltRounds);
    const result = await db.query(
      "INSERT INTO my_user (email, pw) VALUES ($1,$2) RETURNING *",
      [email, hash]
    );
    const user = result.rows[0];
    req.login(user, (err) => {
      if (err) return res.redirect("/login");
      res.redirect("/tax");
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error signing up");
  }
});

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
app.post("/login", async (req, res, next) => {
  const { username, password } = req.body;
  try {
    const result = await db.query("SELECT * FROM my_user WHERE email=$1", [
      username,
    ]);
    if (result.rows.length === 0) {
      req.flash("error", "Invalid username or password");
      return res.redirect("/login");
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.pw);
    if (!match) {
      req.flash("error", "Invalid username or password");
      return res.redirect("/login");
    }

    // 🧠 Important: always RETURN req.logIn to prevent fallthrough
    return req.logIn(user, (err) => {
      if (err) return next(err);
      req.session.isAdmin = adminEmails.includes(user.email);
      return res.redirect(req.session.isAdmin ? "/mes" : "/tax");
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

// Change password POST
app.post("/chapw", async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;
  if (!email || !newPassword || !confirmPassword)
    return res.render("chapw.ejs", {
      message: "All fields required",
      defaultDate: getToday(),
    });
  if (newPassword !== confirmPassword)
    return res.render("chapw.ejs", {
      message: "Passwords do not match",
      defaultDate: getToday(),
    });
  if (!isValidPassword(newPassword))
    return res.render("chapw.ejs", {
      message: "Password invalid",
      defaultDate: getToday(),
    });

  try {
    const hashed = await bcrypt.hash(newPassword, saltRounds);
    const result = await db.query(
      "UPDATE my_user SET pw=$1 WHERE email=$2 RETURNING email",
      [hashed, email.trim()]
    );
    if (result.rowCount === 0)
      return res.render("chapw.ejs", {
        message: "Email not registered",
        defaultDate: getToday(),
      });
    res.render("chapw.ejs", {
      message: "Password updated successfully!",
      defaultDate: getToday(),
    });
  } catch (err) {
    console.error(err);
    res.render("chapw.ejs", {
      message: "Something went wrong",
      defaultDate: getToday(),
    });
  }
});

app.set("trust proxy", true); // needed to capture real IP behind proxies

// ----------------------------
// Visitor Tracking Route
// ----------------------------
app.get("/track-visitor", async (req, res) => {
  try {
    const ipAddress =
      req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    console.log("Tracking visitor IP:", ipAddress);

    // Try to update visitor's visited_at timestamp
    const updateVisitor = await db.query(
      "UPDATE visitors SET visited_at = NOW() WHERE ip_address = $1",
      [ipAddress]
    );

    if (updateVisitor.rowCount === 0) {
      // If visitor not found, insert new record
      await db.query(
        "INSERT INTO visitors (ip_address, visited_at) VALUES ($1, NOW())",
        [ipAddress]
      );
    }

    // Always increment total visit count
    const updateResult = await db.query(
      "UPDATE visits SET total_count = total_count + 1, last_updated = NOW() WHERE id = 1"
    );

    if (updateResult.rowCount === 0) {
      // If no visits row yet, create it
      await db.query(
        "INSERT INTO visits (id, total_count, last_updated) VALUES (1, 1, NOW())"
      );
    }

    res.send("Visitor tracked successfully.");
  } catch (error) {
    console.error("❌ Error tracking visitor:", error);
    res.status(500).send("Internal server error");
  }
});

// ----------------------------
// Admin-only Visitor Stats Page
// ----------------------------
app.get("/hnpage", ensureAdmin, async (req, res) => {
  try {
    const limit = 20;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    const { startDate, endDate, search } = req.query;

    let baseQuery = "FROM visitors WHERE 1=1";
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      baseQuery += ` AND visited_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      baseQuery += ` AND visited_at <= $${paramIndex}`;
      params.push(endDate + " 23:59:59");
      paramIndex++;
    }

    if (search) {
      baseQuery += ` AND ip_address ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Count total
    const countResult = await db.query(`SELECT COUNT(*) ${baseQuery}`, params);
    const totalVisitors = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalVisitors / limit);

    // Fetch visitors
    const visitorsResult = await db.query(
      `SELECT ip_address, visited_at ${baseQuery} ORDER BY visited_at DESC LIMIT $${paramIndex} OFFSET $${
        paramIndex + 1
      }`,
      [...params, limit, offset]
    );

    // Fetch overall stats
    const visitsResult = await db.query(
      "SELECT total_count, last_updated FROM visits WHERE id = 1"
    );
    const visitStats = visitsResult.rows[0] || {
      total_count: 0,
      last_updated: null,
    };

    res.render("thongsuot.ejs", {
      totalCount: visitStats.total_count,
      lastUpdated: visitStats.last_updated,
      visitors: visitorsResult.rows,
      defaultDate: getToday(),

      startDate: startDate || "",
      endDate: endDate || "",
      search: search || "",

      currentPage: page,
      totalPages,
      adminEmail: req.user?.email || "Admin",
      message: "Visitor statistics loaded successfully.",
    });
  } catch (error) {
    console.error("❌ Error fetching visitor stats:", error);
    res.status(500).send("Internal server error");
  }
});
// Visitor Tracking Route end

// ----------------------------
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
//  console.log(`🚀 Server running on http://localhost:${port}`);
//});
