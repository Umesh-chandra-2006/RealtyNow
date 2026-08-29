import { Link } from 'react-router-dom';

export function Logo({
  to = '/',
  className = '',
  size = 175,
  maxHeight = 48,
  src = '/1.png',
}: {
  to?: string;
  className?: string;
  size?: number;
  maxHeight?: number;
  src?: string;
}) {
  return (
    <Link to={to} className={`flex items-center gap-2 ${className}`}>
      <img
        src={src}
        alt="RealtyNow"
        style={{
          width: size,
          height: 'auto',
          maxHeight: `${maxHeight}px`,
          objectFit: 'contain',
        }}
      />
    </Link>
  );
}

export function LogoLight({
  to = '/',
  className = '',
  size = 175,
  maxHeight = 48,
  src = '/1.png',
}: {
  to?: string;
  className?: string;
  size?: number;
  maxHeight?: number;
  src?: string;
}) {
  return (
    <Link to={to} className={`flex items-center gap-2 ${className}`}>
      <img
        src={src}
        alt="RealtyNow"
        style={{
          width: size,
          height: 'auto',
          maxHeight: `${maxHeight}px`,
          objectFit: 'contain',
        }}
      />
    </Link>
  );
}
