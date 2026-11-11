<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\Tenant;
use App\Models\User;
use App\Support\ApiError;
use App\Support\MePayload;
use App\Support\Phone;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

/** Phone + password login for SR / DM (spec §4.2 – §4.4). */
class AuthController extends Controller
{
    public function lookup(Request $request): JsonResponse
    {
        $tenant = Tenant::where('code', strtolower(trim((string) $request->query('code'))))->first();

        if (! $tenant || $tenant->status === 'suspended') {
            return ApiError::response('TENANT_NOT_FOUND', 'Company code not found.', 404);
        }

        return response()->json(['data' => [
            'code' => $tenant->code,
            'name' => $tenant->name,
            'api_base_url' => url('/api/v1'),
            'default_locale' => 'bn',
            'min_app_version' => 1,
        ]]);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone' => ['required', 'string'],
            'password' => ['required', 'string'],
            'device.device_id' => ['required', 'string', 'max:100'],
            'device.model' => ['nullable', 'string', 'max:100'],
            'device.app_version' => ['nullable', 'string', 'max:30'],
        ]);

        $tenant = TenantContext::get();
        $phone = Phone::normalize($data['phone']);
        $key = 'login:'.$tenant->id.':'.$phone;

        if (RateLimiter::tooManyAttempts($key, 5)) {
            return ApiError::response('TOO_MANY_ATTEMPTS', 'Too many attempts. Try again in '.RateLimiter::availableIn($key).' seconds.', 429);
        }

        /** @var User|null $user */
        $user = User::where('phone', $phone)->first();

        // Same answer for unknown phone and wrong password (no enumeration).
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            RateLimiter::hit($key, 15 * 60);

            return ApiError::response('INVALID_CREDENTIALS', 'Phone or password is incorrect.', 401);
        }

        if ($user->status === 'inactive') {
            return ApiError::response('USER_INACTIVE', 'Your account is not active. Contact your company.', 403);
        }

        if (! $user->canUseApp()) {
            return ApiError::response('NO_APP_ACCESS', 'The app is for sales reps and delivery men. Please use the web admin panel.', 403);
        }

        RateLimiter::clear($key);

        $deviceId = $data['device']['device_id'];

        if ($tenant->setting('oneDevice')) {
            $user->tokens()->where('name', '!=', 'device:'.$deviceId)->delete();
        }

        $user->tokens()->where('name', 'device:'.$deviceId)->delete();
        Device::updateOrCreate(
            ['user_id' => $user->id, 'device_id' => $deviceId],
            ['model' => $data['device']['model'] ?? null, 'app_version' => $data['device']['app_version'] ?? null],
        );

        $user->forceFill([
            'status' => 'active',
            'last_seen_at' => now(),
        ])->save();

        return response()->json(['data' => [
            'token' => $user->createToken('device:'.$deviceId)->plainTextToken,
            ...MePayload::for($user),
        ]]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => MePayload::for($request->user())]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'new_password' => ['required', 'string', 'min:6', 'max:64'],
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            return ApiError::response('WRONG_CURRENT_PASSWORD', 'The current password is not correct.', 422);
        }

        if ($data['new_password'] === $data['current_password'] || Phone::normalize($data['new_password']) === $user->phone) {
            return ApiError::response('VALIDATION', 'Choose a different password.', 422, ['new_password' => ['Choose a different password.']]);
        }

        $user->forceFill(['password' => $data['new_password'], 'password_changed_at' => now()])->save();

        // Sign out every other phone; keep this one.
        $user->tokens()->where('id', '!=', $user->currentAccessToken()->id)->delete();

        return response()->json(['data' => ['ok' => true]]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['data' => ['ok' => true]]);
    }
}
