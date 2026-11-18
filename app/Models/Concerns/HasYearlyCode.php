<?php

namespace App\Models\Concerns;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * A reference code with the year it was created and a number that starts
 * again at 0001 every year: "PRJ-26-0001", "PRJ-26-0002", ..., "PRJ-27-0001".
 *
 * The year is the year the record was created (Manila time), not the event
 * year, so the code never changes when dates move. The year comes before the
 * number so codes sort by year, then number.
 *
 * The code is given right after the record is saved, so every way of creating
 * one (customer request, the Project Manager approving it, seeders) gets it.
 * The column is unique; if two records are created at the same moment and
 * take the same number, the second one simply takes the next.
 *
 * The model sets: const CODE_PREFIX = 'PRJ'; const CODE_COLUMN = 'project_code';
 *
 * @mixin Model
 */
trait HasYearlyCode
{
    public const CODE_TIMEZONE = 'Asia/Manila';

    protected static function bootHasYearlyCode(): void
    {
        static::created(function (self $model): void {
            if (! $model->getAttribute(static::CODE_COLUMN)) {
                $model->assignYearlyCode();
            }
        });
    }

    /** "PRJ-26-0001" for a prefix, a year and a number. */
    public static function formatYearlyCode(string $prefix, CarbonInterface $date, int $number): string
    {
        return sprintf('%s-%s-%04d', $prefix, Carbon::parse($date)->timezone(self::CODE_TIMEZONE)->format('y'), $number);
    }

    /** The date whose year goes in the code. */
    protected function yearlyCodeDate(): CarbonInterface
    {
        $created = $this->getAttribute($this->getCreatedAtColumn());

        return $created instanceof CarbonInterface ? $created : Carbon::now();
    }

    public function assignYearlyCode(): void
    {
        $column = static::CODE_COLUMN;
        $start = self::formatYearlyCode(static::CODE_PREFIX, $this->yearlyCodeDate(), 0);
        $yearPrefix = substr($start, 0, -4); // "PRJ-26-"

        for ($attempt = 1; ; $attempt++) {
            $last = static::query()->where($column, 'like', $yearPrefix.'%')->max($column);
            $code = $yearPrefix.sprintf('%04d', $last ? (int) substr((string) $last, strlen($yearPrefix)) + 1 : 1);

            try {
                // Its own savepoint, so a clash doesn't spoil an outer transaction.
                DB::transaction(fn () => static::query()->whereKey($this->getKey())->update([$column => $code]));
            } catch (UniqueConstraintViolationException $e) {
                if ($attempt >= 5) {
                    throw $e;
                }

                continue;
            }

            $this->setAttribute($column, $code);
            $this->syncOriginalAttribute($column);

            return;
        }
    }
}
