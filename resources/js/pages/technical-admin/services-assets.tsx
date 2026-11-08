import { Head } from '@inertiajs/react';
import type { Asset, EventTypeOption, Theme } from '@/components/technical-admin/asset-theme-management';
import type { Service } from '@/components/technical-admin/service-management';
import ServicesAndAssetsManagement from '@/components/technical-admin/services-and-assets-management';
import TechnicalAdminLayout from '@/layouts/technical-admin-layout';

type Props = {
    services: Service[];
    categories: string[];
    unitTypes: string[];
    themes: Theme[];
    eventTypes: EventTypeOption[];
    styles: string[];
    assets: Asset[];
    assetCategories: string[];
};

export default function ServicesAssets(props: Props) {
    return (
        <TechnicalAdminLayout>
            <Head title="Services & Assets" />
            <ServicesAndAssetsManagement {...props} />
        </TechnicalAdminLayout>
    );
}