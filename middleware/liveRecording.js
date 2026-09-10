import multer from "multer";
import path from "path";
import fs from "fs";

// ============================================================
// UPLOAD DIRECTORY
// ============================================================

const uploadDir = path.resolve(process.cwd(), "uploads", "live");

// Make sure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ============================================================
// MIME TYPE → EXTENSION
// ============================================================

const mimeToExtension = {
  // ----------------------------------------------------------
  // VIDEO
  // ----------------------------------------------------------

  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/ogg": ".ogv",
  "video/quicktime": ".mov",
  "video/x-m4v": ".m4v",
  "video/x-matroska": ".mkv",

  // ----------------------------------------------------------
  // AUDIO
  // ----------------------------------------------------------

  "audio/mp4": ".m4a",
  "audio/webm": ".webm",
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
  "audio/x-m4a": ".m4a",
  "audio/x-mpeg": ".mp3",
};

// ============================================================
// ALLOWED MIME TYPES
// ============================================================

const allowedMimeTypes = new Set([
  // ----------------------------------------------------------
  // VIDEO
  // ----------------------------------------------------------

  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-m4v",
  "video/x-matroska",

  // ----------------------------------------------------------
  // AUDIO
  // ----------------------------------------------------------

  "audio/mp4",
  "audio/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/x-m4a",
  "audio/x-mpeg",
]);

// ============================================================
// ALLOWED EXTENSIONS
// ============================================================
//
// Used as a safe fallback when a browser sends a generic MIME
// type such as text/plain or application/octet-stream.
//
// IMPORTANT:
// We only accept known media extensions here.
// Arbitrary text/plain files are NOT accepted.
//

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

// ============================================================
// STORAGE
// ============================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    // --------------------------------------------------------
    // Get extension from client filename first.
    //
    // Example:
    //
    // live-8.mp4
    // live-8.webm
    // --------------------------------------------------------

    let ext = path.extname(file.originalname || "").toLowerCase();

    // --------------------------------------------------------
    // If filename has no extension, derive from MIME type.
    // --------------------------------------------------------

    if (!ext) {
      const mimeType = String(file.mimetype || "")
        .toLowerCase()
        .split(";")[0]
        .trim();

      ext = mimeToExtension[mimeType] || "";
    }

    // --------------------------------------------------------
    // Final generated filename.
    // --------------------------------------------------------

    const filename = `live-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}${ext}`;

    console.log("LIVE RECORDING: Storage filename:", {
      originalname: file.originalname,
      mimetype: file.mimetype,
      extension: ext,
      filename,
    });

    cb(null, filename);
  },
});

// ============================================================
// MULTER UPLOAD
// ============================================================

const liveRecordingUpload = multer({
  storage,

  limits: {
    // Maximum recording size: 2 GB
    fileSize: 2 * 1024 * 1024 * 1024,

    // Only one recording per request
    files: 1,
  },

  // ==========================================================
  // FILE FILTER
  // ==========================================================

  fileFilter: (req, file, cb) => {
    // --------------------------------------------------------
    // Normalize MIME type.
    //
    // Examples:
    //
    // video/mp4
    // video/mp4;codecs=avc1
    //
    // become:
    //
    // video/mp4
    // --------------------------------------------------------

    const receivedMimeType = String(file.mimetype || "");

    const mimeType = receivedMimeType.toLowerCase().split(";")[0].trim();

    // --------------------------------------------------------
    // Get filename extension.
    // --------------------------------------------------------

    const extension = path.extname(file.originalname || "").toLowerCase();

    // --------------------------------------------------------
    // DEBUG
    // --------------------------------------------------------

    console.log("==========================================");
    console.log("LIVE RECORDING UPLOAD");
    console.log("==========================================");

    console.log({
      originalname: file.originalname,
      receivedMimeType,
      normalizedMimeType: mimeType,
      extension,
    });

    // ========================================================
    // 1. NORMAL MEDIA MIME TYPE
    // ========================================================
    //
    // Chrome
    // Edge
    // Firefox
    // Safari
    //
    // Normal examples:
    //
    // video/webm
    // video/mp4
    // audio/webm
    // audio/mp4
    //

    if (allowedMimeTypes.has(mimeType)) {
      console.log("LIVE RECORDING: Accepted MIME type:", {
        mimeType,
        extension,
      });

      console.log("==========================================");

      return cb(null, true);
    }

    // ========================================================
    // 2. GENERIC MIME FALLBACK
    // ========================================================
    //
    // Some browsers/devices may incorrectly send:
    //
    // text/plain
    // application/octet-stream
    //
    // while the filename still contains a known media
    // extension.
    //
    // Example:
    //
    // live-8.mp4
    // text/plain
    //
    // We allow this ONLY when the extension is known to be a
    // supported audio/video format.
    //

    const genericMimeTypes = new Set([
      "text/plain",
      "application/octet-stream",
      "",
    ]);

    if (genericMimeTypes.has(mimeType) && allowedExtensions.has(extension)) {
      console.warn("LIVE RECORDING: Generic MIME fallback accepted:", {
        originalname: file.originalname,
        receivedMimeType,
        normalizedMimeType: mimeType,
        extension,
      });

      console.log("==========================================");

      return cb(null, true);
    }

    //
    // 3. REJECT UNSUPPORTED FILE
    // ========================================================

    console.error("LIVE RECORDING: Rejected unsupported file:", {
      originalname: file.originalname,
      receivedMimeType,
      normalizedMimeType: mimeType,
      extension,
    });

    console.log("==========================================");

    return cb(
      new Error(
        `Unsupported live recording type: ${
          mimeType || "unknown"
        } (${extension || "no extension"}).`,
      ),
    );
  },
});

// ============================================================
// EXPORT
// ============================================================

export default liveRecordingUpload;
