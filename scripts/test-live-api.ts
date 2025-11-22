#!/usr/bin/env tsx
/**
 * Test the live API endpoint to see what's actually happening
 */

async function testLiveAPI() {
  const url = 'https://company-docs-mcp.southleft-llc.workers.dev/ai-chat';
  
  console.log('🧪 Testing Live API\n');
  console.log(`URL: ${url}\n`);
  
  const testMessage = "Where can I find more information on tokens?";
  console.log(`Query: "${testMessage}"\n`);
  
  try {
    console.log('Sending request...');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: testMessage })
    });
    
    console.log(`Status: ${response.status} ${response.statusText}\n`);
    
    const data = await response.json();
    
    if (data.error) {
      console.error('❌ Error:', data.error);
    } else if (data.response) {
      console.log('✅ Response received:\n');
      console.log('─'.repeat(80));
      console.log(data.response);
      console.log('─'.repeat(80));
      
      // Check if it mentions Workday or Canvas
      const hasWorkdayContent = data.response.toLowerCase().includes('workday') || 
                                 data.response.toLowerCase().includes('canvas');
      const hasButtonContent = data.response.toLowerCase().includes('button');
      
      console.log('\n📊 Analysis:');
      console.log(`- Contains Workday/Canvas content: ${hasWorkdayContent ? '✅' : '❌'}`);
      console.log(`- Contains button guidelines: ${hasButtonContent ? '⚠️  YES (fallback)' : '✅ NO'}`);
      console.log(`- Response length: ${data.response.length} characters`);
    } else {
      console.error('❌ Unexpected response format:', data);
    }
  } catch (error: any) {
    console.error('❌ Request failed:', error.message);
  }
}

testLiveAPI().catch(console.error);
