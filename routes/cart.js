const express = require('express');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.use(protect);

const enrich = async (items) => {
  // Attach current name/imageUrl/stock for each line item (replaces Mongoose .populate)
  const enriched = [];
  for (const item of items) {
    const product = await Product.findById(item.productId);
    enriched.push({
      ...item,
      name: product?.name,
      imageUrl: product?.imageUrl,
      stock: product?.stock,
    });
  }
  return enriched;
};

// @route  GET /api/cart
router.get('/', async (req, res) => {
  try {
    const cart = await Cart.findByUserId(req.user.userId);
    const items = await enrich(cart.items || []);
    res.json({ success: true, cart: { ...cart, items, totalAmount: Cart.getTotal(cart.items || []) } });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch cart.' });
  }
});

// @route  POST /api/cart
router.post('/', async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: 'Product ID is required.' });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    if (product.stock < quantity) {
      return res.status(400).json({ success: false, message: `Only ${product.stock} units in stock.` });
    }

    const cart = await Cart.findByUserId(req.user.userId);
    const items = cart.items || [];
    const idx = items.findIndex((i) => i.productId === productId);

    if (idx > -1) items[idx].quantity += parseInt(quantity);
    else items.push({ productId, quantity: parseInt(quantity), price: product.price });

    const saved = await Cart.save(req.user.userId, items);
    const enriched = await enrich(items);
    res.json({ success: true, message: 'Item added to cart.', cart: { ...saved, items: enriched } });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ success: false, message: 'Failed to add item to cart.' });
  }
});

// @route  PUT /api/cart/:productId
router.put('/:productId', async (req, res) => {
  try {
    const { quantity } = req.body;
    if (!quantity || parseInt(quantity) < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1.' });
    }

    const cart = await Cart.findByUserId(req.user.userId);
    const items = cart.items || [];
    const idx = items.findIndex((i) => i.productId === req.params.productId);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Item not found in cart.' });

    items[idx].quantity = parseInt(quantity);
    const saved = await Cart.save(req.user.userId, items);
    const enriched = await enrich(items);
    res.json({ success: true, message: 'Cart updated.', cart: { ...saved, items: enriched } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update cart.' });
  }
});

// @route  DELETE /api/cart/:productId
router.delete('/:productId', async (req, res) => {
  try {
    const cart = await Cart.findByUserId(req.user.userId);
    const items = (cart.items || []).filter((i) => i.productId !== req.params.productId);
    const saved = await Cart.save(req.user.userId, items);
    const enriched = await enrich(items);
    res.json({ success: true, message: 'Item removed from cart.', cart: { ...saved, items: enriched } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to remove item from cart.' });
  }
});

// @route  DELETE /api/cart
router.delete('/', async (req, res) => {
  try {
    await Cart.clear(req.user.userId);
    res.json({ success: true, message: 'Cart cleared.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to clear cart.' });
  }
});

module.exports = router;