//
// in middleware: next(): continue processing.
// request > backend > middleware > save data > emit to browser.
//

import geoip from "geoip-lite";

export default function webtraffic(db, io) {
  return async (req, res, next) => {
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

    res.on("finish", async () => {
      const status = res.statusCode;

      try {
        const result = await db.query(
          `
            INSERT INTO webtraffic
            (ip_address, country, city, timezone, page, status)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, created_at
          `,
          [ip, country, city, timezone, req.originalUrl, status],
        );

        const visitor = result.rows[0];

        io.emit("new-visitor", {
          id: visitor.id,
          ip,
          country,
          city,
          timezone,
          page: req.originalUrl,
          status,
          time: visitor.created_at,
        });
      } catch (error) {
        console.error("Failed to save web traffic:", error);
      }
    });

    next();
  };
}
