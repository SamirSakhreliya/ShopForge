import axios from 'axios';
import * as dotenv from 'dotenv';
import moment from 'moment';

dotenv.config();

// Step 1: Define the Slack API URL
const SLACK_API_URL: string = process.env.SLACK_URL || '';
const DEFAULT_ENVIRONMENT = process.env.NODE_ENV;

// Step 2: Create a class to handle Slack message construction and sending
class ErrorNotifier {
  // Define some default emojis for different severity levels
  severityLevels = {
    info: ':information_source:',
    warning: ':warning:',
    error: ':x:',
    critical: ':rotating_light:',
  };

  // Step 3: Create a method to build the message body for Slack
  buildMessageBody = ({
    message,
    stack,
    method,
    url,
    body,
    query,
    params,
    code,
    level = 'error',
  }) => {
    const iconEmoji = this.severityLevels[level] || ':grey_question:'; // Use the emoji based on the severity level
    const formattedDetails = stack || 'No additional details provided.';
    const formattedCode = code || 'N/A';
    const formattedMessage = message || 'An unspecified error occurred.';

    // Construct the Slack message body
    const slackBody = {
      username: 'Match-US error', // Name of the "bot" or sender
      //   text: `${iconEmoji} *Error Report*`, // Title with emoji
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${iconEmoji} *Severity Level:* ${
              level?.toUpperCase() || 'Unknown'
            } (${moment().format('DD-MMM-YYYY HH:mm:ss')})`, // Moved the emoji to the block text
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Environment: ${DEFAULT_ENVIRONMENT}`, // You can customize this
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*API:* ${url}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Error Code:* \`${formattedCode}\``, // Error Code on the third line
          },
        },
        { type: 'divider' },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `method: ${method}`, // You can customize this
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `body: ${JSON.stringify(body)}`, // You can customize this
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `query: ${JSON.stringify(query)}`, // You can customize this
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `params: ${JSON.stringify(params)}`, // You can customize this
            },
          ],
        },

        { type: 'divider' },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Error Message:* ${formattedMessage}`, // Error message and details on the fourth line
          },
        },
        { type: 'divider' },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Error Stack:\n ${formattedDetails}`, // You can customize this
            },
          ],
        },
        { type: 'divider' },
      ],
    };
    return slackBody;
  };

  // Step 4: Method to send the constructed message to Slack
  async sendNotification(errorDetails) {
    try {
      const messageBody = this.buildMessageBody(errorDetails);
      const response = await axios.post(SLACK_API_URL, messageBody, {
        headers: { 'Content-Type': 'application/json' },
      });
      // console.log("🚀 ~ ErrorNotifier ~ sendNotification ~ response:", response)
      return response;
    } catch (error) {
      console.error('Error sending Slack notification:', error);
    }
  }
}

// Step 5: Create an instance of the notifier and send a sample error message
export const errorNotifier = new ErrorNotifier();
