export function ensureAdmin(req, res, next) {
  if (!req.isAuthenticated()) {
    req.session.showAdminLoginModal = true;
    return res.redirect("/login");
  }

  const role = req.user?.role;

  const isAdmin = role === "admin1" || role === "admin2";

  if (!isAdmin) {
    req.session.showAdminLoginModal = true;
    return res.redirect("/login");
  }

  next();
}
