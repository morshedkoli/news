import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch image' }, { status: response.status });
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Resize and convert to JPEG
        // Max width 1080px, strip metadata, ensure non-progressive for Android compatibility
        const processedImage = await sharp(buffer)
            .resize({ width: 1080, withoutEnlargement: true })
            .toFormat('jpeg', {
                quality: 80,
                progressive: false,
                chromaSubsampling: '4:4:4',
            })
            .withMetadata(false) // Strip sensitive metadata
            .toBuffer();

        // Cache for 1 year
        return new NextResponse(processedImage, {
            headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('Image proxy error:', error);
        return NextResponse.json({ error: 'Image processing failed' }, { status: 500 });
    }
}
