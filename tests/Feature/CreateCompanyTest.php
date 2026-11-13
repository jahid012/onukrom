<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\Tenancy\CompanySetup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CreateCompanyTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_creates_a_working_company_and_owner(): void
    {
        $this->artisan('onukrom:create-company', [
            'code' => 'AcmeTraders', 'name' => 'Acme Traders',
            '--owner' => 'Karim', '--email' => 'Owner@Acme.test', '--phone' => '+8801712345678', '--password' => 'secret-pass-1',
        ])->expectsOutputToContain('code: acmetraders')->assertSuccessful();

        $tenant = Tenant::where('code', 'acmetraders')->firstOrFail();
        $owner = User::where('email', 'owner@acme.test')->firstOrFail();

        $this->assertSame($tenant->id, $owner->tenant_id);
        $this->assertSame('01712345678', $owner->phone);
        $this->assertTrue(Hash::check('secret-pass-1', $owner->password));
        $this->assertNotNull($owner->email_verified_at);
        $this->assertSame(['owner'], $owner->roles()->pluck('key')->all());
        $this->assertSame(4, Role::withoutGlobalScopes()->where('tenant_id', $tenant->id)->count());
        $this->assertEqualsCanonicalizing(['main', 'damage'], Warehouse::withoutGlobalScopes()->where('tenant_id', $tenant->id)->pluck('type')->all());

        $this->post('/login', ['email' => 'owner@acme.test', 'password' => 'secret-pass-1'])->assertRedirect();
        $this->get('/dashboard')->assertOk();
    }

    public function test_command_rejects_a_taken_code_or_email(): void
    {
        $this->artisan('onukrom:create-company', ['code' => 'acme', 'name' => 'Acme', '--owner' => 'A', '--email' => 'a@acme.test'])->assertSuccessful();

        $this->artisan('onukrom:create-company', ['code' => 'acme', 'name' => 'Other', '--owner' => 'B', '--email' => 'b@acme.test'])->assertFailed();
        $this->artisan('onukrom:create-company', ['code' => 'other', 'name' => 'Other', '--owner' => 'B', '--email' => 'a@acme.test'])->assertFailed();
        $this->assertSame(1, Tenant::count());
    }

    public function test_deploy_hook_needs_the_token_and_returns_a_generated_password(): void
    {
        config(['app.deploy_token' => 'secret-token']);
        $payload = ['code' => 'acme', 'name' => 'Acme', 'owner_name' => 'Karim', 'email' => 'owner@acme.test'];

        $this->postJson('/api/_deploy/create-company', $payload)->assertNotFound();
        $this->assertSame(0, Tenant::count());

        $response = $this->withHeader('X-Deploy-Token', 'secret-token')
            ->postJson('/api/_deploy/create-company', $payload)
            ->assertCreated()
            ->assertJsonPath('company_code', 'acme');

        $password = $response->json('password');
        $this->assertGreaterThanOrEqual(16, strlen($password));
        $this->assertTrue(Hash::check($password, User::where('email', 'owner@acme.test')->value('password')));

        $this->withHeader('X-Deploy-Token', 'secret-token')
            ->postJson('/api/_deploy/create-company', $payload)
            ->assertUnprocessable();
    }

    public function test_a_company_missing_its_warehouses_and_categories_is_repaired_when_the_panel_loads(): void
    {
        $this->artisan('onukrom:create-company', ['code' => 'acme', 'name' => 'Acme', '--owner' => 'A', '--email' => 'a@acme.test'])->assertSuccessful();
        $tenant = Tenant::where('code', 'acme')->firstOrFail();
        Warehouse::withoutGlobalScopes()->where('tenant_id', $tenant->id)->delete();
        Category::withoutGlobalScopes()->where('tenant_id', $tenant->id)->forceDelete();

        $state = $this->actingAs(User::where('email', 'a@acme.test')->firstOrFail())
            ->getJson('/admin/state')->assertOk()->json('state');

        $this->assertEqualsCanonicalizing(['main', 'damage'], array_column($state['warehouses'], 'type'));
        $this->assertCount(count(CompanySetup::DEFAULT_CATEGORIES), $state['categories']);

        // Loading again adds nothing more.
        $this->getJson('/admin/state')->assertOk();
        $this->assertSame(2, Warehouse::withoutGlobalScopes()->where('tenant_id', $tenant->id)->count());
    }

    public function test_a_new_company_can_build_its_first_zone_area_and_route(): void
    {
        $this->artisan('onukrom:create-company', ['code' => 'acme', 'name' => 'Acme', '--owner' => 'A', '--email' => 'a@acme.test'])->assertSuccessful();
        $this->actingAs(User::where('email', 'a@acme.test')->firstOrFail());
        $act = fn (string $action, array $args) => $this->postJson('/admin/actions/'.$action, ['args' => $args]);

        $zoneId = $act('addZone', ['Dhaka North'])->assertOk()->json('result');
        $act('addZone', ['Dhaka North'])->assertUnprocessable();
        $areaId = $act('addArea', [$zoneId, 'Mirpur'])->assertOk()->json('result');
        $act('saveRoute', [$areaId, null, ['name' => 'Mirpur-10', 'code' => 'MR-10', 'visitDays' => ['sat']]])
            ->assertOk()
            ->assertJsonPath('state.zones.0.name', 'Dhaka North')
            ->assertJsonPath('state.zones.0.areas.0.routes.0.name', 'Mirpur-10');
    }
}
