const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);

router.get('/', authController.listUsers);       
router.post('/register', authController.createUser); 
router.delete('/:id', authController.deleteUser);    

module.exports = router;