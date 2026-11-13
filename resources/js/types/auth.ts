export type User = {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    /** Onukrom staff (no company): super_admin | support. */
    platform_role?: 'super_admin' | 'support' | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

export type Auth = {
    user: User;
    /** Set while a platform user views a company as its owner. */
    impersonator?: string | null;
};

/** One-time messages after a form post; `secret` is a password shown once. */
export type Flash = {
    success?: string | null;
    error?: string | null;
    secret?: string | null;
};

export type TwoFactorSetupData = {
    svg: string;
    url: string;
};

export type TwoFactorSecretKey = {
    secretKey: string;
};
