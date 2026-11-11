import type { Tone } from '@/components/admin/status-badge';
import type { OrderFlag, OrderStatus } from '@/data/admin/sales';

export const orderTone: Record<OrderStatus, Tone> = {
    pending: 'warning',
    approved: 'info',
    dispatched: 'primary',
    delivered: 'success',
    partially_delivered: 'success',
    failed: 'danger',
    cancelled: 'neutral',
    rejected: 'danger',
};

/** Flags that come from the live order location (spec 10.5). */
export const locationFlags: OrderFlag[] = [
    'far_from_shop',
    'low_accuracy',
    'mock',
    'no_location',
];
