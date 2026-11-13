<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\Plan;
use App\Models\PlatformSetting;
use App\Support\Meta\MetaConversions;
use App\Support\Phone;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The public site: home page, terms, privacy, and the demo-request form.
 * Each page view is also sent to Meta from the server (same event id as the
 * browser Pixel, so it is counted once).
 */
class PublicController extends Controller
{
    public const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

    public function home(Request $request): Response
    {
        // Phone screenshots are optional: show only the ones that exist.
        $shots = collect(glob(public_path('images/home/app-*.webp')) ?: [])
            ->map(fn (string $f) => '/images/home/'.basename($f))->sort()->values();

        return Inertia::render('welcome', [
            ...$this->site($request, 'PageView'),
            'appShots' => $shots,
            'plans' => Plan::where('is_active', true)->orderBy('sort')->get()
                ->map(fn (Plan $p) => ['key' => $p->key, 'name' => $p->name, 'name_bn' => $p->name_bn, 'price' => $p->price / 100, 'staffLimit' => $p->staff_limit]),
            'teamSizes' => Lead::TEAM_SIZES,
        ]);
    }

    public function terms(Request $request): Response
    {
        return Inertia::render('legal/terms', $this->site($request, 'PageView'));
    }

    public function privacy(Request $request): Response
    {
        return Inertia::render('legal/privacy', $this->site($request, 'PageView'));
    }

    /** Demo request → saved for the platform team + a Lead event for Meta. */
    public function lead(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['required', 'string', 'max:20', function (string $attr, mixed $value, \Closure $fail): void {
                if (! Phone::isValid((string) $value)) {
                    $fail(__('Enter a Bangladeshi mobile number (01XXXXXXXXX).'));
                }
            }],
            'company' => ['nullable', 'string', 'max:150'],
            'district' => ['nullable', 'string', 'max:60'],
            'team_size' => ['nullable', Rule::in(Lead::TEAM_SIZES)],
            'message' => ['nullable', 'string', 'max:1000'],
            'utm' => ['nullable', 'array'],
            'utm.*' => ['nullable', 'string', 'max:150'],
            'event_id' => ['nullable', 'string', 'max:80'],
            // Honeypot: real people never see this field.
            'website' => ['prohibited'],
        ]);

        $eventId = $data['event_id'] ?? MetaConversions::newEventId('Lead');
        $lead = Lead::create([
            'name' => trim($data['name']),
            'phone' => Phone::normalize($data['phone']),
            'company' => $data['company'] ?? null,
            'district' => $data['district'] ?? null,
            'team_size' => $data['team_size'] ?? null,
            'message' => $data['message'] ?? null,
            'locale' => app()->getLocale(),
            'utm' => array_filter(array_intersect_key($data['utm'] ?? [], array_flip(self::UTM))) ?: null,
            'fbp' => $request->cookie('_fbp'),
            'fbc' => $request->cookie('_fbc'),
            'ip' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 255),
            'event_id' => $eventId,
        ]);

        MetaConversions::sendLater('Lead', $eventId, $request, [
            'phone' => $lead->phone,
            'name' => $lead->name,
            'external_id' => 'lead-'.$lead->id,
        ], array_filter(['content_name' => 'Demo request', 'team_size' => $lead->team_size]));

        return back()->with('lead', true);
    }

    /**
     * Props every public page needs: Pixel id + this view's event id, the
     * contact numbers, and the legal identity.
     *
     * @return array<string, mixed>
     */
    private function site(Request $request, string $event): array
    {
        $phone = (string) PlatformSetting::get('support_phone', '');

        return [
            'meta' => MetaConversions::forPage($event, $request),
            'contact' => [
                'phone' => $phone,
                'whatsapp' => (string) PlatformSetting::get('whatsapp', '') ?: $phone,
                'email' => (string) PlatformSetting::get('contact_email', ''),
                'address' => (string) PlatformSetting::get('business_address', ''),
                'legalName' => (string) PlatformSetting::get('legal_name', '') ?: 'Onukrom',
            ],
            'leadSent' => (bool) $request->session()->get('lead', false),
        ];
    }
}
