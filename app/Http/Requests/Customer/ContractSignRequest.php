<?php

namespace App\Http\Requests\Customer;

use App\Services\Contracts;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * E-signing the contract: the drawn signature and the customer's
 * agreement. The name printed under the signature comes from the customer's
 * account (customers table), so it isn't typed.
 *
 * `signature` is a JSON list of strokes, each a list of [x, y] points on the
 * 600×200 signature pad. The SVG stamped onto the PDF is built from these
 * points on the server.
 */
class ContractSignRequest extends FormRequest
{
    public const MAX_STROKES = 60;

    public const MAX_POINTS = 6000;

    /** At least this many points in total, so a single dot doesn't count as a signature. */
    public const MIN_POINTS = 8;

    /** @var list<list<array{0: float, 1: float}>> */
    private array $strokes = [];

    public function authorize(): bool
    {
        // The route is limited to customers; the controller checks the project is theirs.
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'signature' => ['required', 'string', 'max:200000'],
            'agree' => ['accepted'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'signature.required' => 'Draw your signature.',
            'agree.accepted' => 'Please confirm that you have read and agree to the contract.',
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->has('signature')) {
                return;
            }

            $strokes = json_decode((string) $this->input('signature'), true);

            if (! $this->validStrokes($strokes)) {
                $validator->errors()->add('signature', 'Draw your signature in the box.');

                return;
            }

            $this->strokes = $strokes;
        }];
    }

    /** @return list<list<array{0: float, 1: float}>> */
    public function strokes(): array
    {
        return $this->strokes;
    }

    private function validStrokes(mixed $strokes): bool
    {
        if (! is_array($strokes) || ! array_is_list($strokes) || $strokes === [] || count($strokes) > self::MAX_STROKES) {
            return false;
        }

        $total = 0;

        foreach ($strokes as $stroke) {
            if (! is_array($stroke) || ! array_is_list($stroke) || $stroke === []) {
                return false;
            }

            foreach ($stroke as $point) {
                if (! is_array($point) || count($point) !== 2
                    || ! is_numeric($point[0] ?? null) || ! is_numeric($point[1] ?? null)
                    || $point[0] < 0 || $point[0] > Contracts::PAD_WIDTH
                    || $point[1] < 0 || $point[1] > Contracts::PAD_HEIGHT) {
                    return false;
                }

                $total++;
            }
        }

        return $total >= self::MIN_POINTS && $total <= self::MAX_POINTS;
    }
}
