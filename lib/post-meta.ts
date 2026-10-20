// Display metadata (labels, icons, colours) for post fields.
import { SKILLS, type PostAnalysis, type PostStatus, type Urgency } from '@/types/models';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  AirVent,
  Baby,
  Car,
  ChefHat,
  CircleHelp,
  GraduationCap,
  Hammer,
  type LucideIcon,
  Package,
  PawPrint,
  Stethoscope,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react-native';

type Category = PostAnalysis['category'];

const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  plumbing: Wrench,
  electrical: Zap,
  it_wifi: Wifi,
  babysitting: Baby,
  carpentry: Hammer,
  aircon: AirVent,
  automotive: Car,
  cooking: ChefHat,
  tutoring: GraduationCap,
  medical: Stethoscope,
  pet_care: PawPrint,
  moving: Package,
  other: CircleHelp,
};

export function categoryMeta(category: Category) {
  return {
    icon: CATEGORY_ICONS[category],
    label: SKILLS.find((s) => s.id === category)?.label ?? 'Other',
  };
}

export const URGENCY_META: Record<Urgency, { label: string; dot: string; text: string; bg: string }> = {
  high: { label: 'Urgent', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
  medium: { label: 'Soon', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-500/10' },
  low: { label: 'Whenever', dot: 'bg-muted-foreground', text: 'text-muted-foreground', bg: 'bg-secondary' },
};

export const STATUS_META: Record<PostStatus, { label: string; dot: string }> = {
  open: { label: 'Open', dot: 'bg-brand' },
  in_progress: { label: 'In progress', dot: 'bg-amber-500' },
  resolved: { label: 'Resolved', dot: 'bg-muted-foreground' },
};

/** "5m", "3h", "2d" — compact relative time for cards. */
export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'now';
  return formatDistanceToNowStrict(new Date(iso))
    .replace(/ seconds?/, 's')
    .replace(/ minutes?/, 'm')
    .replace(/ hours?/, 'h')
    .replace(/ days?/, 'd')
    .replace(/ months?/, 'mo')
    .replace(/ years?/, 'y');
}
