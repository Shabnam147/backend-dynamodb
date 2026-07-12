const express = require('express');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');
const { publishPurchaseEvent } = require('../config/sns');
const router = express.Router();

router.use(protect);

// @route  POST /api/orders  — place an order, clear cart, notify admin via SNS
router.post('/', async (req, res) => {
  try {
    const { shippingAddress } = req.body;
    const cart = await Cart.findByUserId(req.user.id);
    const items = cart.items || [];
    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'Your cart is empty.' });
    }

    const orderItems = [];
    for (const item of items) {
      const product = await Product.findById(item.productId);
      orderItems.push({
        productId: item.productId,
        name: product?.name || 'Unknown item',
        quantity: item.quantity,
        price: item.price,
      });
      // Best-effort stock decrement
      await Product.decrementStock(item.productId, item.quantity);
    }

    const totalAmount = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const order = await Order.create({ userId: req.user.id, items: orderItems, totalAmount, shippingAddress });

    await Cart.clear(req.user.id);

    // Fire-and-forget notification to the "purchase" SNS topic (Topic 2)
    publishPurchaseEvent(order, req.user);

    res.status(201).json({ success: true, message: 'Order placed successfully!', order });
  } catch (error) {
    console.error('Place order error:', error);
    res.status(500).json({ success: false, message: 'Failed to place order.' });
  }
});

// @route  GET /api/orders — current user's orders
router.get('/', async (req, res) => {
  try {
    const orders = await Order.findByUser(req.user.id);
    res.json({ success: true, count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch orders.' });
  }
});

// @route  GET /api/orders/admin/all — admin only (defined before /:id to avoid route clash)
router.get('/admin/all', adminOnly, async (req, res) => {
  try {
    const orders = await Order.findAll();

    // DynamoDB orders only store userId as a plain string (no joins),
    // so we look up each customer and reshape the response for the
    // admin dashboard, which expects _id + a populated userId object.
    const enriched = await Promise.all(
      orders.map(async (o) => {
        const user = await User.findById(o.userId);
        return {
          ...o,
          _id: o.orderId,
          userId: user ? { _id: user.userId, name: user.name, email: user.email } : null,
        };
      })
    );

    res.json({ success: true, count: enriched.length, orders: enriched });
  } catch (error) {
    console.error('Fetch all orders error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders.' });
  }
});

// @route  GET /api/orders/:id
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || order.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    const user = await User.findById(order.userId);
    res.json({
      success: true,
      order: {
        ...order,
        _id: order.orderId,
        userId: user ? { _id: user.userId, name: user.name, email: user.email } : null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch order.' });
  }
});

// @route  PUT /api/orders/:id/status — admin only
router.put('/:id/status', adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }
    const order = await Order.updateStatus(req.params.id, status);
    const user = await User.findById(order.userId);
    res.json({
      success: true,
      message: 'Order status updated.',
      order: {
        ...order,
        _id: order.orderId,
        userId: user ? { _id: user.userId, name: user.name, email: user.email } : null,
      },
    });
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    res.status(500).json({ success: false, message: 'Failed to update order.' });
  }
});

module.exports = router;
