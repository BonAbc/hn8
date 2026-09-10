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

    /*
     * iPhone Safari / MediaRecorder can sometimes send a filename
     * without a useful extension. Use the MIME type as a fallback.
     */
    if (!ext) {
      const mimeType = String(file.mimetype || "")
        .toLowerCase()
        .split(";")[0]
        .trim();

      if (mimeType === "video/mp4") {
        ext = ".mp4";
      } else if (mimeType === "video/webm") {
        ext = ".webm";
      } else if (mimeType === "video/quicktime") {
        ext = ".mov";
      } else if (mimeType === "video/ogg") {
        ext = ".ogv";
      } else if (mimeType === "audio/mp4") {
        ext = ".m4a";
      } else if (mimeType === "audio/webm") {
        ext = ".webm";
      } else if (mimeType === "audio/mpeg") {
        ext = ".mp3";
      } else if (mimeType === "audio/ogg") {
        ext = ".ogg";
      }
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
    // Maximum recording size: 2 GB
    fileSize: 2 * 1024 * 1024 * 1024,

    // One recording per request
    files: 1,
  },

  fileFilter: (req, file, cb) => {
    /*
     * Safari/iPhone can report MIME types slightly differently.
     * Normalize the value before checking it.
     */
    const mimeType = String(file.mimetype || "")
      .toLowerCase()
      .split(";")[0]
      .trim();

    const allowedTypes = [
      // VIDEO
      "video/webm",
      "video/mp4",
      "video/ogg",
      "video/quicktime",

      // AUDIO
      "audio/webm",
      "audio/mp4",
      "audio/mpeg",
      "audio/ogg",

      /*
       * Safari can occasionally send these media types.
       */
      "video/x-m4v",
      "video/x-matroska",
      "audio/x-m4a",
      "audio/x-mpeg",
    ];

    console.log("LIVE RECORDING UPLOAD:", {
      originalname: file.originalname,
      mimetype: file.mimetype,
      normalizedMimeType: mimeType,
    });

    if (!allowedTypes.includes(mimeType)) {
      console.error("LIVE RECORDING: Rejected MIME type:", {
        originalname: file.originalname,
        mimetype: file.mimetype,
        normalizedMimeType: mimeType,
      });

      return cb(
        new Error(`Unsupported live recording type: ${mimeType || "unknown"}.`),
      );
    }

    cb(null, true);
  },
});

export default liveRecordingUpload;
