<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class LocaleTest extends TestCase
{
    use RefreshDatabase;

    public function test_bangla_is_the_default_language(): void
    {
        $this->get(route('login'))
            ->assertOk()
            ->assertSee('<html lang="bn"', false)
            ->assertInertia(fn (Assert $page) => $page->where('locale', 'bn'));
    }

    public function test_locale_cookie_switches_to_english(): void
    {
        $this->withUnencryptedCookie('locale', 'en')
            ->get(route('login'))
            ->assertSee('<html lang="en"', false)
            ->assertInertia(fn (Assert $page) => $page->where('locale', 'en'));
    }

    public function test_unknown_locale_cookie_falls_back_to_bangla(): void
    {
        $this->withUnencryptedCookie('locale', 'fr')
            ->get(route('login'))
            ->assertInertia(fn (Assert $page) => $page->where('locale', 'bn'));
    }

    public function test_switching_language_sets_a_cookie_and_redirects_back(): void
    {
        $this->from(route('login'))
            ->post(route('locale.update'), ['locale' => 'en'])
            ->assertRedirect(route('login'))
            ->assertPlainCookie('locale', 'en');
    }

    public function test_only_supported_languages_are_accepted(): void
    {
        $this->from(route('login'))
            ->post(route('locale.update'), ['locale' => 'fr'])
            ->assertSessionHasErrors('locale')
            ->assertCookieMissing('locale');
    }

    public function test_server_messages_are_in_bangla_by_default(): void
    {
        $user = User::factory()->create();

        $this->from(route('login'))
            ->post(route('login.store'), [
                'email' => $user->email,
                'password' => 'wrong-password',
            ])
            ->assertSessionHasErrors([
                'email' => 'এই পরিচয়পত্র আমাদের রেকর্ডের সাথে মেলে না।',
            ]);
    }

    public function test_server_messages_follow_the_english_switch(): void
    {
        $user = User::factory()->create();

        $this->withUnencryptedCookie('locale', 'en')
            ->from(route('login'))
            ->post(route('login.store'), [
                'email' => $user->email,
                'password' => 'wrong-password',
            ])
            ->assertSessionHasErrors([
                'email' => 'These credentials do not match our records.',
            ]);
    }
}
