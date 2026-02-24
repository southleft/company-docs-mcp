/**
 * Chat UI HTML Template
 *
 * Generates the inline React chat interface served at / and /chat.
 * Extracted from the monolithic index.ts to keep the router thin.
 */

import type { Env } from "./tools";

export function getChatHtml(env: Env): string {
  const orgName = env.ORGANIZATION_NAME || "Organization";
  const orgDomain = env.ORGANIZATION_DOMAIN || "example.com";
  const orgLogo =
    env.ORGANIZATION_LOGO_URL ||
    "https://p198.p4.n0.cdn.zight.com/items/4guEeYlX/50dfc8bb-d31c-4a22-81ab-cee7ed5a5c18.png";
  const orgTagline =
    env.ORGANIZATION_TAGLINE ||
    "Get instant answers from our comprehensive documentation. Ask about APIs, components, patterns, and best practices.";
  const orgSubtitle =
    env.ORGANIZATION_SUBTITLE || "Powered by MCP (Model Context Protocol)";

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${orgName} Documentation Assistant</title>
    <meta name="description" content="MCP (Model Context Protocol) server with ${orgName} documentation. Search through curated resources to get expert answers.">

    <!-- Favicon -->
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1080 482'%3E%3Cstyle%3E.st1%7Bfill:%23333333%7D@media (prefers-color-scheme:dark)%7B.st1%7Bfill:%23ffffff%7D%7D%3C/style%3E%3Cpath class='st1' d='M439.7 462.3c-12 0-22.1 4.8-30.1 16.8l-32.7-192.9 2.6-1.4C422.9 351 490.5 392 549.4 392c42.9 0 71-17.4 71-46.9 0-30.1-39.5-44.9-102.3-66.3-59.6-21.4-133.2-54.3-133.2-140.8 0-77.7 71-138 170-138 54.9 0 81 15.4 99.7 15.4 10.8 0 18.1-3.4 25.4-12.8l21.4 170.7-2.6 1.4c-32.1-54.3-86.4-85.7-142.5-85.7-44.1 0-73.6 20.2-73.6 46.9 0 30.2 38.9 42.9 79.6 58.9 70.2 24.2 158 57.5 157.2 148.8 0 80.3-70.2 138.6-164 138.6C497.9 482.2 460.4 462.3 439.7 462.3z'/%3E%3Cpath class='st1' d='M831.5 2.5l126.3 236.7L830.4 477.9h124.2L1080 239.2 956.8 2.5H831.5z'/%3E%3Cpath class='st1' d='M125.4 2.5L0 241.2l123.2 236.7h125.2L122.2 241.2 249.6 2.5H125.4z'/%3E%3C/svg%3E">

    <!-- Open Graph / Social Media Meta Tags -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="${orgName} Documentation Assistant">
    <meta property="og:description" content="MCP server with ${orgName} documentation and curated resources.">
    <meta property="og:url" content="${orgDomain}">
    <meta property="og:image" content="${orgDomain}/og-image.png">
    <meta property="og:image:width" content="900">
    <meta property="og:image:height" content="630">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${orgName} Documentation">
    <meta name="twitter:description" content="MCP server with ${orgName} documentation and curated resources">
    <meta name="twitter:image" content="${orgDomain}/og-image.png">

    <!-- Additional Meta -->
    <meta name="theme-color" content="#339af0">
    <meta name="author" content="Southleft">
    <link rel="canonical" href="${orgDomain}">

    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            margin: 0;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        }
        #root {
            min-height: 100vh;
        }
        .loader-container {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #1a1b1e;
            color: #c1c2c5;
            z-index: 9999;
        }
        .loader {
            display: inline-block;
            width: 24px;
            height: 24px;
            border: 3px solid #495057;
            border-radius: 50%;
            border-top-color: #339af0;
            animation: spin 1s ease-in-out infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div id="loader" class="loader-container">
        <div style="text-align: center;">
            <div class="loader"></div>
            <div style="margin-top: 16px; font-size: 14px;">Loading Documentation Chat...</div>
        </div>
    </div>
    <div id="root"></div>

    <!-- React and ReactDOM -->
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>

    <!-- Babel Standalone for JSX -->
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

    <!-- Marked for markdown parsing - preload for better performance -->
    <link rel="preload" href="https://cdn.jsdelivr.net/npm/marked/marked.min.js" as="script">
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

    <script type="text/babel">
        // Configure marked for better rendering
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: false,
            mangle: false
        });

        const { useState, useEffect, useRef } = React;
        const { createRoot } = ReactDOM;

        // Set dark theme on document immediately (not in useEffect)
        document.documentElement.setAttribute('data-color-scheme', 'dark');

        const Container = ({ children, size = 'lg', style = {} }) => (
            <div style={{
                maxWidth: size === 'lg' ? '900px' : '100%',
                margin: '0 auto',
                padding: '0 16px',
                width: '100%',
                ...style
            }}>
                {children}
            </div>
        );

        const Stack = ({ children, gap = 'md', style = {} }) => (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: gap === 'md' ? '16px' : gap === 'lg' ? '24px' : gap === 'sm' ? '8px' : gap,
                ...style
            }}>
                {children}
            </div>
        );

        const Group = ({ children, justify = 'flex-start', align = 'center', gap = 'md', style = {} }) => (
            <div style={{
                display: 'flex',
                justifyContent: justify,
                alignItems: align,
                gap: gap === 'md' ? '16px' : gap === 'lg' ? '24px' : gap === 'sm' ? '8px' : gap,
                flexWrap: 'wrap',
                ...style
            }}>
                {children}
            </div>
        );

        const Card = ({ children, padding = 'md', radius = 'md', withBorder = true, style = {} }) => (
            <div style={{
                background: '#25262b',
                border: withBorder ? '1px solid #373a40' : 'none',
                borderRadius: radius === 'md' ? '8px' : radius === 'lg' ? '12px' : radius,
                padding: padding === 'md' ? '16px' : padding === 'lg' ? '24px' : padding,
                ...style
            }}>
                {children}
            </div>
        );

        const Title = ({ children, order = 1, style = {} }) => {
            const Tag = ${'`h${order}`'};
            const fontSize = order === 1 ? '32px' : order === 2 ? '24px' : order === 3 ? '20px' : '16px';
            return (
                <Tag style={{
                    color: '#c1c2c5',
                    margin: 0,
                    fontSize,
                    fontWeight: order <= 2 ? '700' : '600',
                    ...style
                }}>
                    {children}
                </Tag>
            );
        };

        const Text = ({ children, size = 'sm', c = '#909296', fw, style = {} }) => (
            <p style={{
                color: c,
                margin: 0,
                fontSize: size === 'sm' ? '14px' : size === 'md' ? '16px' : size === 'lg' ? '18px' : size,
                fontWeight: fw || 'normal',
                ...style
            }}>
                {children}
            </p>
        );

        const Button = ({ children, variant = 'filled', size = 'md', leftSection, rightSection, loading, disabled, onClick, style = {} }) => {
            const baseStyle = {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: size === 'md' ? '10px 16px' : '8px 12px',
                border: 'none',
                borderRadius: '6px',
                cursor: disabled || loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit',
                opacity: disabled || loading ? 0.6 : 1,
                ...style
            };

            const variantStyles = {
                filled: {
                    background: 'linear-gradient(135deg, #339af0 0%, #1c7ed6 100%)',
                    color: 'white',
                },
                light: {
                    background: '#1e3a5f',
                    color: '#339af0',
                },
                outline: {
                    background: 'transparent',
                    color: '#339af0',
                    border: '1px solid #339af0',
                }
            };

            return (
                <button
                    style={{ ...baseStyle, ...variantStyles[variant] }}
                    onClick={disabled || loading ? undefined : onClick}
                    disabled={disabled || loading}
                >
                    {loading && <div className="loader" style={{width: '16px', height: '16px'}}></div>}
                    {leftSection}
                    {children}
                    {rightSection}
                </button>
            );
        };

        const Textarea = ({ placeholder, value, onChange, onKeyDown, rows = 3, style = {} }) => (
            <textarea
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                rows={rows}
                style={{
                    width: '100%',
                    background: '#1a1b1e',
                    border: '1px solid #373a40',
                    borderRadius: '6px',
                    padding: '12px',
                    color: '#c1c2c5',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    minHeight: '26px',
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                    ...style
                }}
                onFocus={(e) => e.target.style.borderColor = '#339af0'}
                onBlur={(e) => e.target.style.borderColor = '#373a40'}
            />
        );

        const Badge = ({ children, variant = 'light', color = 'blue', size = 'sm', style = {}, title = '' }) => {
            const getColors = () => {
                if (color === 'green') return { bg: '#2f5233', text: '#51cf66' };
                if (color === 'red') return { bg: '#5f2f2f', text: '#ff6b6b' };
                if (color === 'yellow') return { bg: '#5f4f2f', text: '#ffd43b' };
                return { bg: '#1e3a5f', text: '#339af0' };
            };

            const colors = getColors();

            return (
                <span style={{
                    display: 'inline-block',
                    padding: size === 'sm' ? '4px 8px' : '6px 12px',
                    backgroundColor: colors.bg,
                    color: colors.text,
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '500',
                    ...style
                }} title={title}>
                    {children}
                </span>
            );
        };

        const ScrollArea = ({ children, style = {} }) => (
            <div style={{
                overflow: 'auto',
                ...style
            }}>
                {children}
            </div>
        );

        // Example questions data
        const EXAMPLE_QUESTIONS = [
            { icon: '\\u2753', text: 'Overview' },
            { icon: '\\ud83d\\ude80', text: 'Getting Started' },
            { icon: '\\ud83c\\udfa8', text: 'Theming' },
            { icon: '\\ud83e\\udde9', text: 'Tokens' },
            { icon: '\\ud83e\\udd1d', text: 'Support' }
        ];

        // Chat App Component
        function ChatApp() {
            const [messages, setMessages] = useState([{
                type: 'system',
                content: '\\ud83c\\udfaf Welcome! I\\'m your AI documentation assistant for ${orgName}. I can search through the knowledge base and provide expert answers.\\n\\n\\ud83d\\udca1 Ask me anything about our documentation and processes!'
            }]);
            const [inputValue, setInputValue] = useState('');
            const [isLoading, setIsLoading] = useState(false);
            const [serviceStatus, setServiceStatus] = useState('checking'); // 'online', 'offline', 'checking'
            const messagesEndRef = useRef(null);
            const textareaRef = useRef(null);
            const textareaRef2 = useRef(null);

            // Set dark theme on document
            useEffect(() => {
                document.documentElement.setAttribute('data-color-scheme', 'dark');
            }, []);

            const scrollToBottom = () => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            };

            useEffect(() => {
                scrollToBottom();
            }, [messages]);

            // Check service health on mount and periodically
            useEffect(() => {
                const checkHealth = async () => {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 5000);

                        const response = await fetch('/health', {
                            method: 'GET',
                            signal: controller.signal
                        });

                        clearTimeout(timeoutId);

                        if (response.ok) {
                            const data = await response.json();
                            setServiceStatus(data.status === 'ok' ? 'online' : 'offline');
                        } else {
                            setServiceStatus('offline');
                        }
                    } catch (error) {
                        setServiceStatus('offline');
                    }
                };

                // Check immediately
                checkHealth();

                // Check every 30 seconds
                const interval = setInterval(checkHealth, 30000);

                return () => clearInterval(interval);
            }, []);

            // Auto-resize textareas
            const autoResizeTextarea = (textarea) => {
                if (textarea) {
                    textarea.style.height = 'auto';
                    const newHeight = Math.min(textarea.scrollHeight, 200);
                    textarea.style.height = newHeight - 22 + 'px';
                }
            };

            useEffect(() => {
                autoResizeTextarea(textareaRef.current);
                autoResizeTextarea(textareaRef2.current);
            }, [inputValue]);

            // Add input handler for real-time resizing
            const handleTextareaInput = (e) => {
                setInputValue(e.target.value);
                autoResizeTextarea(e.target);
            };

            const addMessage = (type, content) => {
                setMessages(prev => [...prev, { type, content, id: Date.now() }]);
            };

            const askQuestion = (question) => {
                setInputValue(question);
                setTimeout(() => sendMessage(question), 100);
            };

            const sendMessage = async (messageText = inputValue) => {
                const message = messageText.trim();
                if (!message) return;

                addMessage('user', message);
                setInputValue('');
                setIsLoading(true);

                // Add thinking message
                const thinkingId = Date.now();
                addMessage('thinking', 'Analyzing your question and searching the knowledge base...');

                try {
                    // Add client-side timeout (45 seconds total, matching server timeout)
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => {
                        controller.abort();
                    }, 45000); // 45 second timeout (matching server timeout)

                    const response = await fetch('/ai-chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message }),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        // Remove thinking message before throwing
                        setMessages(prev => prev.filter(msg => msg.type !== 'thinking'));
                        throw new Error(${'`HTTP ${response.status}: ${response.statusText}`'});
                    }

                    const data = await response.json();
                    console.log('[Chat] API Response received:', {
                        hasError: !!data.error,
                        hasResponse: !!data.response,
                        responseLength: data.response?.length || 0,
                        searchResults: data.searchResults || 0,
                        timestamp: new Date().toISOString()
                    });

                    // Remove thinking message and add response in a single state update
                    if (data.error) {
                        console.error('API returned error:', data.error);
                        setMessages(prev => {
                            const filtered = prev.filter(msg => msg.type !== 'thinking');
                            return [...filtered, { type: 'error', content: ${'`\\u274c ${data.error}`'}, id: Date.now() }];
                        });
                    } else if (data.response) {
                        console.log('[Chat] Adding assistant response to UI, length:', data.response.length);
                        setMessages(prev => {
                            const filtered = prev.filter(msg => msg.type !== 'thinking');
                            return [...filtered, { type: 'assistant', content: data.response, id: Date.now() }];
                        });
                        setIsLoading(false); // Ensure loading state is cleared
                    } else {
                        console.error('Unexpected response structure:', data);
                        setMessages(prev => {
                            const filtered = prev.filter(msg => msg.type !== 'thinking');
                            return [...filtered, { type: 'error', content: '\\u274c Invalid response from server - check console for details', id: Date.now() }];
                        });
                    }
                } catch (error) {
                    setMessages(prev => prev.filter(msg => msg.type !== 'thinking'));

                    let errorMessage = error.message;
                    if (error.name === 'AbortError' || error.message.includes('aborted')) {
                        errorMessage = '\\u23f1\\ufe0f Request timed out after 45 seconds. This can happen with complex questions. Try breaking your question into smaller parts or asking something more specific.';
                    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                        errorMessage = '\\ud83c\\udf10 Network error. Please check your internet connection and try again.';
                    } else if (error.message.includes('timeout')) {
                        errorMessage = '\\u23f1\\ufe0f The request took too long to process. Try asking a more specific question or try again later.';
                    }

                    addMessage('error', ${'`\\u274c Error: ${errorMessage}`'});
                } finally {
                    setIsLoading(false);
                }
            };

            const handleKeyPress = (event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                }
            };

            const MessageComponent = ({ message }) => {
                const getMessageStyle = (type) => {
                    const base = {
                        padding: '16px 24px',
                        marginBottom: '16px',
                        lineHeight: '1.6',
                        fontSize: '16px'
                    };

                    switch (type) {
                        case 'user':
                            return {
                                ...base,
                                background: '#2c2e33',
                                color: '#c1c2c5',
                                borderRadius: '12px',
                                maxWidth: '85%',
                                marginLeft: 'auto',
                                marginRight: '0'
                            };
                        case 'assistant':
                            return {
                                ...base,
                                background: '#25262b',
                                color: '#c1c2c5',
                                borderRadius: '12px',
                                maxWidth: '85%',
                                marginLeft: '0',
                                marginRight: 'auto'
                            };
                        case 'thinking':
                            return {
                                ...base,
                                background: '#25262b',
                                color: '#909296',
                                border: '1px solid #373a40',
                                fontStyle: 'normal',
                                borderRadius: '12px',
                                maxWidth: '100%',
                                marginLeft: '0',
                                marginRight: '0'
                            };
                        case 'error':
                            return {
                                ...base,
                                background: '#2d0e0e',
                                color: '#ff6b6b',
                                border: '1px solid #e03131',
                                borderRadius: '8px',
                                maxWidth: '85%',
                                marginLeft: '0',
                                marginRight: 'auto'
                            };
                        default:
                            return base;
                    }
                };

                const renderContent = (content, type) => {
                    if (type === 'assistant') {
                        return { __html: marked.parse(content) };
                    }
                    if (type === 'thinking') {
                        return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ display: 'flex', gap: '3px' }}>
                                    <span style={{
                                        width: '6px', height: '6px', background: '#339af0', borderRadius: '50%',
                                        animation: 'thinking 1.5s ease-in-out infinite'
                                    }}></span>
                                    <span style={{
                                        width: '6px', height: '6px', background: '#339af0', borderRadius: '50%',
                                        animation: 'thinking 1.5s ease-in-out infinite 0.2s'
                                    }}></span>
                                    <span style={{
                                        width: '6px', height: '6px', background: '#339af0', borderRadius: '50%',
                                        animation: 'thinking 1.5s ease-in-out infinite 0.4s'
                                    }}></span>
                                </div>
                                {content}
                            </div>
                        );
                    }
                    return content;
                };

                // Don't render system messages in conversation view
                if (message.type === 'system') {
                    return null;
                }

                return (
                    <div style={{
                        maxWidth: '768px',
                        margin: '0 auto',
                        width: '100%',
                        padding: '0 24px'
                    }}>
                        <div style={getMessageStyle(message.type)}>
                            {message.type === 'assistant' ? (
                                <div className="message-content" dangerouslySetInnerHTML={renderContent(message.content, message.type)} />
                            ) : (
                                renderContent(message.content, message.type)
                            )}
                        </div>
                    </div>
                );
            };

            return (
                <div style={{
                    minHeight: '100vh',
                    background: '#1a1b1e',
                    color: '#c1c2c5',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <Container size="lg" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0' }}>
                        {/* Floating Header */}
                        <div style={{
                            background: '#25262b',
                            border: '1px solid #373a40',
                            borderRadius: '0 0 16px 16px',
                            padding: '16px 24px',
                            position: 'sticky',
                            top: 0,
                            zIndex: 100,
                            margin: '0 16px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                        }}>
                            <Group justify="space-between" align="center">
                                <div>
                                    <Title order={3} style={{ color: '#c1c2c5', marginBottom: '2px', fontWeight: '600' }}>
                                        ${orgName} Documentation
                                    </Title>
                                    <Text size="sm" style={{ color: '#909296' }}>
                                        ${orgSubtitle}
                                    </Text>
                                </div>
                                <Badge
                                    variant="light"
                                    color={serviceStatus === 'online' ? 'green' : serviceStatus === 'checking' ? 'yellow' : 'red'}
                                    size="sm"
                                    style={{
                                        cursor: 'default',
                                        transition: 'all 0.3s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                    title={serviceStatus === 'online' ? 'Service is operational' : serviceStatus === 'checking' ? 'Checking connection...' : 'Service unavailable - check your connection'}
                                >
                                    <span style={{
                                        display: 'inline-block',
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        backgroundColor: serviceStatus === 'online' ? '#51cf66' : serviceStatus === 'checking' ? '#ffd43b' : '#ff6b6b',
                                        animation: serviceStatus === 'checking' ? 'pulse 2s infinite' : 'none'
                                    }}></span>
                                    {serviceStatus === 'online' ? 'Online' : serviceStatus === 'checking' ? 'Checking...' : 'Offline'}
                                </Badge>
                            </Group>
                        </div>

                        {/* Messages Area */}
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '0 24px'
                        }}>
                            <ScrollArea style={{ flex: 1 }}>
                                {messages.filter(msg => msg.type !== 'system').length === 0 ? (
                                    // Welcome screen when no messages - centered like ChatGPT
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: 'calc(100vh - 220px)',
                                        textAlign: 'center',
                                    }}>
                                        {/* Organization Logo with MCP fallback */}
                                        <div style={{ marginBottom: '32px' }}>
                                            <img
                                                src="${orgLogo}"
                                                alt="${orgName} Logo"
                                                style={{
                                                    maxHeight: '120px',
                                                    maxWidth: '300px',
                                                    height: 'auto',
                                                    width: 'auto',
                                                    objectFit: 'contain'
                                                }}
                                            />
                                        </div>

                                        {/* Elegant centered title */}
                                        <div style={{ marginBottom: '48px' }}>
                                            <Title
                                                order={1}
                                                style={{
                                                    color: '#c1c2c5',
                                                    marginBottom: '16px',
                                                    fontSize: '48px',
                                                    fontWeight: '300',
                                                    letterSpacing: '-0.02em'
                                                }}
                                            >
                                                ${orgName} Documentation
                                            </Title>
                                            <Text
                                                style={{
                                                    color: '#909296',
                                                    fontSize: '18px',
                                                    fontWeight: '400',
                                                    maxWidth: '600px',
                                                    lineHeight: '1.5',
                                                    margin: '0 auto'
                                                }}
                                            >
                                                ${orgTagline}
                                            </Text>
                                        </div>

                                        {/* Centered input area */}
                                        <div style={{
                                            width: '100%',
                                            maxWidth: '768px',
                                            marginBottom: '32px'
                                        }}>
                                            <div style={{
                                                background: '#25262b',
                                                border: '1px solid #373a40',
                                                borderRadius: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '0',
                                                transition: 'border-color 0.2s ease'
                                            }}
                                            onFocus={(e) => e.currentTarget.style.borderColor = '#339af0'}
                                            onBlur={(e) => e.currentTarget.style.borderColor = '#373a40'}
                                            >
                                                <textarea
                                                    ref={textareaRef}
                                                    placeholder="Ask me anything about our documentation..."
                                                    value={inputValue}
                                                    onChange={(e) => handleTextareaInput(e)}
                                                    onKeyDown={handleKeyPress}
                                                    rows={1}
                                                    style={{
                                                        flex: 1,
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: '#c1c2c5',
                                                        fontSize: '16px',
                                                        fontFamily: 'inherit',
                                                        resize: 'none',
                                                        outline: 'none',
                                                        padding: '12px 16px',
                                                        lineHeight: '1.5',
                                                        maxHeight: '200px',
                                                        overflowY: 'auto'
                                                    }}
                                                    disabled={isLoading}
                                                    onFocus={(e) => {
                                                        e.target.parentElement.style.borderColor = '#339af0';
                                                    }}
                                                    onBlur={(e) => {
                                                        e.target.parentElement.style.borderColor = '#373a40';
                                                    }}
                                                />
                                                <button
                                                    onClick={() => sendMessage()}
                                                    disabled={!inputValue.trim() || isLoading}
                                                    style={{
                                                        background: inputValue.trim() && !isLoading
                                                            ? '#339af0'
                                                            : '#373a40',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        padding: '8px',
                                                        margin: '8px',
                                                        cursor: inputValue.trim() && !isLoading ? 'pointer' : 'not-allowed',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        transition: 'all 0.2s ease',
                                                        minWidth: '32px',
                                                        height: '32px'
                                                    }}
                                                >
                                                    {isLoading ? (
                                                        <div style={{
                                                            width: '16px',
                                                            height: '16px',
                                                            border: '2px solid #ffffff40',
                                                            borderTop: '2px solid #ffffff',
                                                            borderRadius: '50%',
                                                            animation: 'spin 1s linear infinite'
                                                        }} />
                                                    ) : (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{
                                                            color: inputValue.trim() ? 'white' : '#909296'
                                                        }}>
                                                            <path
                                                                d="M7 11L12 6L17 11M12 18V7"
                                                                stroke="currentColor"
                                                                strokeWidth="2"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                transform="rotate(90 12 12)"
                                                            />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Topic suggestions below input */}
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '8px',
                                            justifyContent: 'center',
                                            maxWidth: '768px',
                                            marginBottom: '32px'
                                        }}>
                                                                                    {EXAMPLE_QUESTIONS.map((item, index) => (
                                                <button
                                                    key={index}
                                                    style={{
                                                        padding: '8px 16px',
                                                        background: 'transparent',
                                                        border: '1px solid #373a40',
                                                        borderRadius: '20px',
                                                        cursor: 'pointer',
                                                        fontSize: '14px',
                                                        color: '#909296',
                                                        transition: 'all 0.2s ease',
                                                        fontFamily: 'inherit',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.target.style.borderColor = '#339af0';
                                                        e.target.style.color = '#339af0';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.target.style.borderColor = '#373a40';
                                                        e.target.style.color = '#909296';
                                                    }}
                                                    onClick={() => {
                                                        const queries = {
                                                            'Overview': 'What documentation is available?',
                                                            'Getting Started': 'How do I get started?',
                                                            'Theming': 'Tell me about theming',
                                                            'Tokens': 'Where can I find more information on tokens?',
                                                            'Support': 'How do I get support?'
                                                        };
                                                        askQuestion(queries[item.text] || item.text);
                                                    }}
                                                >
                                                    <span>{item.icon}</span>
                                                    <span>{item.text}</span>
                                                </button>
                                            ))}
                                        </div>

                                        {/* Subtle helper text */}
                                        <Text
                                            size="sm"
                                            style={{
                                                color: '#6c6f75',
                                                fontSize: '14px'
                                            }}
                                        >
                                            Press Enter to send, Shift+Enter for new line
                                        </Text>
                                    </div>
                                ) : (
                                    // Regular chat messages
                                    <div style={{ padding: '24px 0' }}>
                                        {messages.filter(msg => msg.type !== 'system').map((message) => (
                                            <MessageComponent key={message.id || Math.random()} message={message} />
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                            </ScrollArea>
                        </div>

                        {/* Input Area for active conversations */}
                        {messages.filter(msg => msg.type !== 'system').length > 0 ? (
                            <div style={{
                                padding: '16px 24px 24px',
                                borderTop: '1px solid #373a40',
                                background: '#1a1b1e'
                            }}>
                                <div style={{
                                    maxWidth: '768px',
                                    margin: '0 auto',
                                    position: 'relative'
                                }}>
                                    <div style={{
                                        background: '#25262b',
                                        border: '1px solid #373a40',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'border-color 0.2s ease'
                                    }}>
                                        <textarea
                                            ref={textareaRef2}
                                            placeholder="Ask me anything about our documentation..."
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            onKeyDown={handleKeyPress}
                                            rows={1}
                                            style={{
                                                flex: 1,
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#c1c2c5',
                                                fontSize: '16px',
                                                fontFamily: 'inherit',
                                                resize: 'none',
                                                outline: 'none',
                                                padding: '12px 16px',
                                                lineHeight: '1.5',
                                                maxHeight: '200px',
                                                overflowY: 'auto'
                                            }}
                                            disabled={isLoading}
                                            onFocus={(e) => {
                                                e.target.parentElement.style.borderColor = '#339af0';
                                            }}
                                            onBlur={(e) => {
                                                e.target.parentElement.style.borderColor = '#373a40';
                                            }}
                                        />
                                        <button
                                            onClick={() => sendMessage()}
                                            disabled={!inputValue.trim() || isLoading}
                                            style={{
                                                background: inputValue.trim() && !isLoading
                                                    ? '#339af0'
                                                    : '#373a40',
                                                border: 'none',
                                                borderRadius: '8px',
                                                padding: '8px',
                                                margin: '8px',
                                                cursor: inputValue.trim() && !isLoading ? 'pointer' : 'not-allowed',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s ease',
                                                minWidth: '32px',
                                                height: '32px'
                                            }}
                                        >
                                            {isLoading ? (
                                                <div style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    border: '2px solid #ffffff40',
                                                    borderTop: '2px solid #ffffff',
                                                    borderRadius: '50%',
                                                    animation: 'spin 1s linear infinite'
                                                }} />
                                            ) : (
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{
                                                    color: inputValue.trim() ? 'white' : '#909296'
                                                }}>
                                                    <path
                                                        d="M7 11L12 6L17 11M12 18V7"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        transform="rotate(90 12 12)"
                                                    />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </Container>

                    {/* Footer */}
                    <footer style={{
                        background: '#25262b',
                        borderTop: '1px solid #373a40',
                        padding: '16px 24px',
                        textAlign: 'center',
                        marginTop: 'auto'
                    }}>
                        <Text size="sm" style={{ color: '#6c6f75', fontSize: '13px', marginBottom: '8px' }}>
                            \\ud83e\\udd16 ${orgName} Documentation Assistant \\u2022 Powered by MCP
                        </Text>
                        <Text size="sm" style={{ color: '#6c6f75', fontSize: '13px' }}>
                            Made with \\u2764\\ufe0f by{' '}
                            <a
                                href="https://southleft.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    color: '#339af0',
                                    textDecoration: 'none',
                                    fontWeight: '500'
                                }}
                                onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                                onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                            >
                                Southleft
                            </a>
                        </Text>
                    </footer>
                </div>
            );
        }

        // Hide loader and render app
        function init() {
            document.getElementById('loader').style.display = 'none';
            const root = createRoot(document.getElementById('root'));
            root.render(<ChatApp />);
        }

        // Initialize when everything is loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    </script>

    <style>
        @keyframes thinking {
            0%, 60%, 100% {
                transform: scale(1);
                opacity: 0.3;
            }
            30% {
                transform: scale(1.2);
                opacity: 1;
            }
        }

        @keyframes pulse {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: 0.5;
            }
        }

        /* Custom scrollbar for dark theme */
        ::-webkit-scrollbar {
            width: 8px;
        }
        ::-webkit-scrollbar-track {
            background: #25262b;
        }
        ::-webkit-scrollbar-thumb {
            background: #495057;
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #5c6370;
        }

        /* Enhanced markdown styling */
        .message-content {
            line-height: 1.6;
            color: #c1c2c5;
        }

        .message-content h1,
        .message-content h2,
        .message-content h3,
        .message-content h4,
        .message-content h5,
        .message-content h6 {
            margin: 24px 0 16px 0;
            font-weight: 600;
        }

        .message-content h1 { font-size: 24px; }
        .message-content h2 { font-size: 20px; }
        .message-content h3 { font-size: 18px; }
        .message-content h4 { font-size: 16px; }

        .message-content h2:not(:first-child) {
            padding-top: 30px;
            margin-top: 30px;
            border-top: 1px solid #ffffff40;
        }

        .message-content p {
            margin: 12px 0;
            line-height: 1.6;
        }

        .message-content ul,
        .message-content ol {
            margin: 14px 0;
            padding-left: 24px;
        }

        .message-content li {
            margin: 6px 0;
            line-height: 1.4;
        }

        .message-content ul li {
            list-style-type: disc;
        }

        .message-content ul li li {
            list-style-type: circle;
        }

        .message-content ol li {
            list-style-type: decimal;
        }

        .message-content ol li li {
            list-style-type: lower-alpha;
        }

        .message-content a {
            color: #339af0;
            text-decoration: none;
            border-bottom: 1px solid transparent;
            transition: border-color 0.2s ease;
        }

        .message-content a:hover {
            border-bottom-color: #339af0;
        }

        .message-content code {
            background: #2c2e33;
            color: #ff7979;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
            font-size: 14px;
        }

        .message-content pre {
            background: #2c2e33;
            color: #c1c2c5;
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 16px 0;
        }

        .message-content pre code {
            background: none;
            padding: 0;
            color: inherit;
        }

        .message-content blockquote {
            border-left: 3px solid #339af0;
            background: #2c2e33;
            margin: 16px 0;
            padding: 12px 16px;
            color: #909296;
            font-style: italic;
        }

        .message-content hr {
            border: none;
            border-top: 1px solid #373a40;
            margin: 20px 0;
        }

        .message-content strong {
            color: #fff;
            font-weight: 600;
        }

        .message-content em {
            color: #b3b6ba;
            font-style: italic;
        }
    </style>
</body>
</html>`;
}
