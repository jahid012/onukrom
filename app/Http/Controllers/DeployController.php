<?php

namespace App\Http\Controllers;

use App\Support\Tenancy\CompanySetup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Throwable;

/**
 * Called by the CI/CD pipeline (.github/workflows/deploy.yml) around an FTP
 * upload, because cPanel hosting has no SSH. Every call needs the
 * X-Deploy-Token header to match DEPLOY_TOKEN in the server's .env;
 * without a token set, these URLs do not exist (404).
 *
 *   GET  /api/_deploy/status   which vendor build is on the server
 *   POST /api/_deploy/down     maintenance mode while files upload
 *   POST /api/_deploy/refresh  clear + rebuild caches (+ migrate), back online
 *   POST /api/_deploy/create-company  first company + owner login
 */
class DeployController extends Controller
{
    private function authorize(Request $request): void
    {
        $token = (string) config('app.deploy_token');

        abort_if($token === '' || ! hash_equals($token, (string) $request->header('X-Deploy-Token')), 404);
    }

    /** The vendor zip records which composer.lock it was built from. */
    public function status(Request $request): JsonResponse
    {
        $this->authorize($request);
        $marker = base_path('vendor/.lock-hash');

        return response()->json([
            'vendor_lock_hash' => is_file($marker) ? trim((string) file_get_contents($marker)) : null,
            'php' => PHP_VERSION,
            'maintenance' => app()->isDownForMaintenance(),
        ]);
    }

    public function down(Request $request): JsonResponse
    {
        $this->authorize($request);
        Artisan::call('down', ['--retry' => 60]);

        return response()->json(['ok' => true, 'output' => trim(Artisan::output())]);
    }

    /**
     * First company + owner login on a fresh server (no SSH for artisan).
     * Called from your own PC by deploy/create-company.ps1, never from CI,
     * so the generated password only appears in your terminal.
     */
    public function createCompany(Request $request): JsonResponse
    {
        $this->authorize($request);
        $data = $request->validate(CompanySetup::rules());

        $result = CompanySetup::create(
            ['code' => $data['code'], 'name' => $data['name']],
            ['name' => $data['owner_name'], 'email' => $data['email'], 'phone' => $data['phone'] ?? null, 'password' => $data['password'] ?? null],
        );

        return response()->json([
            'ok' => true,
            'company_code' => $result['tenant']->code,
            'email' => $result['owner']->email,
            'password' => ($data['password'] ?? null) ? null : $result['password'],
        ], 201);
    }

    public function refresh(Request $request): JsonResponse
    {
        $this->authorize($request);
        $log = [];
        $run = function (string $command, array $args = []) use (&$log): void {
            Artisan::call($command, $args);
            $log[] = '$ php artisan '.$command."\n".trim(Artisan::output());
        };

        // FTP never uploads storage/, so make sure its folders exist.
        foreach (['app/public', 'framework/cache/data', 'framework/sessions', 'framework/views', 'logs'] as $dir) {
            File::ensureDirectoryExists(storage_path($dir));
        }

        try {
            // Migrate before optimize:clear: its cache:clear needs the database
            // `cache` table, which a fresh server only gets from the migrations.
            $run('config:clear');

            if ($request->boolean('migrate')) {
                $run('migrate', ['--force' => true]);
            }

            $run('optimize:clear');
            $run('optimize');
        } catch (Throwable $e) {
            report($e);
            // Stay in maintenance mode: a half-cached app is worse than a short outage.

            return response()->json(['ok' => false, 'error' => $e->getMessage(), 'log' => $log], 500);
        }

        if (function_exists('opcache_reset')) {
            opcache_reset();
        }

        $run('up');

        return response()->json(['ok' => true, 'log' => $log]);
    }
}
