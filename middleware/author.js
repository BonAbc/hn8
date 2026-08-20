//
// middleware/auth.js
//function created and export
export function ensureAdmin(req, res, next) {
  console.log("=== ensureAdmin ===");
  console.log("Authenticated:", req.isAuthenticated());
  console.log("Session ID:", req.sessionID);
  console.log("User:", req.user);

  // Must be logged in
  if (!req.isAuthenticated()) {
    req.session.showAdminLoginModal = true;
    //
    return res.redirect("/login");
  }

  // Must be admin
  const adminEmails = process.env.ADMIN_EMAILS.split(",");

  if (!adminEmails.includes(req.user.email)) {
    // req.session.alert = "Admin only.";
    // login page pass this message
    req.session.showAdminLoginModal = true;
    // from signin.ejs
    return res.redirect("/login");
  }

  next();
}
//
//
