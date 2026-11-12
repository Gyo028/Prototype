export type NavItem = { title: string; href: string };
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
            { title: 'Consultations', href: '/project-manager/consultations' },
            { title: 'Site Assessments', href: '/project-manager/site-assessments' },
            { title: 'Design Assignments', href: '/project-manager/design-assignments' },
            { title: 'Projects', href: '/project-manager/projects' },
            { title: 'Payments', href: '/project-manager/payments' },
            { title: 'Contracts', href: '/project-manager/contracts' },
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
