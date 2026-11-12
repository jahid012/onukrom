<?php

namespace App\Console\Commands;

use App\Support\Tenancy\CompanySetup;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

class CreateCompany extends Command
{
    protected $signature = 'onukrom:create-company
        {code : Company code staff type in the mobile app (e.g. rahimtraders)}
        {name : Company name}
        {--owner= : Owner\'s full name}
        {--email= : Owner\'s admin-panel login email}
        {--phone= : Owner\'s mobile number (optional)}
        {--password= : Owner\'s password (default: a random one, printed once)}';

    protected $description = 'Create a company with its built-in roles, warehouses and an owner login';

    public function handle(): int
    {
        $input = [
            'code' => strtolower((string) $this->argument('code')),
            'name' => $this->argument('name'),
            'owner_name' => $this->option('owner') ?? $this->ask('Owner\'s full name'),
            'email' => $this->option('email') ?? $this->ask('Owner\'s login email'),
            'phone' => $this->option('phone'),
            'password' => $this->option('password'),
        ];

        $validator = Validator::make($input, CompanySetup::rules());

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $result = CompanySetup::create(
            ['code' => $input['code'], 'name' => $input['name']],
            ['name' => $input['owner_name'], 'email' => $input['email'], 'phone' => $input['phone'], 'password' => $input['password']],
        );

        $this->info("Company \"{$result['tenant']->name}\" created (code: {$result['tenant']->code}).");
        $this->line("Admin panel login: {$result['owner']->email}");

        if (! $input['password']) {
            $this->line("Password: {$result['password']}  (shown once; change it under Settings → Password)");
        }

        return self::SUCCESS;
    }
}
