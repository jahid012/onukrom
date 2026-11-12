<?php

namespace App\Support\Tenancy;

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
 * and an owner who can sign in to the admin panel. Used by
 * `php artisan onukrom:create-company` and the deploy hook of the same name
 * (production has no SSH).
 */
class CompanySetup
{
    /**
     * @param  array{code: string, name: string, phone?: ?string, address?: ?string}  $company
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
            ]);

            $user = TenantContext::run($tenant, function () use ($owner, $password): User {
                foreach (Permissions::defaults() as $key => $permissions) {
                    Role::create(['key' => $key, 'built_in' => true, 'permissions' => $permissions]);
                }

                Warehouse::create(['name' => 'Main warehouse', 'name_bn' => 'প্রধান গুদাম', 'type' => 'main']);
                Warehouse::create(['name' => 'Damage store', 'name_bn' => 'ড্যামেজ স্টোর', 'type' => 'damage']);

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
