import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = "/uploads/live";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    let ext = path.extname(file.originalname || "").toLowerCase();

    if (!ext) {
      const mimeType = String(file.mimetype || "")
        .toLowerCase()
        .split(";")[0]
        .trim();

      const mimeToExt = {
        "video/mp4": ".mp4",
        "video/webm": ".webm",
        "video/quicktime": ".mov",
        "video/ogg": ".ogv",
        "audio/mp4": ".m4a",
        "audio/webm": ".webm",
        "audio/mpeg": ".mp3",
        "audio/ogg": ".ogg",
      };

      ext = mimeToExt[mimeType] || "";
    }

    const filename = `live-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}${ext}`;

    cb(null, filename);
  },
});

const liveRecordingUpload = multer({
  storage,

  limits: {
    fileSize: 2 * 1024 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (req, file, cb) => {
    const mimeType = String(file.mimetype || "")
      .toLowerCase()
      .split(";")[0]
      .trim();

    const extension = path.extname(file.originalname || "").toLowerCase();

    const allowedMimeTypes = [
      // VIDEO
      "video/webm",
      "video/mp4",
      "video/ogg",
      "video/quicktime",
      "video/x-m4v",
      "video/x-matroska",

      // AUDIO
      "audio/webm",
      "audio/mp4",
      "audio/mpeg",
      "audio/ogg",
      "audio/x-m4a",
      "audio/x-mpeg",
    ];

    const allowedExtensions = [
      ".mp4",
      ".webm",
      ".mov",
      ".ogv",
      ".m4v",
      ".mkv",
      ".m4a",
      ".mp3",
      ".ogg",
    ];

    console.log("LIVE RECORDING UPLOAD:", {
      originalname: file.originalname,
      mimetype: file.mimetype,
      normalizedMimeType: mimeType,
      extension,
    });

    // Normal case: MIME type is correct
    if (allowedMimeTypes.includes(mimeType)) {
      return cb(null, true);
    }

    /*
     * Safari/iPhone/browser upload fallback:
     *
     * Some clients send:
     *
     *   filename: live-6.mp4
     *   mimetype: text/plain
     *
     * The filename tells us this is intended to be an MP4.
     */
    if (mimeType === "text/plain" && allowedExtensions.includes(extension)) {
      console.warn(
        "LIVE RECORDING: MIME type was text/plain, accepting based on extension:",
        {
          originalname: file.originalname,
          extension,
        },
      );

      return cb(null, true);
    }

    console.error("LIVE RECORDING: Rejected file:", {
      originalname: file.originalname,
      mimetype: file.mimetype,
      normalizedMimeType: mimeType,
      extension,
    });

    return cb(
      new Error(
        `Unsupported live recording type: ${
          mimeType || "unknown"
        } (${extension || "no extension"}).`,
      ),
    );
  },
});

export default liveRecordingUpload;
