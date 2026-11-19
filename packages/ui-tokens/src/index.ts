export const colors = {
    primary: '#08783E', primaryDark: '#065D35', primaryLight: '#E4F2E8',
    brand: '#108357', background: '#F5F7F8', surface: '#FFFFFF', text: '#142333',
    muted: '#52616B', border: '#DCE4E0', sidebar: '#142838', sidebarText: '#F1F5F9',
    success: '#207A43', warning: '#986100', danger: '#B42318', info: '#176B9C',
    bronze: '#A56835', silver: '#657585', gold: '#BA8500',
} as const;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 6, md: 12, lg: 18, pill: 999 } as const;
export const typography = { caption: 12, body: 14, label: 16, title: 22, heading: 30 } as const;
export const shadows = {
    web: '0 2px 12px rgba(20, 35, 51, 0.07)',
    native: { shadowColor: '#142333', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
} as const;

