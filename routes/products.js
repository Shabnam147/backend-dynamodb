const express = require('express');
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');
const router = express.Router();

const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return true;
  }
  return false;
};

// @route  GET /api/products
router.get('/', async (req, res) => {
  try {
    const { search, category, sort, page = 1, limit = 20 } = req.query;
    const result = await Product.findAll({ search, category, sort, page, limit });
    res.json({ success: true, count: result.products.length, ...result });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch products.' });
  }
});

// @route  GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch product.' });
  }
});

// @route  POST /api/products  (Admin only)
router.post(
  '/',
  protect,
  adminOnly,
  [
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
    body('category').optional().isIn(['Electronics', 'Clothing', 'Books', 'Home', 'Sports', 'Other']),
    body('stock').optional().isInt({ min: 0 }),
  ],
  async (req, res) => {
    if (handleValidationErrors(req, res)) return;
    try {
      const product = await Product.create(req.body);
      res.status(201).json({ success: true, message: 'Product added successfully.', product });
    } catch (error) {
      console.error('Add product error:', error);
      res.status(500).json({ success: false, message: 'Failed to add product.' });
    }
  }
);

// @route  PUT /api/products/:id  (Admin only)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.updateById(req.params.id, req.body);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    res.json({ success: true, message: 'Product updated successfully.', product });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update product.' });
  }
});

// @route  DELETE /api/products/:id  (Admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.deleteById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    res.json({ success: true, message: 'Product deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete product.' });
  }
});

module.exports = router;
