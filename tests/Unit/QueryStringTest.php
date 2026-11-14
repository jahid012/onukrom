<?php

namespace Tests\Unit;

use App\Support\Http\QueryString;
use PHPUnit\Framework\TestCase;

class QueryStringTest extends TestCase
{
    public function test_an_empty_get_is_rebuilt_from_the_request_uri(): void
    {
        $get = [];
        $server = ['REQUEST_URI' => '/api/v1/sync/pull?entity=products&cursor=WyIy%3D&overlap=1#x', 'QUERY_STRING' => ''];

        $this->assertTrue(QueryString::repair($get, $server));
        $this->assertSame(['entity' => 'products', 'cursor' => 'WyIy=', 'overlap' => '1'], $get);
        $this->assertSame('entity=products&cursor=WyIy%3D&overlap=1', $server['QUERY_STRING']);
    }

    public function test_query_string_is_used_when_present(): void
    {
        $get = [];
        $server = ['REQUEST_URI' => '/index.php', 'QUERY_STRING' => 'code=acme&a[]=1'];

        $this->assertTrue(QueryString::repair($get, $server));
        $this->assertSame(['code' => 'acme', 'a' => ['1']], $get);
    }

    public function test_a_healthy_request_is_left_alone(): void
    {
        $get = ['entity' => 'shops'];
        $server = ['REQUEST_URI' => '/x?entity=products', 'QUERY_STRING' => 'entity=products'];

        $this->assertFalse(QueryString::repair($get, $server));
        $this->assertSame(['entity' => 'shops'], $get);

        $get = [];
        $server = ['REQUEST_URI' => '/x'];
        $this->assertFalse(QueryString::repair($get, $server));
        $this->assertSame([], $get);
    }
}
