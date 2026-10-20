import { ImageResponse } from 'next/og';

const ALLOWED_SIZES = [180, 192, 512];

// Ícone do app gerado por código: dispensa manter PNGs no repositório.
export async function GET(request, { params }) {
  const { size: sizeParam } = await params;
  const size = ALLOWED_SIZES.includes(Number(sizeParam)) ? Number(sizeParam) : 192;
  // Maskable: o Android recorta em círculo, então o conteúdo fica na zona segura (80% central).
  const maskable = new URL(request.url).searchParams.has('maskable');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #22c55e 0%, #0ea5e9 100%)',
          borderRadius: maskable || size === 180 ? 0 : size * 0.22,
          color: 'white',
          fontSize: size * (maskable ? 0.32 : 0.42),
          fontWeight: 800,
          letterSpacing: -size * 0.02,
        }}
      >
        R$
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { 'Cache-Control': 'public, max-age=604800, immutable' },
    }
  );
}
