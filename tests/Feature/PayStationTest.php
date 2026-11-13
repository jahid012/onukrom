<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PlatformSetting;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Billing\Billing;
use App\Support\Tenancy\CompanySetup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PayStationTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $owner;

    private Invoice $invoice;

    protected function setUp(): void
    {
        parent::setUp();

        PlatformSetting::put('paystation_merchant_id', '104-1653730183');
        PlatformSetting::putSecret('paystation_password', 'test-pass');
        PlatformSetting::put('paystation_mode', 'sandbox');

        $r = CompanySetup::create(['code' => 'acme', 'name' => 'Acme'], ['name' => 'Rahim Uddin', 'email' => 'owner@acme.test', 'phone' => '01711000000', 'password' => 'secret-pass-1']);
        $this->tenant = $r['tenant'];
        $this->owner = $r['owner'];
        $this->tenant->update(['trial_ends_at' => now()->addDays(2)->toDateString()]);
        $invoice = Billing::ensureInvoice($this->tenant);
        $this->assertInstanceOf(Invoice::class, $invoice);
        $this->invoice = $invoice;
    }

    /** @param  array<string, mixed>  $data */
    private function fakeStatus(string $trxStatus, array $data = []): void
    {
        // A fresh fake each time: Http::fake() adds to earlier stubs, first match wins.
        Http::swap(new HttpFactory);
        Http::fake([
            'sandbox.paystation.com.bd/initiate-payment' => Http::response(['status_code' => '200', 'status' => 'success', 'payment_url' => 'https://sandbox.paystation.com.bd/checkout/123/abc']),
            'sandbox.paystation.com.bd/transaction-status' => Http::response(['status_code' => '200', 'status' => 'success', 'data' => [
                'invoice_number' => 'x', 'trx_status' => $trxStatus, 'trx_id' => $trxStatus === 'Success' ? 'TRX123' : '',
                'payment_amount' => '1500.00', 'payment_method' => $trxStatus === 'Success' ? 'bKash' : '', 'payer_mobile_no' => '017*****', ...$data,
            ]]),
            'graph.facebook.com/*' => Http::response([]),
        ]);
    }

    private function payOnline(): Payment
    {
        $this->actingAs($this->owner)->post("/billing/invoices/{$this->invoice->id}/pay-online")
            ->assertRedirect('https://sandbox.paystation.com.bd/checkout/123/abc');

        return Payment::latest('id')->firstOrFail();
    }

    public function test_pay_online_starts_a_checkout_with_the_invoice_amount(): void
    {
        $this->fakeStatus('Processing');
        $payment = $this->payOnline();

        $this->assertSame($this->invoice->number.'-P1', $payment->gateway_invoice);
        Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/initiate-payment')
            && $r['merchantId'] === '104-1653730183'
            && $r['password'] === 'test-pass'
            && $r['invoice_number'] === $payment->gateway_invoice
            && (int) $r['payment_amount'] === 1500
            && $r['cust_phone'] === '01711000000'
            && $r['cust_email'] === 'owner@acme.test'
            && $r['callback_url'] === route('billing.paystation.return', $payment));

        // A second attempt gets a new gateway number (PayStation refuses duplicates).
        $this->assertSame($this->invoice->number.'-P2', $this->payOnline()->gateway_invoice);
    }

    public function test_return_marks_paid_only_after_paystation_confirms(): void
    {
        $this->fakeStatus('Success');
        $payment = $this->payOnline();

        // Even a POST back without our session works: it only re-checks with PayStation.
        auth()->logout();
        $this->post("/billing/paystation/return/{$payment->id}")->assertRedirect('/billing')
            ->assertSessionHas('success');

        $invoice = $this->invoice->fresh();
        $this->assertSame('paid', $invoice?->status);
        $this->assertSame('paystation:bkash', $invoice?->payment_method);
        $this->assertSame('TRX123', $invoice?->payment_reference);
        $this->assertSame('active', $this->tenant->fresh()?->subscriptionStatus());
        $this->assertSame('success', $payment->fresh()?->status);
        Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/transaction-status')
            && $r->header('merchantId') === ['104-1653730183']
            && $r['invoice_number'] === $payment->gateway_invoice);
    }

    public function test_failed_or_underpaid_payments_leave_the_invoice_open(): void
    {
        $this->fakeStatus('Failed');
        $payment = $this->payOnline();
        $this->get("/billing/paystation/return/{$payment->id}")->assertSessionHas('error');
        $this->assertSame('unpaid', $this->invoice->fresh()?->status);

        $this->fakeStatus('Success', ['payment_amount' => '100.00']);
        $payment = $this->payOnline();
        $this->get("/billing/paystation/return/{$payment->id}")->assertSessionHas('error');
        $this->assertSame('unpaid', $this->invoice->fresh()?->status);
        $this->assertSame('failed', $payment->fresh()?->status);
    }

    public function test_ipn_is_verified_retried_while_pending_and_never_pays_twice(): void
    {
        $this->fakeStatus('Processing');
        $payment = $this->payOnline();
        $ipn = ['invoice_number' => $payment->gateway_invoice, 'trx_status' => 'Success', 'trx_id' => 'TRX123', 'trx_amount' => 1500];

        // PayStation's own status API does not confirm it yet → ask for a retry.
        $this->postJson('/api/paystation/ipn', $ipn)->assertStatus(503);
        $this->assertSame('unpaid', $this->invoice->fresh()?->status);

        $this->fakeStatus('Success');
        $this->postJson('/api/paystation/ipn', $ipn)->assertOk()->assertJson(['status' => 'success']);
        $this->postJson('/api/paystation/ipn', $ipn)->assertOk(); // retried IPN: no double credit
        $this->assertSame('paid', $this->invoice->fresh()?->status);
        $this->assertSame($this->invoice->period_end->toDateString(), $this->tenant->fresh()?->paid_until?->toDateString());

        $this->postJson('/api/paystation/ipn', ['invoice_number' => 'NOPE'])->assertNotFound();
    }

    public function test_without_credentials_the_owner_is_told_to_pay_by_hand(): void
    {
        PlatformSetting::putSecret('paystation_password', null);
        Http::fake();

        $this->actingAs($this->owner)->post("/billing/invoices/{$this->invoice->id}/pay-online")
            ->assertSessionHas('error');
        Http::assertNothingSent();
    }
}
