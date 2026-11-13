<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Onukrom's own staff: super admins and the support team they hire. */
class TeamController extends Controller
{
    public const ROLES = ['super_admin', 'support'];

    public function index(): Response
    {
        return Inertia::render('platform/team', [
            'members' => $this->team()->orderBy('id')->get()->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->platform_role,
                'status' => $u->status,
                'lastSeen' => $u->last_seen_at?->toIso8601String(),
            ])->values(),
        ]);
    }

    /** Hire: the password is generated and shown once to the super admin. */
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'role' => ['required', Rule::in(self::ROLES)],
        ]);
        $password = Str::password(14, symbols: false);

        $user = User::withoutGlobalScope('tenant')->create([
            'tenant_id' => null,
            'platform_role' => $data['role'],
            'name' => $data['name'],
            'email' => strtolower($data['email']),
            'email_verified_at' => now(),
            'password' => $password,
            'status' => 'active',
        ]);

        return back()->with('success', $user->name.' added to the team.')->with('secret', $user->email.' / '.$password);
    }

    public function update(Request $request, int $member): RedirectResponse
    {
        $user = $this->team()->findOrFail($member);
        $data = $request->validate([
            'role' => ['required', Rule::in(self::ROLES)],
            'status' => ['required', 'in:active,inactive'],
        ]);

        // Never lock the platform out of its last super admin.
        $otherAdmins = $this->team()->where('platform_role', 'super_admin')->where('status', 'active')->whereKeyNot($user->id)->count();
        if ($user->platform_role === 'super_admin' && ($data['role'] !== 'super_admin' || $data['status'] !== 'active') && $otherAdmins === 0) {
            return back()->with('error', 'Keep at least one active super admin.');
        }

        $user->forceFill(['platform_role' => $data['role'], 'status' => $data['status']])->save();

        if ($data['status'] === 'inactive') {
            $user->tokens()->delete();
        }

        return back()->with('success', $user->name.' updated.');
    }

    /** @return Builder<User> */
    private function team()
    {
        return User::withoutGlobalScope('tenant')->whereNull('tenant_id')->whereNotNull('platform_role');
    }
}
