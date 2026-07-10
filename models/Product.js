const { v4: uuidv4 } = require('uuid');
const { GetCommand, PutCommand, DeleteCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { ddb, TABLES } = require('../config/dynamo');

// Table schema:
//   Partition key: productId (String)
//   GSI: category-index -> partition key: category (used for category filter, optional)
// Catalog sizes for a student/demo project are small, so a Scan+filter for
// search/sort/pagination is acceptable. For production scale you would move
// search to OpenSearch/Algolia instead of scanning DynamoDB.

const findById = async (productId) => {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLES.PRODUCTS, Key: { productId } }));
  return Item || null;
};

const findAll = async ({ search, category, sort, page = 1, limit = 20 } = {}) => {
  const { Items } = await ddb.send(new ScanCommand({ TableName: TABLES.PRODUCTS }));
  let products = Items || [];

  if (category) {
    products = products.filter((p) => p.category === category);
  }

  if (search) {
    const s = search.toLowerCase();
    products = products.filter(
      (p) =>
        p.name?.toLowerCase().includes(s) ||
        p.description?.toLowerCase().includes(s) ||
        p.category?.toLowerCase().includes(s)
    );
  }

  if (sort === 'price_asc') products.sort((a, b) => a.price - b.price);
  else if (sort === 'price_desc') products.sort((a, b) => b.price - a.price);
  else if (sort === 'name') products.sort((a, b) => a.name.localeCompare(b.name));
  else products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = products.length;
  const start = (parseInt(page) - 1) * parseInt(limit);
  const paged = products.slice(start, start + parseInt(limit));

  return { products: paged, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) };
};

const create = async (data) => {
  const now = new Date().toISOString();
  const product = {
    productId: uuidv4(),
    name: data.name,
    description: data.description || '',
    price: Number(data.price),
    imageUrl: data.imageUrl || 'https://via.placeholder.com/400x300?text=Product+Image',
    category: data.category || 'Other',
    stock: data.stock != null ? Number(data.stock) : 0,
    createdAt: now,
    updatedAt: now,
  };
  await ddb.send(new PutCommand({ TableName: TABLES.PRODUCTS, Item: product }));
  return product;
};

const updateById = async (productId, updates) => {
  const existing = await findById(productId);
  if (!existing) return null;

  const updated = { ...existing, ...updates, productId, updatedAt: new Date().toISOString() };
  await ddb.send(new PutCommand({ TableName: TABLES.PRODUCTS, Item: updated }));
  return updated;
};

const decrementStock = async (productId, quantity) => {
  await ddb.send(
    new UpdateCommand({
      TableName: TABLES.PRODUCTS,
      Key: { productId },
      UpdateExpression: 'SET stock = stock - :q',
      ExpressionAttributeValues: { ':q': quantity },
    })
  );
};

const deleteById = async (productId) => {
  const existing = await findById(productId);
  if (!existing) return null;
  await ddb.send(new DeleteCommand({ TableName: TABLES.PRODUCTS, Key: { productId } }));
  return existing;
};

module.exports = { findById, findAll, create, updateById, decrementStock, deleteById };
