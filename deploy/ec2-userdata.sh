#!/bin/bash
# ============================================================================
# Run this ONCE on a clean EC2 instance (Amazon Linux 2023) BEFORE you create
# the AMI. It installs Node.js, PM2, the CloudWatch agent, clones the backend
# code, and sets up the systemd/PM2 service. The AMI you create from this
# instance is what the Launch Template will use for every future instance.
# ============================================================================
set -e

# 1. Update OS packages
sudo dnf update -y

# 2. Install Node.js 20.x
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs git

# 3. Install PM2 process manager globally
sudo npm install -g pm2

# 4. Install the CloudWatch agent (for custom app logs + memory/disk metrics)
sudo dnf install -y amazon-cloudwatch-agent

# 5. Clone your backend code (replace with your real repo / or upload via S3)
sudo mkdir -p /opt/shopwave
sudo chown ec2-user:ec2-user /opt/shopwave
cd /opt/shopwave
git clone https://github.com/Shabnam147/project-backend.git app
# NOTE: after you push the rewritten DynamoDB version of this code to your
# own GitHub repo, change the URL above to point at that repo instead.
cd app
npm install --production

# 6. Create the .env file. Static, non-secret values only — JWT_SECRET is
#    pulled at runtime from Secrets Manager by config/secrets.js, so it is
#    never written to disk here.
cat > .env << 'EOF'
NODE_ENV=production
PORT=5000
AWS_REGION=ap-south-1
USERS_TABLE=Users
PRODUCTS_TABLE=Products
CARTS_TABLE=Carts
ORDERS_TABLE=Orders
SECRET_NAME=shopwave/backend
SNS_PURCHASE_TOPIC_ARN=REPLACE_WITH_YOUR_PURCHASE_TOPIC_ARN
FRONTEND_BUCKET=REPLACE_WITH_YOUR_FRONTEND_BUCKET_NAME
EOF

# 7. Start the app with PM2 and make PM2 survive reboots
pm2 start ecosystem.config.js
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user

echo "Bootstrap complete. Test with: curl http://localhost:5000/api/health"
echo "Now: stop the instance in the console, then Actions > Image > Create Image to bake the AMI."
