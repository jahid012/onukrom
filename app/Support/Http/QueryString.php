<?php

namespace App\Support\Http;

/**
 * Work-around for the production host: about half of its PHP workers hand
 * over an empty $_GET even though the URL has a query string (REQUEST_URI
 * still has it). The app then saw "?entity=products" as no entity at all
 * and company lookups as no company code.
 *
 * Called from public/index.php before Laravel reads the request: when $_GET
 * is empty but the request line carries a query, rebuild it from there.
 */
final class QueryString
{
    /**
     * @param  array<array-key, mixed>  $get  usually $_GET
     * @param  array<array-key, mixed>  $server  usually $_SERVER
     * @return bool whether anything was restored
     */
    public static function repair(array &$get, array &$server): bool
    {
        if ($get !== []) {
            return false;
        }

        $query = (string) ($server['QUERY_STRING'] ?? '');

        if ($query === '') {
            $uri = (string) ($server['REQUEST_URI'] ?? '');
            $at = strpos($uri, '?');

            if ($at === false) {
                return false;
            }

            $query = explode('#', substr($uri, $at + 1), 2)[0];
        }

        if ($query === '') {
            return false;
        }

        parse_str($query, $parsed);

        if ($parsed === []) {
            return false;
        }

        $get = $parsed;
        $server['QUERY_STRING'] = $query;

        return true;
    }
}
