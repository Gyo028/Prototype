import LegalPage from '@/components/public/legal-page';
import { termsAndConditions } from '@/data/legal';

export default function Terms() {
    return <LegalPage doc={termsAndConditions} />;
}
