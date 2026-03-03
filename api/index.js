const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Proxy endpoint for AI Chat
app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;
        const provider = process.env.AI_PROVIDER || 'openai';
        const apiKey = process.env.AI_API_KEY;
        const model = process.env.AI_MODEL;

        if (!apiKey) {
            return res.status(500).json({ error: 'API Key not configured on server' });
        }

        if (provider === 'openai') {
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: model || 'gpt-3.5-turbo',
                messages: messages
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            return res.json(response.data.choices[0].message);
        } else if (provider === 'gemini') {
            console.log(`Calling Gemini API with model: ${model || 'gemini-1.5-flash'}`);
            const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`, {
                contents: messages.map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                }))
            });
            const text = response.data.candidates[0].content.parts[0].text;
            return res.json({ role: 'assistant', content: text });
        }

        res.status(400).json({ error: 'Unsupported AI provider' });
    } catch (error) {
        console.error('Chat error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch AI response' });
    }
});

module.exports = app;
