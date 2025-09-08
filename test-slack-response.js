import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function testSlackResponse() {
  const query = "tell me about theming";
  
  // Create form data similar to what Slack sends
  const formData = new URLSearchParams();
  formData.append('token', 'test');
  formData.append('team_id', 'test');
  formData.append('channel_id', 'test');
  formData.append('user_id', 'test');
  formData.append('user_name', 'test');
  formData.append('command', '/docs');
  formData.append('text', query);
  formData.append('response_url', 'https://hooks.slack.com/test');
  formData.append('trigger_id', 'test');

  try {
    console.log('Testing Slack webhook with query:', query);
    console.log('Endpoint: https://company-docs-mcp.southleft-llc.workers.dev/slack');
    
    const response = await fetch('https://company-docs-mcp.southleft-llc.workers.dev/slack', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Slack-Signature': 'v0=test',
        'X-Slack-Request-Timestamp': Math.floor(Date.now() / 1000).toString()
      },
      body: formData.toString()
    });

    if (!response.ok) {
      console.error('Response status:', response.status);
      const text = await response.text();
      console.error('Error response:', text);
      return;
    }

    const resultText = await response.text();
    console.log('\n=== IMMEDIATE RESPONSE (RAW) ===');
    console.log(resultText);
    
    try {
      const result = JSON.parse(resultText);
      console.log('\n=== IMMEDIATE RESPONSE (PARSED) ===');
      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('Could not parse as JSON');
    }
    
    // The actual response will be sent to the response_url
    // In production, Slack would receive this as a follow-up message
    console.log('\n=== NOTE ===');
    console.log('The full response would be sent to the response_url asynchronously.');
    console.log('In production, Slack displays this as a follow-up message.');
    
  } catch (error) {
    console.error('Error testing Slack response:', error);
  }
}

testSlackResponse();