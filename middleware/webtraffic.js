import geoip from "geoip-lite";

export default function webtraffic(db, io) {
  return async (req, res, next) => {
    if (
      req.originalUrl.includes(".js") ||
      req.originalUrl.includes(".css") ||
      req.originalUrl.includes(".png") ||
      req.originalUrl.includes(".jpg") ||
      req.originalUrl.includes(".jpeg") ||
      req.originalUrl.includes(".gif") ||
      req.originalUrl.includes(".svg") ||
      req.originalUrl.includes(".ico") ||
      req.originalUrl.includes(".woff") ||
      req.originalUrl.includes(".woff2")
    ) {
      return next();
    }

    //
    const connectionIp = req.ip?.replace("::ffff:", "") || "Unknown";

    const cloudflareIp = req.headers["cf-connecting-ip"];

    const visitorIp =
      typeof cloudflareIp === "string" && cloudflareIp.trim()
        ? cloudflareIp.trim()
        : connectionIp;

    const geo = geoip.lookup(visitorIp);

    const country = geo?.country || "Unknown";

    const city = geo?.city || "Unknown";

    const timezone = geo?.timezone || "Unknown";

    res.on("finish", async () => {
      const status = res.statusCode;

      try {
        const result = await db.query(
          `
            INSERT INTO webtraffic
            (
              visitor_ip,
              ip_address,
              country,
              city,
              timezone,
              page,
              status
            )
            VALUES
            ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, created_at
          `,
          [
            visitorIp,
            connectionIp,
            country,
            city,
            timezone,
            req.originalUrl,
            status,
          ],
        );

        const visitor = result.rows[0];

        io.emit("new-visitor", {
          id: visitor.id,

          // REAL VISITOR IP
          visitor_ip: visitorIp,

          // CLOUDFLARE / CONNECTION IP
          ip_address: connectionIp,

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

    // ==================================================
    // CONTINUE REQUEST
    // ==================================================

    next();
  };
}
