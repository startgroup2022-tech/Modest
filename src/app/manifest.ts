import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Attention Modest Fashion',
    short_name: 'ATTENTION',
    description: 'Modern modest womenswear — ready-to-wear and made-to-order, from Bahrain.',
    start_url: '/en',
    display: 'standalone',
    background_color: '#F6F1E9',
    theme_color: '#0A0A0A',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
