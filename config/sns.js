const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const sns = new SNSClient({ region: process.env.AWS_REGION || 'ap-south-1' });

// Publishes to the "purchase" SNS topic (Topic 2 in the project spec).
// Fails silently (logs only) so a notification hiccup never blocks a checkout.
const publishPurchaseEvent = async (order, user) => {
  const topicArn = process.env.SNS_PURCHASE_TOPIC_ARN;
  if (!topicArn) return;

  const message = {
    orderId: order.orderId,
    customer: user?.email || order.userId,
    totalAmount: order.totalAmount,
    itemCount: order.items.length,
    status: order.status,
    time: order.createdAt,
  };

  try {
    await sns.send(
      new PublishCommand({
        TopicArn: topicArn,
        Subject: `New order placed: $${order.totalAmount}`,
        Message: JSON.stringify(message, null, 2),
      })
    );
  } catch (error) {
    console.error('SNS publish (purchase) failed:', error.message);
  }
};

module.exports = { publishPurchaseEvent };
