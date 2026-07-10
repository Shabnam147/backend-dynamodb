const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

// Pulls JWT_SECRET (and anything else you add) from AWS Secrets Manager at
// startup, instead of keeping it in a plaintext .env file on the EC2 disk.
// The secret name is passed in as an env var set by the EC2 launch template
// user-data script (SECRET_NAME), not the secret itself.
const loadSecrets = async () => {
  const secretName = process.env.SECRET_NAME;
  if (!secretName) {
    console.warn('⚠️  SECRET_NAME not set — falling back to local .env values.');
    return;
  }

  const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'ap-south-1' });

  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
    const secret = JSON.parse(response.SecretString);

    // Merge every key in the secret into process.env
    for (const [key, value] of Object.entries(secret)) {
      process.env[key] = value;
    }
    console.log('✅ Secrets loaded from Secrets Manager:', secretName);
  } catch (error) {
    console.error('❌ Failed to load secrets from Secrets Manager:', error.message);
    process.exit(1);
  }
};

module.exports = loadSecrets;
