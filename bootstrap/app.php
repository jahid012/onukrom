<?php

use App\Http\Middleware\EnsurePlatformUser;
use App\Http\Middleware\EnsureTenantUser;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SetLocale;
use App\Http\Middleware\TenantFromUser;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // _fbp / _fbc are set by the Meta Pixel in the browser (not by Laravel).
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state', 'locale', '_fbp', '_fbc']);

        // The deploy pipeline must reach these while the site is in maintenance mode.
        $middleware->preventRequestsDuringMaintenance(except: ['api/_deploy/*']);

        $middleware->alias([
            'tenant' => EnsureTenantUser::class,
            'platform' => EnsurePlatformUser::class,
        ]);

        $middleware->web(append: [
            SetLocale::class,
            TenantFromUser::class,
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
