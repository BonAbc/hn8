//
import geoip from "geoip-lite";

export default function webtraffic(db, io) {
  return async (req, res, next) => {
    // ignore static files
    if (
      req.originalUrl.includes(".js") ||
      req.originalUrl.includes(".css") ||
      req.originalUrl.includes(".png") ||
      req.originalUrl.includes(".jpg") ||
      req.originalUrl.includes(".ico")
    ) {
      return next();
    }

    const ip = req.ip.replace("::ffff:", "");

    const geo = geoip.lookup(ip);

    const country = geo?.country || "Unknown";
    const city = geo?.city || "Unknown";
    const timezone = geo?.timezone || "Unknown";

    await db.query(
      `
            INSERT INTO webtraffic
            (ip_address, country, city, timezone, page)
            VALUES ($1, $2, $3, $4, $5)
            `,
      [ip, country, city, timezone, req.originalUrl],
    );

    io.emit("new-visitor", {
      ip,
      country,
      city,
      timezone,
      page: req.originalUrl,
      time: new Date(),
    });

    next();
  };
}
