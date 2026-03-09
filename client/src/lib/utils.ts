import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getUnitMultiplier(unit: 'pieces' | 'dozen' | 'carton'): number {
  switch (unit) {
    case 'dozen': return 12;
    case 'carton': return 24;
    case 'pieces':
    default: return 1;
  }
}
