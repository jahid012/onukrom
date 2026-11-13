<?php

namespace App\Support\Tenancy;

use App\Models\Category;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\Permissions;
use App\Support\Phone;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Creates a ready-to-use company: built-in roles, main and damage warehouses,
 * starter product categories, and an owner who can sign in to the admin panel. Used by
 * `php artisan onukrom:create-company` and the deploy hook of the same name
 * (production has no SSH).
 */
class CompanySetup
{
    /** Starter product categories: key => [English, Bangla]. Renamed or extended later. */
    public const DEFAULT_CATEGORIES = [
        'drinks' => ['Drinks', 'পানীয়'],
        'food' => ['Food & snacks', 'খাবার ও স্ন্যাকস'],
        'personal_care' => ['Personal care', 'ব্যক্তিগত যত্ন'],
        'household' => ['Household', 'গৃহস্থালি'],
        'other' => ['Other', 'অন্যান্য'],
    ];

    /**
     * What every company needs before the admin panel works: a main and a
     * damage warehouse (orders reserve stock in the main one) and at least
     * one product category. Idempotent; runs for the current tenant. Also
     * called when the admin panel loads, so a company created without them
     * is repaired instead of crashing pages.
     */
    public static function ensureDefaults(): void
    {
        if (! Warehouse::where('type', 'main')->exists()) {
            Warehouse::create(['name' => 'Main warehouse', 'name_bn' => 'প্রধান গুদাম', 'type' => 'main']);
        }

        if (! Warehouse::where('type', 'damage')->exists()) {
            Warehouse::create(['name' => 'Damage store', 'name_bn' => 'ড্যামেজ স্টোর', 'type' => 'damage']);
        }

        if (! Category::exists()) {
            $sort = 0;

            foreach (self::DEFAULT_CATEGORIES as $key => [$name, $bn]) {
                Category::create(['key' => $key, 'name' => $name, 'name_bn' => $bn, 'sort' => $sort++]);
            }
        }
    }

    /**
     * @param  array{code: string, name: string, phone?: ?string, address?: ?string, plan?: string}  $company
     * @param  array{name: string, email: string, phone?: ?string, password?: ?string}  $owner
     * @return array{tenant: Tenant, owner: User, password: string}
     */
    public static function create(array $company, array $owner): array
    {
        $password = ($owner['password'] ?? null) ?: Str::password(16, symbols: false);

        return DB::transaction(function () use ($company, $owner, $password): array {
            $tenant = Tenant::create([
                'code' => strtolower($company['code']),
                'name' => $company['name'],
                'phone' => $company['phone'] ?? null,
                'address' => $company['address'] ?? null,
                'settings' => Tenant::DEFAULT_SETTINGS,
                'plan_key' => $company['plan'] ?? 'starter',
                'trial_ends_at' => now()->addDays(Tenant::TRIAL_DAYS)->toDateString(),
            ]);

            $user = TenantContext::run($tenant, function () use ($owner, $password): User {
                foreach (Permissions::defaults() as $key => $permissions) {
                    Role::create(['key' => $key, 'built_in' => true, 'permissions' => $permissions]);
                }

                self::ensureDefaults();

                $user = User::create([
                    'name' => $owner['name'],
                    'employee_code' => 'OW01',
                    'phone' => filled($owner['phone'] ?? null) ? Phone::normalize($owner['phone']) : null,
                    'email' => strtolower($owner['email']),
                    'email_verified_at' => now(),
                    'password' => $password,
                    'status' => 'active',
                ]);
                $user->roles()->attach(Role::where('key', 'owner')->value('id'));

                return $user;
            });

            return ['tenant' => $tenant, 'owner' => $user, 'password' => $password];
        });
    }

    /**
     * Validation rules shared by the command and the deploy hook.
     *
     * @return array<string, list<mixed>>
     */
    public static function rules(): array
    {
        return [
            'code' => ['required', 'string', 'alpha_dash:ascii', 'max:32', 'unique:tenants,code'],
            'name' => ['required', 'string', 'max:120'],
            'owner_name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'phone' => ['nullable', 'string', function (string $attr, mixed $value, \Closure $fail): void {
                if (filled($value) && ! Phone::isValid($value)) {
                    $fail('The phone must be a Bangladeshi mobile number (01XXXXXXXXX).');
                }
            }],
            'password' => ['nullable', 'string', 'min:8'],
        ];
    }
}
