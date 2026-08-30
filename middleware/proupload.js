import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import sharp from "sharp";

// ======================================================
// PROFILE AVATAR DIRECTORY
// ======================================================

const uploadDir = "/uploads/avatar";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

// ======================================================
// TEMPORARY UPLOAD DIRECTORY
//
// Multer saves the original upload here first.
// Sharp validates, resizes, and converts it.
// ======================================================

const tempDir = path.join(uploadDir, "temp");

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, {
    recursive: true,
  });
}

// ======================================================
// MULTER STORAGE
// ======================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    const filename = `profile-temp-${crypto.randomUUID()}${ext}`;

    cb(null, filename);
  },
});

// ======================================================
// PROFILE AVATAR UPLOAD
// ======================================================

const profileFileUpload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },

  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, and WebP image files are allowed."));
    }

    cb(null, true);
  },
});

// ======================================================
// SHARP PROCESSING
//
// Sharp:
// - Verifies the file is a readable image
// - Applies EXIF orientation
// - Crops/resizes to 500x500
// - Converts to WebP
// - Removes the temporary original
// ======================================================

profileFileUpload.processAvatar = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  const inputPath = req.file.path;

  let outputPath;

  try {
    const filename = `profile-${crypto.randomUUID()}.webp`;

    outputPath = path.join(uploadDir, filename);

    await sharp(inputPath)
      .rotate()
      .resize(500, 500, {
        fit: "cover",
        position: "centre",
      })
      .webp({
        quality: 85,
      })
      .toFile(outputPath);

    // Delete the original temporary upload.
    await fs.promises.unlink(inputPath);

    // Replace Multer information with the
    // final processed WebP information.
    req.file = {
      ...req.file,
      filename,
      path: outputPath,
      destination: uploadDir,
      mimetype: "image/webp",
      originalname: filename,
    };

    return next();
  } catch (err) {
    // Delete temporary upload.
    try {
      await fs.promises.unlink(inputPath);
    } catch {}

    // Delete partially-created output if necessary.
    if (outputPath) {
      try {
        await fs.promises.unlink(outputPath);
      } catch {}
    }

    console.error("PROFILE AVATAR PROCESSING ERROR:", err);

    return res.status(400).send("The uploaded avatar is not a valid image.");
  }
};

export default profileFileUpload;
