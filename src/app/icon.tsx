import { ImageResponse } from 'next/og';

// Image metadata
export const size = {
    width: 32,
    height: 32,
};
export const contentType = 'image/png';

// Generate favicon
export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    background: '#4F46E5', // Indigo-600
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '8px', // Matches Logo roundedness
                }}
            >
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 32 32"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    {/* The 'N' Structure - White for contrast */}
                    <path
                        d="M10 24V8L18 18V8"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* The Digital Signal Wave - White */}
                    <path
                        d="M22 24V14M22 10V8"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <circle cx="22" cy="12" r="1.5" fill="white" />
                </svg>
            </div>
        ),
        // ImageResponse options
        {
            ...size,
        }
    );
}
