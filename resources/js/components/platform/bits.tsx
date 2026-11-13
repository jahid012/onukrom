import { StatusBadge } from '@/components/admin/status-badge';
import type { Tone } from '@/components/admin/status-badge';
import { useFormat } from '@/hooks/use-format';

export type CompanyRow = {
    id: number;
    code: string;
    name: string;
    plan: string;
    planName: string;
    price: number;
    subscription: 'trial' | 'active' | 'past_due' | 'suspended';
    coveredUntil: string | null;
    createdAt: string | null;
    staff?: number;
};

export type PlanOption = {
    key: string;
    name: string;
    price: number;
    active: boolean;
};

const tones: Record<CompanyRow['subscription'], Tone> = {
    trial: 'info',
    active: 'success',
    past_due: 'warning',
    suspended: 'danger',
};

const labels: Record<CompanyRow['subscription'], string> = {
    trial: 'Trial',
    active: 'Paid',
    past_due: 'Overdue',
    suspended: 'Suspended',
};

export function CompanyStatus({
    status,
}: {
    status: CompanyRow['subscription'];
}) {
    return <StatusBadge tone={tones[status]} label={labels[status]} />;
}

export function useDate() {
    const { f } = useFormat();

    return (iso: string | null) =>
        iso
            ? f.date(new Date(iso.length === 10 ? `${iso}T00:00:00` : iso), {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
              })
            : '—';
}
