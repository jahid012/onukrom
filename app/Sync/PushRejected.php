<?php

namespace App\Sync;

use RuntimeException;

/** A business rule refused a pushed record (spec §12.3 error codes). */
class PushRejected extends RuntimeException
{
    public function __construct(public readonly string $errorCode, string $message)
    {
        parent::__construct($message);
    }
}
