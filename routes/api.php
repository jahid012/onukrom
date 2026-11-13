<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\SyncPullController;
use App\Http\Controllers\Api\V1\SyncPushController;
use App\Http\Controllers\DeployController;
use App\Http\Controllers\PayStationIpnController;
use App\Http\Middleware\ResolveApiTenant;
use Illuminate\Support\Facades\Route;

/*
| Mobile app API (spec §12). Base: /api/v1
| Before login the company comes from the X-Tenant header (company code);
| after login it comes from the token's user.
*/
Route::prefix('v1')->group(function () {
    Route::get('tenants/lookup', [AuthController::class, 'lookup'])->middleware('throttle:30,1');

    Route::middleware(ResolveApiTenant::class)->group(function () {
        Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:20,1');

        Route::middleware('auth:sanctum')->group(function () {
            Route::get('me', [AuthController::class, 'me']);
            Route::post('auth/password', [AuthController::class, 'changePassword'])->middleware('throttle:5,60');
            Route::post('auth/logout', [AuthController::class, 'logout']);
            Route::get('sync/pull', SyncPullController::class)->middleware('throttle:120,1');
            Route::post('sync/push', SyncPushController::class)->middleware('throttle:60,1');
        });
    });
});

/*
| PayStation's server-to-server payment notice (IPN). Give this URL to
| PayStation; the body is verified against their status API before use.
*/
Route::post('paystation/ipn', PayStationIpnController::class)->middleware('throttle:60,1')->name('paystation.ipn');

/*
| Deploy hooks for the CI/CD pipeline (cPanel has no SSH). Token-protected;
| see app/Http/Controllers/DeployController.php and docs/DEPLOY.md.
*/
// No throttle: it stores hits in the cache, i.e. the database `cache` table,
// which does not exist until the first `migrate` these hooks run. Unknown
// tokens get a 404 and the token is 48 random hex characters.
Route::prefix('_deploy')->group(function () {
    Route::get('status', [DeployController::class, 'status']);
    Route::post('down', [DeployController::class, 'down']);
    Route::post('refresh', [DeployController::class, 'refresh']);
    Route::post('create-company', [DeployController::class, 'createCompany']);
    Route::post('create-super-admin', [DeployController::class, 'createSuperAdmin']);
});
