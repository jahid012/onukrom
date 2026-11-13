<?php

namespace App\Support\Meta;

use App\Models\PlatformSetting;
use App\Support\Phone;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Meta Pixel + Conversions API (server side).
 *
 * The browser Pixel and the server send the same event with the same
 * event_id, so Meta counts it once but still gets it when an ad blocker
 * stops the Pixel. Personal data is SHA-256 hashed before it leaves the
 * server, as Meta requires. Set up in the platform panel → Settings
 * (pixel id, access token, optional test event code).
 *
 * Calls run after the response is sent (no queue worker on cPanel), time out
 * quickly, and never break the page: a failure is only logged.
 */
class MetaConversions
{
    public static function pixelId(): ?string
    {
        $id = trim((string) PlatformSetting::get('meta_pixel_id', ''));

        return preg_match('/^\d{5,20}$/', $id) ? $id : null;
    }

    public static function enabled(): bool
    {
        return self::pixelId() !== null && PlatformSetting::secret('meta_capi_token') !== null;
    }

    public static function newEventId(string $event): string
    {
        return Str::lower($event).'.'.Str::uuid();
    }

    /**
     * What the page needs to fire the browser half of the same event.
     *
     * @param  array<string, mixed>  $customData
     * @return array{pixelId: string|null, eventId: string}
     */
    public static function forPage(string $event, Request $request, array $customData = []): array
    {
        $eventId = self::newEventId($event);
        self::sendLater($event, $eventId, $request, [], $customData);

        return ['pixelId' => self::pixelId(), 'eventId' => $eventId];
    }

    /**
     * Website event: the visitor's browser data comes from the request.
     *
     * @param  array{email?: string|null, phone?: string|null, name?: string|null, external_id?: string|null}  $person
     * @param  array<string, mixed>  $customData
     */
    public static function sendLater(string $event, string $eventId, Request $request, array $person = [], array $customData = []): void
    {
        if (! self::enabled()) {
            return;
        }

        $payload = self::event($event, $eventId, 'website', [
            ...self::hashedPerson($person),
            'client_ip_address' => $request->ip(),
            'client_user_agent' => (string) $request->userAgent(),
            'fbp' => $request->cookie('_fbp'),
            'fbc' => self::fbc($request),
        ], $customData, $request->fullUrl());

        dispatch(fn () => self::post($payload))->afterResponse();
    }

    /**
     * Event that happens on the server only (e.g. a subscription is paid).
     *
     * @param  array{email?: string|null, phone?: string|null, name?: string|null, external_id?: string|null}  $person
     * @param  array<string, mixed>  $customData
     */
    public static function sendSystem(string $event, string $eventId, array $person, array $customData = []): void
    {
        if (! self::enabled()) {
            return;
        }

        $payload = self::event($event, $eventId, 'system_generated', self::hashedPerson($person), $customData, null);
        dispatch(fn () => self::post($payload))->afterResponse();
    }

    /**
     * @param  array<string, mixed>  $userData
     * @param  array<string, mixed>  $customData
     * @return array<string, mixed>
     */
    private static function event(string $event, string $eventId, string $source, array $userData, array $customData, ?string $url): array
    {
        return array_filter([
            'event_name' => $event,
            'event_time' => time(),
            'event_id' => $eventId,
            'action_source' => $source,
            'event_source_url' => $url,
            'user_data' => array_filter([...$userData, 'country' => [hash('sha256', 'bd')]], fn ($v) => $v !== null && $v !== '' && $v !== []),
            'custom_data' => $customData ?: null,
        ], fn ($v) => $v !== null);
    }

    /**
     * Normalised + SHA-256, as Meta asks (phone with country code, no +).
     *
     * @param  array{email?: string|null, phone?: string|null, name?: string|null, external_id?: string|null}  $person
     * @return array<string, list<string>>
     */
    public static function hashedPerson(array $person): array
    {
        $out = [];

        if (filled($person['email'] ?? null)) {
            $out['em'] = [hash('sha256', strtolower(trim((string) $person['email'])))];
        }

        if (filled($person['phone'] ?? null)) {
            $digits = Phone::normalize((string) $person['phone']);
            $out['ph'] = [hash('sha256', str_starts_with($digits, '0') ? '88'.$digits : $digits)];
        }

        if (filled($person['name'] ?? null)) {
            $parts = preg_split('/\s+/', trim(mb_strtolower((string) $person['name']))) ?: [];
            $out['fn'] = [hash('sha256', (string) array_shift($parts))];

            if ($parts !== []) {
                $out['ln'] = [hash('sha256', (string) array_pop($parts))];
            }
        }

        if (filled($person['external_id'] ?? null)) {
            $out['external_id'] = [hash('sha256', (string) $person['external_id'])];
        }

        return $out;
    }

    /** The click id: the Pixel's _fbc cookie, or built from ?fbclid= on the landing URL. */
    private static function fbc(Request $request): ?string
    {
        $cookie = $request->cookie('_fbc');

        if (is_string($cookie) && $cookie !== '') {
            return $cookie;
        }

        $clickId = $request->query('fbclid');

        return is_string($clickId) && $clickId !== '' ? 'fb.1.'.(int) (microtime(true) * 1000).'.'.$clickId : null;
    }

    /**
     * Send one website event right away and report Meta's answer (the
     * platform's "Send test event" button).
     *
     * @return array{ok: bool, message: string}
     */
    public static function sendNow(string $event, string $eventId, Request $request): array
    {
        $pixel = self::pixelId();
        $token = PlatformSetting::secret('meta_capi_token');

        if ($pixel === null || $token === null) {
            return ['ok' => false, 'message' => 'Pixel ID or access token missing.'];
        }

        try {
            $response = Http::timeout(6)->asJson()->post(
                'https://graph.facebook.com/'.config('services.meta.graph_version').'/'.$pixel.'/events',
                array_filter([
                    'data' => [self::event($event, $eventId, 'website', [
                        'client_ip_address' => $request->ip(),
                        'client_user_agent' => (string) $request->userAgent(),
                    ], [], $request->fullUrl())],
                    'test_event_code' => PlatformSetting::get('meta_test_event_code') ?: null,
                    'access_token' => $token,
                ]),
            );
        } catch (Throwable $e) {
            return ['ok' => false, 'message' => $e->getMessage()];
        }

        return $response->successful()
            ? ['ok' => true, 'message' => 'events received: '.(int) $response->json('events_received')]
            : ['ok' => false, 'message' => (string) ($response->json('error.message') ?? 'HTTP '.$response->status())];
    }

    /** @param  array<string, mixed>  $event */
    public static function post(array $event): void
    {
        $pixel = self::pixelId();
        $token = PlatformSetting::secret('meta_capi_token');

        if ($pixel === null || $token === null) {
            return;
        }

        try {
            $response = Http::timeout(4)->asJson()->post(
                'https://graph.facebook.com/'.config('services.meta.graph_version').'/'.$pixel.'/events',
                array_filter([
                    'data' => [$event],
                    'test_event_code' => PlatformSetting::get('meta_test_event_code') ?: null,
                    'access_token' => $token,
                ]),
            );

            if ($response->failed()) {
                Log::warning('Meta Conversions API refused an event', ['event' => $event['event_name'] ?? null, 'status' => $response->status(), 'error' => $response->json('error.message')]);
            }
        } catch (Throwable $e) {
            Log::warning('Meta Conversions API not reachable', ['event' => $event['event_name'] ?? null, 'error' => $e->getMessage()]);
        }
    }
}
