require('dotenv').config();
const User = require('./models/User');
const Product = require('./models/Product');

const sampleProducts = [
  { name: 'Pro Laptop 15"', description: 'High-performance laptop with Intel i7, 16GB RAM, 512GB SSD.', price: 999, imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80', category: 'Electronics', stock: 15 },
  { name: 'Wireless Headphones', description: 'Premium noise-cancelling wireless headphones, 30-hour battery.', price: 79, imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80', category: 'Electronics', stock: 40 },
  { name: 'Classic Cotton T-Shirt', description: 'Comfortable everyday t-shirt, 100% organic cotton.', price: 25, imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80', category: 'Clothing', stock: 100 },
  { name: 'Winter Jacket', description: 'Warm, water-resistant winter jacket.', price: 89, imageUrl: 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=600&q=80', category: 'Clothing', stock: 25 },
  { name: 'JavaScript: The Definitive Guide', description: 'Covers ES2020+ features, async programming, modules.', price: 35, imageUrl: 'https://images.unsplash.com/photo-1589998059171-988d887df646?w=600&q=80', category: 'Books', stock: 60 },
  { name: 'AWS Cloud Practitioner Handbook', description: 'Comprehensive guide to Amazon Web Services.', price: 45, imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80', category: 'Books', stock: 35 },
];

const seedDB = async () => {
  try {
    console.log('🌱 Starting DynamoDB seed...\n');

    for (const p of sampleProducts) {
      await Product.create(p);
    }
    console.log(`✅ Seeded ${sampleProducts.length} products`);

    const adminEmail = 'admin@shopwave.com';
    if (!(await User.findByEmail(adminEmail))) {
      await User.create({ name: 'Admin User', email: adminEmail, password: 'admin123', role: 'admin' });
      console.log(`✅ Created admin user: ${adminEmail} / admin123`);
    } else {
      console.log(`ℹ️  Admin user already exists: ${adminEmail}`);
    }

    const testEmail = 'user@shopwave.com';
    if (!(await User.findByEmail(testEmail))) {
      await User.create({ name: 'Test User', email: testEmail, password: 'user123', role: 'user' });
      console.log(`✅ Created test user: ${testEmail} / user123`);
    }

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📋 Test Credentials:');
    console.log('   Admin → admin@shopwave.com / admin123');
    console.log('   User  → user@shopwave.com / user123');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedDB();
