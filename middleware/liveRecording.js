import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = "/uploads/live";

// Make sure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/*
 * Convert MIME type → extension.
 *
 * Recording modes:
 *
 * 1. Microphone only
 *    audio/mp4   → .m4a
 *    audio/webm  → .webm
 *    audio/mpeg  → .mp3
 *    audio/ogg   → .ogg
 *
 * 2. Video only
 *    video/mp4       → .mp4
 *    video/webm      → .webm
 *    video/quicktime → .mov
 *
 * 3. Microphone + Video
 *    video/mp4 / video/webm
 *
 * A file containing video + microphone is still video/*
 * because the container contains a video stream and an audio stream.
 */
const mimeToExtension = {
  // VIDEO
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/ogg": ".ogv",
  "video/quicktime": ".mov",
  "video/x-m4v": ".m4v",
  "video/x-matroska": ".mkv",

  // AUDIO
  "audio/mp4": ".m4a",
  "audio/webm": ".webm",
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
  "audio/x-m4a": ".m4a",
  "audio/x-mpeg": ".mp3",
};

/*
 * MIME types that are normally accepted.
 */
const allowedMimeTypes = new Set([
  // VIDEO
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-m4v",
  "video/x-matroska",

  // AUDIO
  "audio/mp4",
  "audio/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/x-m4a",
  "audio/x-mpeg",
]);

/*
 * Valid media extensions.
 *
 * These are also used for the Safari/iPhone fallback because
 * Safari can occasionally report a media upload as text/plain.
 */
const allowedExtensions = new Set([
  // VIDEO
  ".mp4",
  ".webm",
  ".mov",
  ".ogv",
  ".m4v",
  ".mkv",

  // AUDIO
  ".m4a",
  ".mp3",
  ".ogg",
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    /*
     * First try to use the extension supplied by the client.
     *
     * Example:
     * live-6.mp4 → .mp4
     */
    let ext = path.extname(file.originalname || "").toLowerCase();

    /*
     * If there is no extension, derive it from the MIME type.
     */
    if (!ext) {
      const mimeType = String(file.mimetype || "")
        .toLowerCase()
        .split(";")[0]
        .trim();

      ext = mimeToExtension[mimeType] || "";
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
     * Normalize MIME.
     *
     * Examples:
     *
     * video/mp4
     * video/mp4;codecs=avc1
     *
     * both become:
     *
     * video/mp4
     */
    const mimeType = String(file.mimetype || "")
      .toLowerCase()
      .split(";")[0]
      .trim();

    /*
     * Get extension from filename.
     */
    const extension = path.extname(file.originalname || "").toLowerCase();

    console.log("LIVE RECORDING UPLOAD:", {
      originalname: file.originalname,
      mimetype: file.mimetype,
      normalizedMimeType: mimeType,
      extension,
    });

    /*
     * =========================================================
     * NORMAL CASE
     * =========================================================
     *
     * Chrome / Firefox / Safari when MIME is reported correctly.
     */
    if (allowedMimeTypes.has(mimeType)) {
      console.log("LIVE RECORDING: Accepted MIME type:", {
        mimeType,
        extension,
      });

      return cb(null, true);
    }

    /*
     * =========================================================
     * SAFARI / IPHONE FALLBACK
     * =========================================================
     *
     * Safari/iPhone can sometimes send:
     *
     *   filename = live-6.mp4
     *   mimetype  = text/plain
     *
     * The actual recording can still be a valid media file.
     *
     * We ONLY accept text/plain when the filename has a known
     * audio/video media extension.
     *
     * We do NOT accept arbitrary text/plain uploads.
     */
    if (mimeType === "text/plain" && allowedExtensions.has(extension)) {
      console.warn("LIVE RECORDING: Safari/iPhone MIME fallback:", {
        originalname: file.originalname,
        receivedMimeType: file.mimetype,
        extension,
      });

      return cb(null, true);
    }

    /*
     * =========================================================
     * REJECT
     * =========================================================
     */
    console.error("LIVE RECORDING: Rejected unsupported file:", {
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
