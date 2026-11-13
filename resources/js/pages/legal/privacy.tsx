import { LegalPage } from '@/components/public/legal-page';
import type { SiteProps } from '@/components/public/site';

export default function Privacy(props: SiteProps) {
    return <LegalPage doc="privacy" {...props} />;
}
