const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

// The EC2 instance role (attached IAM role) supplies credentials automatically.
// No access keys are ever stored in code or .env — this is why the EC2 IAM
// role must have a policy granting access to these 4 tables (see IAM_ROLE_POLICY.md).
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });

const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLES = {
  USERS: process.env.USERS_TABLE || 'Users',
  PRODUCTS: process.env.PRODUCTS_TABLE || 'Products',
  CARTS: process.env.CARTS_TABLE || 'Carts',
  ORDERS: process.env.ORDERS_TABLE || 'Orders',
};

module.exports = { ddb, TABLES };
