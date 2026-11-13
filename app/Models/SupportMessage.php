<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One message in a support ticket (scoped through its ticket).
 *
 * @property int $id
 * @property int $ticket_id
 * @property int|null $user_id
 * @property bool $from_platform
 * @property string $body
 */
class SupportMessage extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['from_platform' => 'boolean'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        // Platform staff have no company: skip the tenant filter.
        return $this->belongsTo(User::class, 'user_id')->withoutGlobalScope('tenant');
    }

    /**
     * @return BelongsTo<SupportTicket, $this>
     */
    public function ticket(): BelongsTo
    {
        return $this->belongsTo(SupportTicket::class, 'ticket_id');
    }
}
