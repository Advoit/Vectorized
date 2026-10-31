import { IconLoader2 } from '@tabler/icons-react';

export function Spinner({ size = 14 }: { size?: number }) {
  return <IconLoader2 size={size} stroke={1.8} className="spinner" aria-hidden="true" />;
}
