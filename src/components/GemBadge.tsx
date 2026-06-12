'use client';

export default function GemBadge({ gems, size = 'md' }: { gems: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-lg px-4 py-2',
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-gem/20 text-gem font-semibold ${sizeClasses[size]}`}>
      <svg viewBox="0 0 20 20" fill="currentColor" className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'}>
        <path d="M10 2L3 8l7 10 7-10-7-6zM6.5 7.5L10 4l3.5 3.5L10 15 6.5 7.5z" />
      </svg>
      {gems.toLocaleString()}
    </span>
  );
}
