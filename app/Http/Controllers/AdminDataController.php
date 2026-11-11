<?php

namespace App\Http\Controllers;

use App\Admin\AdminActions;
use App\Admin\AdminError;
use App\Admin\AdminState;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * JSON behind the admin panel's store:
 *   GET  /admin/state            everything the pages show
 *   POST /admin/actions/{name}   one button press → fresh state back
 */
class AdminDataController extends Controller
{
    private function guard(Request $request): void
    {
        $user = $request->user();

        // Office staff only; the phone app has its own API.
        abort_if(! $user?->tenant_id || $user->status === 'inactive', 403);
        abort_if(collect($user->permissions())->every(fn ($p) => str_starts_with($p, 'app.') || in_array($p, ['shop.view_assigned', 'shop.create', 'order.create', 'order.edit_own_pending', 'order.cancel_own_pending', 'collection.create', 'return.create', 'report.view_own', 'product.view', 'delivery.view_assigned', 'delivery.complete', 'delivery.partial'], true)), 403);
    }

    public function state(Request $request): JsonResponse
    {
        $this->guard($request);

        return response()->json(['state' => (new AdminState($request->user()))->build()]);
    }

    public function action(Request $request, string $action): JsonResponse
    {
        $this->guard($request);
        $request->validate(['args' => ['present', 'array']]);

        try {
            $result = (new AdminActions($request->user()))->run($action, $request->input('args'));
        } catch (AdminError $e) {
            return response()->json(['message' => $e->getMessage()], $e->status);
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Not found — someone may have changed it. The page has been refreshed.'], 404);
        }

        return response()->json([
            'result' => $result,
            'state' => (new AdminState($request->user()->fresh()))->build(),
        ]);
    }
}
