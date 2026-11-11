<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Sync\PushProcessor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** POST /sync/push — a batch of outbox operations from the phone (spec §7.5). */
class SyncPushController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $request->validate([
            'operations' => ['present', 'array', 'max:200'],
            'operations.*.entity' => ['required', 'string'],
            'operations.*.id' => ['required', 'string', 'max:40'],
        ]);

        $user = $request->user();
        $processor = new PushProcessor($user);
        $results = array_map(fn (array $op) => $processor->apply($op), $request->input('operations'));

        $user->forceFill(['last_seen_at' => now()])->save();

        if ($deviceId = $request->header('X-Device-Id')) {
            Device::where('user_id', $user->id)->where('device_id', $deviceId)
                ->update(['last_sync_at' => now(), 'app_version' => $request->header('X-App-Version')]);
        }

        return response()->json(['data' => [
            'results' => $results,
            'server_time' => now()->toIso8601ZuluString('millisecond'),
        ]]);
    }
}
