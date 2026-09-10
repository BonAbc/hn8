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
    const ext = path.extname(file.originalname).toLowerCase();

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
    const allowedTypes = [
      // VIDEO
      "video/webm",
      "video/mp4",
      "video/ogg",

      // AUDIO
      "audio/webm",
      "audio/mp4",
      "audio/mpeg",
      "audio/ogg",
    ];

    const mimeType = String(file.mimetype || "")
      .toLowerCase()
      .split(";")[0]
      .trim();

    if (!allowedTypes.includes(mimeType)) {
      return cb(
        new Error("Only WebM, MP4, OGG, and MPEG live recordings are allowed."),
      );
    }

    cb(null, true);
  },
});

export default liveRecordingUpload;
