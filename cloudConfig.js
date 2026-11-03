const path = require("path");

// Use Cloudinary only if credentials are available
if (
  process.env.CLOUD_NAME &&
  process.env.CLOUD_API_KEY &&
  process.env.CLOUD_API_SECRET
) {
  const cloudinary = require("cloudinary").v2;
  const { CloudinaryStorage } = require("multer-storage-cloudinary");

  cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
  });

  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: "wanderlust_DEV",
      allowedFormats: ["png", "jpg", "jpeg", "webp"],
    },
  });

  module.exports = { cloudinary, storage };
} else {
  // Fallback: save images to local /public/uploads folder (no Cloudinary needed)
  const multer = require("multer");
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, path.join(__dirname, "public", "uploads"));
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  });

  console.log(
    "⚠️  No Cloudinary credentials found — using local disk storage (public/uploads/)"
  );

  module.exports = { cloudinary: null, storage };
}
