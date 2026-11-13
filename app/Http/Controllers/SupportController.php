<?php

namespace App\Http\Controllers;

use App\Models\PlatformSetting;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** A company's questions to Onukrom support (office users, any role). */
class SupportController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('support/index', [
            'tickets' => SupportTicket::with('opener', 'assignee')
                ->where('tenant_id', $this->user($request)->tenant_id)
                ->orderByRaw("CASE status WHEN 'answered' THEN 0 WHEN 'open' THEN 1 ELSE 2 END")
                ->latest('last_message_at')->get()
                ->map(fn (SupportTicket $t) => $t->present())->values(),
            'categories' => SupportTicket::CATEGORIES,
            'supportPhone' => PlatformSetting::get('support_phone', ''),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $this->user($request);
        $data = $request->validate([
            'subject' => ['required', 'string', 'max:150'],
            'category' => ['required', Rule::in(SupportTicket::CATEGORIES)],
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $ticket = SupportTicket::create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'number' => SupportTicket::nextNumber(),
            'subject' => $data['subject'],
            'category' => $data['category'],
            'status' => 'open',
            'last_message_at' => now(),
        ]);
        SupportMessage::create(['ticket_id' => $ticket->id, 'user_id' => $user->id, 'body' => $data['body']]);

        return redirect()->route('support.show', $ticket)->with('success', 'Sent. Our team will reply here.');
    }

    public function show(Request $request, SupportTicket $ticket): Response
    {
        $this->authorizeTicket($request, $ticket);
        $ticket->load('messages.author', 'opener', 'assignee');

        return Inertia::render('support/show', ['ticket' => $ticket->present(withMessages: true)]);
    }

    public function reply(Request $request, SupportTicket $ticket): RedirectResponse
    {
        $this->authorizeTicket($request, $ticket);
        $data = $request->validate(['body' => ['required', 'string', 'max:5000']]);

        SupportMessage::create(['ticket_id' => $ticket->id, 'user_id' => $request->user()?->id, 'body' => $data['body']]);
        // A reply from the company reopens the ticket for support.
        $ticket->update(['status' => 'open', 'last_message_at' => now()]);

        return back();
    }

    public function close(Request $request, SupportTicket $ticket): RedirectResponse
    {
        $this->authorizeTicket($request, $ticket);
        $ticket->update(['status' => 'closed']);

        return back()->with('success', 'Ticket closed.');
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }

    /** Route binding runs before the tenant filter, so check the owner here. */
    private function authorizeTicket(Request $request, SupportTicket $ticket): void
    {
        abort_unless($ticket->tenant_id === $this->user($request)->tenant_id, 404);
    }
}
