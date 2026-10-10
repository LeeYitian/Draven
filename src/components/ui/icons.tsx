import type { SVGProps } from 'react';

/**
 * 自訂圖示（不在 lucide 內的）。用法與 lucide 圖示一致：size、strokeWidth、currentColor。
 * BookOpenIcon：好讀版入口（翻開的書）。
 */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  size?: number;
  strokeWidth?: number;
}

export function BookOpenIcon({ size = 24, strokeWidth = 1.5, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" />
      <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
