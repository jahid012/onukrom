<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Platform side of support: every company's tickets, assign, reply, close. */
class SupportDeskController extends Controller
{
    public function index(Request $request): Response
    {
        $status = (string) $request->query('status', 'open');
        $mine = $request->boolean('mine');

        return Inertia::render('platform/support/index', [
            'status' => $status,
            'mine' => $mine,
            'tickets' => SupportTicket::with('company', 'opener', 'assignee')
                ->when($status !== 'all', fn ($q) => $q->where('status', $status))
                ->when($mine, fn ($q) => $q->where('assigned_to', $request->user()?->id))
                ->orderBy($status === 'open' ? 'last_message_at' : 'id', $status === 'open' ? 'asc' : 'desc')
                ->limit(300)->get()
                ->map(fn (SupportTicket $t) => $t->present())->values(),
            'counts' => SupportTicket::selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status'),
        ]);
    }

    public function show(SupportTicket $ticket): Response
    {
        $ticket->load('messages.author', 'company', 'opener', 'assignee');

        return Inertia::render('platform/support/show', [
            'ticket' => $ticket->present(withMessages: true),
            'team' => User::withoutGlobalScope('tenant')->whereNull('tenant_id')->whereNotNull('platform_role')
                ->where('status', 'active')->orderBy('name')->get(['id', 'name'])->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name]),
        ]);
    }

    public function reply(Request $request, SupportTicket $ticket): RedirectResponse
    {
        $data = $request->validate(['body' => ['required', 'string', 'max:5000'], 'close' => ['boolean']]);

        SupportMessage::create(['ticket_id' => $ticket->id, 'user_id' => $request->user()?->id, 'from_platform' => true, 'body' => $data['body']]);
        $ticket->update([
            'status' => ($data['close'] ?? false) ? 'closed' : 'answered',
            'last_message_at' => now(),
            // Whoever answers first takes the ticket.
            'assigned_to' => $ticket->assigned_to ?? $request->user()?->id,
        ]);

        return back()->with('success', 'Reply sent.');
    }

    public function update(Request $request, SupportTicket $ticket): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['sometimes', 'in:open,answered,closed'],
            'assigned_to' => ['sometimes', 'nullable', 'integer'],
        ]);

        if (array_key_exists('assigned_to', $data) && $data['assigned_to'] !== null) {
            $isStaff = User::withoutGlobalScope('tenant')->whereKey($data['assigned_to'])->whereNull('tenant_id')->whereNotNull('platform_role')->exists();
            abort_unless($isStaff, 422, 'Assign to someone on the support team.');
        }

        $ticket->update($data);

        return back()->with('success', 'Ticket updated.');
    }
}
