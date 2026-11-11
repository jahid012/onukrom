<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_home_sends_guests_to_the_login_screen()
    {
        $this->get(route('home'))->assertRedirect('/dashboard');

        $this->get('/dashboard')->assertRedirect(route('login'));
    }
}
