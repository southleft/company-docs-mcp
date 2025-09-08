#!/usr/bin/env node

// Test script to simulate the frontend chat behavior
import fetch from 'node-fetch';
import AbortController from 'abort-controller';

async function testChatFlow() {
    console.log('🧪 Testing frontend chat flow...');
    
    try {
        // Step 1: Check health endpoint (like the frontend does)
        console.log('\n1️⃣ Checking health endpoint...');
        const healthResponse = await fetch('http://localhost:8787/health');
        const healthData = await healthResponse.json();
        console.log('✅ Health check:', healthData);
        
        // Step 2: Test the AI chat endpoint (main functionality)
        console.log('\n2️⃣ Testing AI chat with the exact message from issue...');
        const message = "To assist you with accessible button implementation in Workday CanvasKit";
        
        // Add thinking message simulation
        console.log('💭 Thinking: Analyzing your question and searching the knowledge base...');
        
        const startTime = Date.now();
        
        // Create timeout controller like the frontend
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
            console.log('⏱️ Request aborted after 45 seconds');
        }, 45000);
        
        const response = await fetch('http://localhost:8787/ai-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const endTime = Date.now();
        
        console.log(`⏰ Request took ${endTime - startTime}ms`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        console.log('\n3️⃣ Response received:');
        if (data.error) {
            console.log('❌ Error:', data.error);
        } else {
            console.log('✅ Success! Response length:', data.response?.length || 0);
            console.log('📝 First 200 characters:', data.response?.substring(0, 200) + '...');
        }
        
    } catch (error) {
        console.log('\n❌ Test failed:', error.message);
        
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
            console.log('⏱️ Request timed out after 45 seconds');
        } else if (error.message.includes('ECONNREFUSED')) {
            console.log('🌐 Connection refused - server might not be running');
        }
    }
}

// Run the test
testChatFlow().catch(console.error);