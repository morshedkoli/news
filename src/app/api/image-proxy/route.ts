import { NextRequest, NextResponse } from 'next/server';

// Handle CORS preflight
export async function OPTIONS() {
    return new NextResponse(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'Missing url parameter' }, {
            status: 400,
            headers: { 'Access-Control-Allow-Origin': '*' }
        });
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; NewsApp/1.0)',
            },
        });

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch image' }, {
                status: response.status,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await response.arrayBuffer();

        // Return image with proper CORS headers
        return new NextResponse(arrayBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin': '*',
                'Cross-Origin-Resource-Policy': 'cross-origin',
            },
        });
    } catch (error) {
        console.error('Image proxy error:', error);
        return NextResponse.json({ error: 'Image processing failed' }, {
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*' }
        });
    }
}
