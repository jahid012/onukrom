<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;

/** Error envelope used by the mobile API (spec §12.1 / §12.3). */
class ApiError
{
    /** @param  array<string, mixed>  $fields  per-field validation messages */
    public static function response(string $code, string $message, int $status, array $fields = []): JsonResponse
    {
        return response()->json(['error' => array_filter([
            'code' => $code,
            'message' => $message,
            'fields' => $fields ?: null,
        ])], $status);
    }
}
