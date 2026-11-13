<?php

namespace App\Models;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

/** Small key/value settings for the platform (e.g. how owners pay). */
class PlatformSetting extends Model
{
    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    public static function get(string $key, ?string $default = null): ?string
    {
        return self::find($key)->value ?? $default;
    }

    public static function put(string $key, ?string $value): void
    {
        self::updateOrCreate(['key' => $key], ['value' => $value]);
    }

    /** A secret (e.g. an API token), stored encrypted with APP_KEY. */
    public static function secret(string $key): ?string
    {
        $value = self::get($key);

        if ($value === null || $value === '') {
            return null;
        }

        try {
            return Crypt::decryptString($value);
        } catch (DecryptException) {
            return null; // APP_KEY changed: the token must be entered again
        }
    }

    public static function putSecret(string $key, ?string $value): void
    {
        self::put($key, $value === null || $value === '' ? null : Crypt::encryptString($value));
    }
}
