import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = "/uploads/social";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

// ======================================================
// MULTER STORAGE
// ======================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    const filename = `social-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}${ext}`;

    cb(null, filename);
  },
});

// ======================================================
// MULTER UPLOAD
// ======================================================

const socialFileUpload = multer({
  storage,

  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 10,
  },

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/webm",
      "video/mp4",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error(
          "Only JPG, PNG, WebP, GIF, WebM, MP4, and PDF files are allowed.",
        ),
      );
    }

    cb(null, true);
  },
});

export default socialFileUpload;
