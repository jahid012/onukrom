<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A company's question to Onukrom support. Status: open (waiting for
 * support), answered (waiting for the company), closed.
 *
 * @property int $id
 * @property int $tenant_id
 * @property int|null $user_id
 * @property string $number
 * @property string $subject
 * @property string $category
 * @property string $status
 * @property int|null $assigned_to
 * @property CarbonInterface|null $last_message_at
 * @property CarbonInterface|null $created_at
 */
class SupportTicket extends Model
{
    use BelongsToTenant;

    public const CATEGORIES = ['how_to', 'technical', 'billing', 'other'];

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['last_message_at' => 'datetime'];
    }

    /**
     * @return HasMany<SupportMessage, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(SupportMessage::class, 'ticket_id')->orderBy('id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function opener(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to')->withoutGlobalScope('tenant');
    }

    /**
     * @return BelongsTo<Tenant, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    /** New ticket number, unique across companies: T-000123. */
    public static function nextNumber(): string
    {
        return 'T-'.str_pad((string) (self::withoutGlobalScopes()->max('id') + 1), 6, '0', STR_PAD_LEFT);
    }

    /** @return array<string, mixed> */
    public function present(bool $withMessages = false): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'subject' => $this->subject,
            'category' => $this->category,
            'status' => $this->status,
            'company' => $this->relationLoaded('company') ? $this->company?->only('id', 'name', 'code') : null,
            'openedBy' => $this->opener?->name,
            'assignee' => $this->assignee?->name,
            'assignedTo' => $this->assigned_to,
            'lastMessageAt' => ($this->last_message_at ?? $this->created_at)?->toIso8601String(),
            'createdAt' => $this->created_at?->toIso8601String(),
            'messages' => $withMessages
                ? $this->messages->map(fn (SupportMessage $m) => [
                    'id' => $m->id,
                    'body' => $m->body,
                    'fromPlatform' => $m->from_platform,
                    'author' => $m->author->name ?? '—',
                    'at' => $m->created_at?->toIso8601String(),
                ])->values()->all()
                : [],
        ];
    }
}
