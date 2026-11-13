import { LegalPage } from '@/components/public/legal-page';
import type { SiteProps } from '@/components/public/site';

export default function Terms(props: SiteProps) {
    return <LegalPage doc="terms" {...props} />;
}
