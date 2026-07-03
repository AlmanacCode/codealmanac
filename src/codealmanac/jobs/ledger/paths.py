from pathlib import Path

from pydantic import TypeAdapter

from codealmanac.jobs.ledger.models import JobId

JOB_ID_ADAPTER = TypeAdapter(JobId)


def jobs_dir(almanac_path: Path) -> Path:
    return almanac_path


def job_record_path(almanac_path: Path, job_id: str) -> Path:
    job_id = validate_job_id(job_id)
    return jobs_dir(almanac_path) / f"{job_id}.json"


def job_spec_path(almanac_path: Path, job_id: str) -> Path:
    job_id = validate_job_id(job_id)
    return jobs_dir(almanac_path) / f"{job_id}.spec.json"


def job_log_path(almanac_path: Path, job_id: str) -> Path:
    job_id = validate_job_id(job_id)
    return jobs_dir(almanac_path) / f"{job_id}.jsonl"


def job_log_reference_path(log_reference_dir: Path, job_id: str) -> Path:
    job_id = validate_job_id(job_id)
    return log_reference_dir / f"{job_id}.jsonl"


def worker_lock_path(almanac_path: Path) -> Path:
    return jobs_dir(almanac_path) / "worker.lock"


def worker_lock_owner_path(lock_path: Path) -> Path:
    return lock_path / "owner.json"


def validate_job_id(job_id: str) -> JobId:
    return JOB_ID_ADAPTER.validate_python(job_id)
