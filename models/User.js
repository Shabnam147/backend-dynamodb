const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { GetCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ddb, TABLES } = require('../config/dynamo');

// Table schema:
//   Partition key: userId (String)
//   GSI: email-index -> partition key: email  (used for login/duplicate-check lookups)

const findById = async (userId) => {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLES.USERS, Key: { userId } }));
  return Item || null;
};

const findByEmail = async (email) => {
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: TABLES.USERS,
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :e',
      ExpressionAttributeValues: { ':e': email.toLowerCase() },
    })
  );
  return Items && Items.length ? Items[0] : null;
};

const create = async ({ name, email, password, role = 'user' }) => {
  const existing = await findByEmail(email);
  if (existing) {
    const err = new Error('An account with this email already exists.');
    err.code = 'DUPLICATE_EMAIL';
    throw err;
  }

  const hashed = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();

  const user = {
    userId: uuidv4(),
    name,
    email: email.toLowerCase(),
    password: hashed,
    role,
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(new PutCommand({ TableName: TABLES.USERS, Item: user }));
  return user;
};

const matchPassword = async (enteredPassword, hashedPassword) =>
  bcrypt.compare(enteredPassword, hashedPassword);

const sanitize = (user) => {
  if (!user) return null;
  const { password, ...safe } = user;
  return { id: safe.userId, ...safe };
};

module.exports = { findById, findByEmail, create, matchPassword, sanitize };
