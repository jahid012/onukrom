<?php

/*
 * Fingerprint of the production packages in composer.lock (name@version).
 * Written into vendor/.lock-hash when the vendor zip is built, and compared by
 * the deploy pipeline so code is never uploaded on top of an older vendor/.
 *
 *   php deploy/lock-hash.php composer.lock
 */
$lock = json_decode((string) file_get_contents($argv[1] ?? 'composer.lock'), true);

if (! is_array($lock) || ! isset($lock['packages'])) {
    fwrite(STDERR, "Not a composer.lock file.\n");
    exit(1);
}

echo sha1(implode("\n", array_map(fn (array $p) => $p['name'].'@'.$p['version'], $lock['packages'])));
