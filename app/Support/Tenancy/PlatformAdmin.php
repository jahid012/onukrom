<?php

namespace App\Support\Tenancy;

use App\Models\User;
use Illuminate\Support\Str;

/**
 * Creates (or promotes) an Onukrom super admin: a user without a company who
 * signs in at /login and lands in /platform. Used by the artisan command and
 * the deploy hook of the same name (production has no SSH).
 */
class PlatformAdmin
{
    /** @return array<string, list<string>> */
    public static function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190'],
            'password' => ['nullable', 'string', 'min:10'],
        ];
    }

    /**
     * @param  array{name: string, email: string, password?: ?string}  $input
     * @return array{user: User, password: ?string} password is null when an existing platform user was kept as is
     */
    public static function create(array $input): array
    {
        $email = strtolower($input['email']);
        $existing = User::withoutGlobalScope('tenant')->where('email', $email)->first();

        if ($existing !== null && $existing->tenant_id !== null) {
            throw new \InvalidArgumentException('This email belongs to a company user. Use another email for the platform.');
        }

        $password = ($input['password'] ?? null) ?: Str::password(16, symbols: false);
        $user = $existing ?? new User;
        $user->forceFill([
            'tenant_id' => null,
            'platform_role' => 'super_admin',
            'name' => $input['name'],
            'email' => $email,
            'email_verified_at' => $user->email_verified_at ?? now(),
            'status' => 'active',
            'password' => $password,
        ])->save();

        return ['user' => $user, 'password' => $password];
    }
}
