<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;

/**
 * A demo request from the home page (platform-wide, not a company's data).
 *
 * @property int $id
 * @property string $name
 * @property string $phone
 * @property string|null $company
 * @property string|null $district
 * @property string|null $team_size
 * @property string|null $message
 * @property string $status new | contacted | converted | lost
 * @property string|null $note
 * @property int|null $tenant_id
 * @property string|null $locale
 * @property array<string, string>|null $utm
 * @property string|null $fbp
 * @property string|null $fbc
 * @property string|null $ip
 * @property string|null $user_agent
 * @property string|null $event_id
 * @property CarbonInterface|null $created_at
 */
class Lead extends Model
{
    public const TEAM_SIZES = ['1-5', '6-15', '16-40', '40+'];

    public const STATUSES = ['new', 'contacted', 'converted', 'lost'];

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['utm' => 'array'];
    }

    /** @return array<string, mixed> */
    public function present(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
            'company' => $this->company,
            'district' => $this->district,
            'teamSize' => $this->team_size,
            'message' => $this->message,
            'status' => $this->status,
            'note' => $this->note,
            'tenantId' => $this->tenant_id,
            'source' => $this->utm['utm_source'] ?? ($this->fbc ? 'facebook' : null),
            'campaign' => $this->utm['utm_campaign'] ?? null,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
