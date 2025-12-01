const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

router.get('/', (req, res) => {
    res.json({ message: "Rota de alertas funcionando" });
});

module.exports = router;