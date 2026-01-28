const express = require('express');
const router = express.Router(); 
const multer = require('multer');
const path = require('path');
const wallpaperController = require('../controllers/wallpaperController');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'src/uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'wallpaper-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Formato de arquivo inválido. Use JPG ou PNG.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } 
});

router.post(
  '/machines/:uuid/wallpaper',
  upload.single('file'),
  wallpaperController.setWallpaper 
);

module.exports = router;