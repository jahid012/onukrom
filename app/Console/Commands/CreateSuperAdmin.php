<?php

namespace App\Console\Commands;

use App\Support\Tenancy\PlatformAdmin;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use InvalidArgumentException;

class CreateSuperAdmin extends Command
{
    protected $signature = 'onukrom:create-super-admin
        {email : Login email for the platform panel}
        {--name= : Full name}
        {--password= : Password (default: a random one, printed once)}';

    protected $description = 'Create an Onukrom super admin (manages companies, billing, support, the team)';

    public function handle(): int
    {
        $input = [
            'email' => (string) $this->argument('email'),
            'name' => $this->option('name') ?? $this->ask('Full name'),
            'password' => $this->option('password'),
        ];

        $validator = Validator::make($input, PlatformAdmin::rules());

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        try {
            $result = PlatformAdmin::create([
                'name' => (string) $input['name'],
                'email' => $input['email'],
                'password' => $input['password'] ? (string) $input['password'] : null,
            ]);
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info('Super admin ready: '.$result['user']->email.' — sign in at /login, you land in /platform.');

        if (! $this->option('password')) {
            $this->line('Password (shown once): '.$result['password']);
        }

        return self::SUCCESS;
    }
}
