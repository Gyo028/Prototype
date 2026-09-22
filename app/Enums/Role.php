<?php

namespace App\Enums;

enum Role: string
{
    case Customer = 'customer';
    case ProjectManager = 'project_manager';
    case DesignSpecialist = 'design_specialist';
    case Bookkeeper = 'bookkeeper';
    case Owner = 'owner';
    case TechnicalAdmin = 'technical_admin';

    public function label(): string
    {
        return match ($this) {
            self::Customer => 'Customer',
            self::ProjectManager => 'Project Manager',
            self::DesignSpecialist => 'Design Specialist',
            self::Bookkeeper => 'Bookkeeper',
            self::Owner => 'Owner',
            self::TechnicalAdmin => 'Technical Admin',
        };
    }

    /**
     * Name of the route this role lands on after login.
     * Roles without their own dashboard yet use the generic one ('dashboard').
     */
    public function homeRoute(): string
    {
        return match ($this) {
            self::Customer => 'customer.dashboard',
            self::TechnicalAdmin => 'technical-admin.dashboard',
            default => 'dashboard',
        };
    }
}
