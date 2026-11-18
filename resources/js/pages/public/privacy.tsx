import LegalPage from '@/components/public/legal-page';
import { privacyPolicy } from '@/data/legal';

export default function Privacy() {
    return <LegalPage doc={privacyPolicy} />;
}
