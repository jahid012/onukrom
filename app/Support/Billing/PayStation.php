<?php

namespace App\Support\Billing;

use App\Models\PlatformSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/**
 * PayStation hosted checkout (https://www.paystation.com.bd/documentation).
 *
 *   initiate()  POST /initiate-payment      → payment_url to send the owner to
 *   status()    POST /transaction-status    → the truth about an invoice number
 *
 * The browser callback and the IPN are never trusted on their own: both end
 * in status(), and only a "success" for the full amount marks an invoice paid.
 * Merchant ID / password / sandbox-or-live are set in Platform → Settings.
 */
class PayStation
{
    public const SANDBOX = 'https://sandbox.paystation.com.bd';

    public const LIVE = 'https://api.paystation.com.bd';

    public static function enabled(): bool
    {
        return self::merchantId() !== null && PlatformSetting::secret('paystation_password') !== null;
    }

    public static function merchantId(): ?string
    {
        $id = trim((string) PlatformSetting::get('paystation_merchant_id', ''));

        return $id !== '' ? $id : null;
    }

    public static function baseUrl(): string
    {
        return PlatformSetting::get('paystation_mode', 'sandbox') === 'live' ? self::LIVE : self::SANDBOX;
    }

    /**
     * Create the hosted checkout and return its URL.
     *
     * @param  array{invoice_number: string, amount_taka: int, name: string, phone: string, email: string, address?: string|null, callback_url: string, reference?: string, items?: string}  $p
     */
    public static function initiate(array $p): string
    {
        $merchant = self::merchantId();
        $password = PlatformSetting::secret('paystation_password');

        if ($merchant === null || $password === null) {
            throw new RuntimeException('Online payment is not set up yet.');
        }

        try {
            $response = Http::asForm()->acceptJson()->timeout(20)->post(self::baseUrl().'/initiate-payment', array_filter([
                'merchantId' => $merchant,
                'password' => $password,
                'invoice_number' => $p['invoice_number'],
                'currency' => 'BDT',
                'payment_amount' => $p['amount_taka'],
                'pay_with_charge' => PlatformSetting::get('paystation_pay_with_charge') === '1' ? 1 : 0,
                'reference' => $p['reference'] ?? null,
                'cust_name' => $p['name'],
                'cust_phone' => $p['phone'],
                'cust_email' => $p['email'],
                'cust_address' => $p['address'] ?? null,
                'callback_url' => $p['callback_url'],
                'checkout_items' => $p['items'] ?? null,
            ], fn ($v) => $v !== null && $v !== ''));
        } catch (Throwable $e) {
            Log::warning('PayStation not reachable', ['error' => $e->getMessage()]);

            throw new RuntimeException('The payment service is not reachable. Please try again in a minute.');
        }

        $body = $response->json() ?? [];

        if ((string) ($body['status_code'] ?? '') !== '200' || empty($body['payment_url'])) {
            Log::warning('PayStation refused a payment', ['invoice' => $p['invoice_number'], 'answer' => $body]);

            throw new RuntimeException('The payment could not be started: '.($body['message'] ?? 'unknown error').'.');
        }

        return (string) $body['payment_url'];
    }

    /**
     * Ask PayStation what happened to a gateway invoice number.
     *
     * @return array{found: bool, status: string, trx_id: string|null, amount: float|null, method: string|null, payer: string|null, raw: array<string, mixed>}
     *                                                                                                                                                         status: success | processing | failed | refund | unknown
     */
    public static function status(string $gatewayInvoice): array
    {
        $merchant = self::merchantId();
        $none = ['found' => false, 'status' => 'unknown', 'trx_id' => null, 'amount' => null, 'method' => null, 'payer' => null, 'raw' => []];

        if ($merchant === null) {
            return $none;
        }

        try {
            $response = Http::asForm()->acceptJson()->timeout(15)
                ->withHeaders(['merchantId' => $merchant])
                ->post(self::baseUrl().'/transaction-status', ['invoice_number' => $gatewayInvoice]);
        } catch (Throwable $e) {
            Log::warning('PayStation status not reachable', ['invoice' => $gatewayInvoice, 'error' => $e->getMessage()]);

            return $none;
        }

        $body = $response->json() ?? [];
        $data = is_array($body['data'] ?? null) ? $body['data'] : null;

        if ((string) ($body['status_code'] ?? '') !== '200' || $data === null) {
            return [...$none, 'raw' => $body];
        }

        $status = strtolower(trim((string) ($data['trx_status'] ?? '')));

        return [
            'found' => true,
            'status' => in_array($status, ['success', 'processing', 'failed', 'refund'], true) ? $status : 'unknown',
            'trx_id' => filled($data['trx_id'] ?? null) ? (string) $data['trx_id'] : null,
            'amount' => is_numeric($data['payment_amount'] ?? null) ? (float) $data['payment_amount'] : null,
            'method' => filled($data['payment_method'] ?? null) ? (string) $data['payment_method'] : null,
            'payer' => filled($data['payer_mobile_no'] ?? null) ? (string) $data['payer_mobile_no'] : null,
            'raw' => $body,
        ];
    }
}
