/**
 * Scans all 4 DynamoDB tables (Users, Products, Carts, Orders), converts each
 * to a CSV file, and uploads it to the SAME S3 bucket used for the frontend,
 * under a "db-exports/" prefix — this is the "export the sheet of the
 * database" requirement.
 *
 * Run manually:      node scripts/export-to-csv.js
 * Run on a schedule:  wire this file into a small Lambda (see the guide,
 *                     "DynamoDB CSV Export" section) triggered by
 *                     EventBridge Scheduler, e.g. once a day.
 *
 * The Users table export EXCLUDES the password hash column for safety.
 */
require('dotenv').config();
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { ddb, TABLES } = require('../config/dynamo');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const BUCKET = process.env.FRONTEND_BUCKET; // same bucket used for the S3 static website

const toCSV = (items) => {
  if (!items.length) return '';
  const flatten = (obj) => {
    const flat = {};
    for (const [k, v] of Object.entries(obj)) {
      flat[k] = typeof v === 'object' ? JSON.stringify(v) : v;
    }
    return flat;
  };
  const flatItems = items.map(flatten);
  const headers = [...new Set(flatItems.flatMap((i) => Object.keys(i)))];
  const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const rows = flatItems.map((item) => headers.map((h) => escape(item[h])).join(','));
  return [headers.join(','), ...rows].join('\n');
};

const exportTable = async (tableName, label, excludeFields = []) => {
  const { Items } = await ddb.send(new ScanCommand({ TableName: tableName }));
  const cleaned = (Items || []).map((item) => {
    const copy = { ...item };
    excludeFields.forEach((f) => delete copy[f]);
    return copy;
  });

  const csv = toCSV(cleaned);
  const key = `db-exports/${label}-${new Date().toISOString().slice(0, 10)}.csv`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: csv,
      ContentType: 'text/csv',
    })
  );

  console.log(`✅ Exported ${cleaned.length} rows from ${tableName} -> s3://${BUCKET}/${key}`);
};

const run = async () => {
  if (!BUCKET) {
    console.error('❌ FRONTEND_BUCKET env var not set.');
    process.exit(1);
  }
  await exportTable(TABLES.USERS, 'users', ['password']);
  await exportTable(TABLES.PRODUCTS, 'products');
  await exportTable(TABLES.CARTS, 'carts');
  await exportTable(TABLES.ORDERS, 'orders');
  console.log('\n🎉 All 4 tables exported.');
};

run().catch((err) => {
  console.error('❌ Export failed:', err);
  process.exit(1);
});
