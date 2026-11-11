<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Smoke test for the static admin page previews. */
class AdminPagesTest extends TestCase
{
    use RefreshDatabase;

    public static function pages(): array
    {
        return [
            'orders' => ['/orders', 'orders/index'],
            'order detail' => ['/orders/SR07-261110-019', 'orders/show'],
            'deliveries' => ['/deliveries', 'deliveries/index'],
            'collections' => ['/collections', 'collections/index'],
            'returns' => ['/returns', 'returns/index'],
            'shops' => ['/shops', 'shops/index'],
            'areas' => ['/areas', 'areas/index'],
            'products' => ['/products', 'products/index'],
            'pricing' => ['/pricing', 'pricing/index'],
            'stock' => ['/stock', 'stock/index'],
            'staff' => ['/staff', 'staff/index'],
            'roles' => ['/roles', 'roles/index'],
            'reports' => ['/reports', 'reports/index'],
            'company settings' => ['/company/settings', 'company/settings'],
        ];
    }

    #[DataProvider('pages')]
    public function test_admin_page_renders_for_a_logged_in_user(string $url, string $component): void
    {
        $this->actingAs(User::factory()->create())
            ->get($url)
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component($component));
    }

    #[DataProvider('pages')]
    public function test_admin_page_requires_login(string $url): void
    {
        $this->get($url)->assertRedirect(route('login'));
    }

    public function test_order_detail_receives_the_order_number(): void
    {
        $this->actingAs(User::factory()->create())
            ->get('/orders/SR15-261110-012')
            ->assertInertia(fn (Assert $page) => $page->where('number', 'SR15-261110-012'));
    }
}
