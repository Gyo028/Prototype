<?php

namespace App\Enums;

/** Kinds of project expenses (project_expenses.expense_type). */
enum ExpenseType: string
{
    case Materials = 'materials';
    case Fabrication = 'fabrication';
    case EquipmentRental = 'equipment_rental';
    case Labor = 'labor';
    case Transportation = 'transportation';

    public function label(): string
    {
        return match ($this) {
            self::Materials => 'Materials',
            self::Fabrication => 'Fabrication',
            self::EquipmentRental => 'Equipment rental',
            self::Labor => 'Labor',
            self::Transportation => 'Transportation',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(fn (self $type) => $type->value, self::cases());
    }

    /** @return list<array{value: string, label: string}> for select boxes */
    public static function options(): array
    {
        return array_map(fn (self $type) => ['value' => $type->value, 'label' => $type->label()], self::cases());
    }
}
