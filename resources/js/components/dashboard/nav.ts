export type NavLink = { title: string; href: string };
/** A sidebar entry: either a normal link, or a dropdown that opens to show more links. */
export type NavItem = NavLink | { title: string; children: NavLink[] };
export type NavGroup = { label: string; items: NavItem[] };

export const technicalAdminNav: NavGroup[] = [
    {
        label: 'Main',
        items: [{ title: 'Dashboard', href: '/technical-admin' }],
    },
    {
        label: 'Management',
        items: [
            { title: 'User Accounts', href: '/technical-admin/users' },
            { title: 'Website Content', href: '/technical-admin/website-content' },
            { title: 'Services and Assets', href: '/technical-admin/services-assets' },
            { title: 'Employee Records', href: '/technical-admin/employees' },
        ],
    },
];

export const projectManagerNav: NavGroup[] = [
    {
        label: 'Main',
        items: [{ title: 'Dashboard', href: '/project-manager' }],
    },
    {
        label: 'Management',
        items: [
            { title: 'Service Requests', href: '/project-manager/service-requests' },
            { title: 'Projects', href: '/project-manager/projects' },
        ],
    },
];

export const designSpecialistNav: NavGroup[] = [
    {
        label: 'Main',
        items: [{ title: 'Dashboard', href: '/design-specialist' }],
    },
    {
        label: 'Management',
        items: [{ title: 'Assigned Projects', href: '/design-specialist/projects' }],
    },
];

export const ownerNav: NavGroup[] = [
    {
        label: 'Main',
        items: [{ title: 'Dashboard', href: '/owner' }],
    },
    {
        label: 'Management',
        items: [{ title: 'Business Overview', href: '/owner/business-overview' }],
    },
];

export const bookkeeperNav: NavGroup[] = [
    {
        label: 'Main',
        items: [{ title: 'Dashboard', href: '/bookkeeper' }],
    },
    {
        label: 'Management',
        items: [
            { title: 'Expenses', href: '/bookkeeper/expenses' },
            { title: 'Financial Reports', href: '/bookkeeper/financial-reports' },
        ],
    },
];
