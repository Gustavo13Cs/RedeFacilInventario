const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');


router.get('/settings/categories', inventoryController.getCategories);
router.post('/settings/categories', inventoryController.addCategory);
router.delete('/settings/categories/:id', inventoryController.removeCategory);

router.get('/', inventoryController.listItems);      
router.post('/', inventoryController.createItem);   
router.put('/:id', inventoryController.updateItem);  
router.delete('/:id', inventoryController.deleteItem);

module.exports = router;