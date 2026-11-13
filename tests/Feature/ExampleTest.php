<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_home_page_is_public_and_the_panel_needs_a_login()
    {
        $this->get(route('home'))->assertOk()->assertInertia(fn ($page) => $page->component('welcome'));

        $this->get('/dashboard')->assertRedirect(route('login'));
    }
}
