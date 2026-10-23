const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); // Save to uploads folder
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "_" + file.originalname.replace(/\s+/g, '-')); // Unique filename
    }
});

const upload = multer({ storage: storage });
module.exports = upload;
