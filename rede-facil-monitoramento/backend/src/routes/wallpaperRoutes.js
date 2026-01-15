const express = require('express');
const router = express.Router(); // <--- ESSA LINHA É ESSENCIAL
const multer = require('multer');
const path = require('path');
const wallpaperController = require('../controllers/wallpaperController');

// Configuração do Armazenamento
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Certifique-se que esta pasta existe no seu container
        cb(null, 'src/uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'wallpaper-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
    }
});

// Filtro de Arquivos
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

/**
 * Rota para Upload e Aplicação de Wallpaper
 */
router.post(
  '/machines/:uuid/wallpaper',
  upload.single('file'),
  wallpaperController.setWallpaper // <--- Usando a lógica do Controller que já corrigimos
);

module.exports = router;