<?php

namespace App\Admin;

use RuntimeException;

/** A refused admin action; the message is shown to the user as a toast. */
class AdminError extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 422)
    {
        parent::__construct($message);
    }
}
