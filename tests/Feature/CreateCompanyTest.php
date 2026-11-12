<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
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
}
