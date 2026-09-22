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
