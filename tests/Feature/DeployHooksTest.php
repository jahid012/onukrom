<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class DeployHooksTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['app.deploy_token' => 'secret-token']);
    }

    public function test_hooks_are_hidden_without_the_right_token(): void
    {
        $this->getJson('/api/_deploy/status')->assertNotFound();
        $this->withHeader('X-Deploy-Token', 'wrong')->postJson('/api/_deploy/refresh')->assertNotFound();

        config(['app.deploy_token' => '']);
        $this->withHeader('X-Deploy-Token', '')->getJson('/api/_deploy/status')->assertNotFound();
    }

    public function test_status_reports_the_vendor_build(): void
    {
        $this->withHeader('X-Deploy-Token', 'secret-token')->getJson('/api/_deploy/status')
            ->assertOk()
            ->assertJsonStructure(['vendor_lock_hash', 'php', 'maintenance']);
    }

    public function test_refresh_clears_and_rebuilds_caches_then_goes_back_online(): void
    {
        $calls = [];
        Artisan::shouldReceive('call')->andReturnUsing(function (string $command) use (&$calls) {
            $calls[] = $command;

            return 0;
        });
        Artisan::shouldReceive('output')->andReturn('');

        $this->withHeader('X-Deploy-Token', 'secret-token')->postJson('/api/_deploy/refresh?migrate=1')->assertOk()->assertJsonPath('ok', true);

        $this->assertSame(['config:clear', 'migrate', 'optimize:clear', 'optimize', 'up'], $calls);
    }

    public function test_refresh_without_migrate_skips_migrations(): void
    {
        $calls = [];
        Artisan::shouldReceive('call')->andReturnUsing(function (string $command) use (&$calls) {
            $calls[] = $command;

            return 0;
        });
        Artisan::shouldReceive('output')->andReturn('');

        $this->withHeader('X-Deploy-Token', 'secret-token')->postJson('/api/_deploy/refresh')->assertOk();

        $this->assertNotContains('migrate', $calls);
    }
}
