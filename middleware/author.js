export function ensureAdmin(req, res, next) {
  if (!req.isAuthenticated()) {
    req.session.showAdminLoginModal = true;
    return res.redirect("/login");
  }

  const adminEmails = process.env.ADMIN_EMAILS.split(",").map((email) =>
    email.trim().toLowerCase(),
  );

  const specialAdminEmails =
    process.env.SPECIAL_ADMIN_EMAIL?.trim().toLowerCase();

  const userEmail = req.user.email.trim().toLowerCase();

  const isAdmin =
    adminEmails.includes(userEmail) || userEmail === specialAdminEmails;

  if (!isAdmin) {
    req.session.showAdminLoginModal = true;
    return res.redirect("/login");
  }

  next();
}
