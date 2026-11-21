<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One version of a project's contract.
 *
 *
 * @property int $contract_id
 * @property int $project_id
 * @property int|null $design_proposal_id
 * @property int $version_number
 * @property string $status issued | signed | verified | rejected
 * @property \Carbon\CarbonInterface $issued_at
 * @property string $contract_file_path the generated, unsigned PDF
 * @property array<string, mixed> $contract_data the values the PDF was made from
 * @property \Carbon\CarbonInterface|null $signed_at
 * @property string|null $sign_method electronic | upload
 * @property string|null $signer_name
 * @property string|null $signed_file_name
 * @property string|null $signed_contract_path
 * @property string|null $executed_contract_path the fully signed PDF (customer + Owner), once verified
 * @property int|null $reviewed_by user id
 * @property \Carbon\CarbonInterface|null $reviewed_at
 * @property \Carbon\CarbonInterface|null $verified_at
 * @property string|null $rejection_reason
 * @property list<string>|null $checklist
 */
class Contract extends Model
{
    public const STATUS_ISSUED = 'issued';

    public const STATUS_SIGNED = 'signed';

    public const STATUS_VERIFIED = 'verified';

    public const STATUS_REJECTED = 'rejected';

    public const METHOD_ELECTRONIC = 'electronic';

    public const METHOD_UPLOAD = 'upload';

    protected $primaryKey = 'contract_id';

    protected $fillable = [
        'project_id',
        'design_proposal_id',
        'version_number',
        'status',
        'issued_at',
        'contract_file_path',
        'contract_data',
        'signed_at',
        'sign_method',
        'signer_name',
        'signed_file_name',
        'signed_contract_path',
        'executed_contract_path',
        'reviewed_by',
        'reviewed_at',
        'verified_at',
        'rejection_reason',
        'checklist',
    ];

    protected function casts(): array
    {
        return [
            'version_number' => 'integer',
            'reviewed_by' => 'integer',
            'issued_at' => 'datetime',
            'contract_data' => 'array',
            'signed_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'verified_at' => 'datetime',
            'checklist' => 'array',
        ];
    }

    /** e.g. "CON-26-0006": the project's code with CON, shared by all its versions. */
    public function code(): string
    {
        return self::codeFor($this->project);
    }

    /** "PRJ-26-0006" → "CON-26-0006". */
    public static function codeFor(Project $project): string
    {
        return 'CON-'.substr((string) $project->project_code, strlen(Project::CODE_PREFIX.'-'));
    }

    /**
     * The file name the customer downloads, e.g. "CON-26-0006_v1_Contract.pdf".
     * $file: 'contract' (unsigned), 'signed' (the customer's copy) or 'executed' (fully signed).
     */
    public function downloadName(string $file = 'contract'): string
    {
        if ($file === 'signed' && $this->sign_method === self::METHOD_UPLOAD && $this->signed_file_name) {
            return $this->signed_file_name;
        }

        $label = ['signed' => 'Signed-Contract', 'executed' => 'Fully-Signed-Contract'][$file] ?? 'Contract';

        return sprintf('%s_v%d_%s.pdf', $this->code(), $this->version_number, $label);
    }

    /** The signed copy's extension (pdf, jpg, png). */
    public function signedExtension(): ?string
    {
        return $this->signed_contract_path ? strtolower(pathinfo($this->signed_contract_path, PATHINFO_EXTENSION)) : null;
    }

    /** @return BelongsTo<Project, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    /** @return BelongsTo<DesignProposal, $this> */
    public function designProposal(): BelongsTo
    {
        return $this->belongsTo(DesignProposal::class, 'design_proposal_id');
    }

    /** @return BelongsTo<User, $this> */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
