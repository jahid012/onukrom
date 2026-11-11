<?php

namespace App\Support;

/** Bangladeshi mobile numbers, stored as 11 digits: 01XXXXXXXXX. */
class Phone
{
    public static function normalize(?string $phone): string
    {
        $digits = preg_replace('/\D+/', '', (string) $phone) ?? '';

        if (str_starts_with($digits, '880')) {
            $digits = substr($digits, 2);
        }

        return $digits;
    }

    public static function isValid(?string $phone): bool
    {
        return (bool) preg_match('/^01[3-9]\d{8}$/', self::normalize($phone));
    }

    /** 01712345678 → 01712-345678 (display). */
    public static function format(?string $phone): string
    {
        $p = self::normalize($phone);

        return strlen($p) === 11 ? substr($p, 0, 5).'-'.substr($p, 5) : $p;
    }
}
