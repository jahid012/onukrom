<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Demo requests from the home page: call them back, then create the company. */
class LeadController extends Controller
{
    public function index(Request $request): Response
    {
        $status = (string) $request->query('status', 'new');

        return Inertia::render('platform/leads', [
            'status' => $status,
            'leads' => Lead::when($status !== 'all', fn ($q) => $q->where('status', $status))
                ->latest('id')->limit(500)->get()->map(fn (Lead $l) => $l->present())->values(),
            'counts' => Lead::selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status'),
        ]);
    }

    public function update(Request $request, Lead $lead): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(Lead::STATUSES)],
            'note' => ['nullable', 'string', 'max:255'],
        ]);
        $lead->update($data);

        return back()->with('success', 'Lead updated.');
    }
}
