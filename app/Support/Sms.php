<?php

namespace App\Support;

use App\Models\SmsMessage;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * SMS through Alpha SMS (sms.net.bd), spec §4.1.
 * Without ALPHA_SMS_API_KEY the message is only written to the log — handy locally.
 * Passwords are masked before the text is stored.
 */
class Sms
{
    public static function send(User $user, string $type, string $body, ?string $secret = null): SmsMessage
    {
        $message = SmsMessage::create([
            'user_id' => $user->id,
            'phone' => $user->phone,
            'type' => $type,
            'body_masked' => $secret ? str_replace($secret, str_repeat('•', strlen($secret)), $body) : $body,
            'provider' => config('services.alpha_sms.key') ? 'alpha_sms' : 'log',
            'status' => 'queued',
        ]);

        $key = config('services.alpha_sms.key');

        if (! $key) {
            Log::info('SMS (not sent, no ALPHA_SMS_API_KEY)', ['to' => $user->phone, 'body' => $body]);
            $message->update(['status' => 'sent']);

            return $message;
        }

        try {
            $response = Http::asForm()->timeout(10)->post('https://api.sms.net.bd/sendsms', array_filter([
                'api_key' => $key,
                'msg' => $body,
                'to' => '88'.$user->phone,
                'sender_id' => config('services.alpha_sms.sender_id'),
            ]));
            $ok = $response->ok() && (int) $response->json('error', 1) === 0;
            $message->update(['status' => $ok ? 'sent' : 'failed', 'error' => $ok ? null : substr((string) $response->json('msg', $response->body()), 0, 250)]);
        } catch (Throwable $e) {
            $message->update(['status' => 'failed', 'error' => substr($e->getMessage(), 0, 250)]);
        }

        return $message;
    }

    /** 8 characters, no look-alikes (0/o, 1/l/i). */
    public static function password(): string
    {
        $alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';

        return collect(range(1, 8))->map(fn () => $alphabet[random_int(0, strlen($alphabet) - 1)])->implode('');
    }
}
