<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Support\Billing\Billing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * PayStation's server-to-server notice after a successful payment
 * (POST JSON: invoice_number, trx_status, trx_id, trx_amount, …).
 *
 * The body is not trusted: it only tells us which attempt to check, and
 * Billing::settleOnline() asks PayStation itself. Answering non-2xx makes
 * PayStation retry, which we want only while it cannot confirm the payment yet.
 */
class PayStationIpnController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $number = (string) $request->json('invoice_number', $request->input('invoice_number', ''));
        Log::info('PayStation IPN', ['invoice' => $number, 'trx_status' => $request->json('trx_status'), 'trx_id' => $request->json('trx_id')]);

        $payment = $number !== '' ? Payment::where('gateway_invoice', $number)->first() : null;

        if ($payment === null) {
            return response()->json(['status' => 'unknown invoice'], 404);
        }

        $outcome = Billing::settleOnline($payment);

        // Not confirmed by PayStation's own status API yet: ask for a retry.
        return $outcome === 'processing'
            ? response()->json(['status' => 'pending'], 503)
            : response()->json(['status' => 'success']);
    }
}
