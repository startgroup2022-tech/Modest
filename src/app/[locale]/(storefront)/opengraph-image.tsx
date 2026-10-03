import { ImageResponse } from 'next/og';

export const alt = 'Attention Modest Fashion — Modern Modesty';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0A0A0A',
          color: '#F6F1E9',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 22, letterSpacing: 8, textTransform: 'uppercase', color: '#C9BFAE' }}>
          Bahrain · Atelier
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 96, letterSpacing: 16, fontWeight: 300 }}>ATTENTION</div>
          <div style={{ marginTop: 18, fontSize: 34, color: '#C9BFAE', letterSpacing: 4 }}>MODERN MODESTY</div>
        </div>
        <div style={{ fontSize: 24, color: '#8C8578', letterSpacing: 2 }}>
          Ready-to-wear &amp; made-to-order modest womenswear
        </div>
      </div>
    ),
    size,
  );
}
