import { NextResponse } from 'next/server';

export async function POST() {
    try {
        // Note: You'll need to handle API key retrieval according to your setup
        // This assumes you have environment variables set up
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: 'API key not configured' },
                { status: 500 }
            );
        }

        const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-realtime-preview-2024-12-17',
                voice: 'alloy'
            })
        });

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error) {
        console.error('Error creating audio session:', error);
        return NextResponse.json(
            { error: 'Failed to create audio session' },
            { status: 500 }
        );
    }
} 