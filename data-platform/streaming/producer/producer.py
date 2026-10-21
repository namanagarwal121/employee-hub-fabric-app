"""HR event simulator: streams employee events to a Fabric Eventstream.

Sends one JSON event per hire, change or leaver to an Eventstream custom
endpoint over the Event Hubs protocol. The apply notebook later lands these
events in the app's SQL database, so the payload uses business keys
(EmployeeID, department and job-title names), never the app's internal ids.

    python producer.py --dry-run --count 10        # print events, send nothing
    python producer.py --rate 1 --duration 300     # stream for five minutes
    python producer.py --bad-rate 0.05 --dup-rate 0.05 --late-rate 0.05

The connection string is read from EVENTSTREAM_CONNECTION_STRING (environment
or a .env file next to this script). It must include EntityPath=...
"""

from __future__ import annotations

import argparse
import json
import os
import random
import signal
import sys
import time
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
STATE_FILE = HERE / ".state" / "hr_feed_state.json"
SOURCE = "hr-feed-simulator"
SCHEMA_VERSION = 1

# Stream-owned employees use their own EmployeeID range, so they never clash
# with the app, which numbers manual employees from 1 upwards.
FIRST_STREAM_ID = 900_001

# Departments and titles that already exist in the app's lookup tables.
# An event naming anything else is rejected by the apply notebook.
DEPARTMENTS: dict[str, list[str]] = {
    "Analytics": ["Data Analyst", "BI Developer", "Senior BI Developer", "Analytics Manager"],
    "Customer Support": ["Support Associate", "Support Team Lead"],
    "Data Engineering": ["Data Engineer", "Senior Data Engineer", "Data Architect"],
    "Engineering": ["Software Engineer", "Senior Software Engineer", "QA Engineer",
                    "Data Engineer", "Senior Data Engineer", "Engineering Manager"],
    "Finance": ["Accountant", "Financial Analyst", "Finance Manager"],
    "Human Resources": ["HR Executive", "Recruiter", "HR Business Partner", "HR Manager"],
    "Marketing": ["Marketing Executive", "Content Strategist", "Marketing Manager"],
    "Operations": ["Operations Analyst", "Operations Manager"],
    "Product": ["Product Analyst", "Product Manager"],
    "Sales": ["Sales Executive", "Account Manager", "Sales Manager"],
}
# Annual salary bands in INR, matching the app's existing data.
SALARY_BAND = {"Manager": (1_800_000, 3_000_000), "Senior": (1_400_000, 2_400_000),
               "Architect": (2_000_000, 3_000_000), "Lead": (1_100_000, 1_700_000),
               "default": (450_000, 1_300_000)}

FIRST_NAMES = ["Aarav", "Aditi", "Aisha", "Ananya", "Arjun", "Diya", "Farhan", "Gauri", "Ishaan",
               "Kabir", "Kavya", "Meera", "Neha", "Nikhil", "Pooja", "Rohan", "Saanvi", "Sahil",
               "Sneha", "Tanvi", "Varun", "Vikram", "Yash", "Zoya", "Riya", "Karan", "Simran"]
LAST_NAMES = ["Agarwal", "Bose", "Chopra", "Das", "Gupta", "Iyer", "Joshi", "Kapoor", "Khan",
              "Mehta", "Menon", "Nair", "Patel", "Rao", "Reddy", "Saxena", "Shah", "Singh",
              "Sinha", "Tiwari", "Verma", "Yadav"]


_last_ts = datetime.min.replace(tzinfo=timezone.utc)


def utc_now() -> datetime:
    """Strictly increasing UTC time (millisecond steps), so "newest event wins" never ties."""
    global _last_ts
    _last_ts = max(datetime.now(timezone.utc), _last_ts + timedelta(milliseconds=1))
    return _last_ts


def iso(ts: datetime) -> str:
    return ts.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def salary_for(title: str) -> float:
    band = next((v for k, v in SALARY_BAND.items() if k in title), SALARY_BAND["default"])
    return round(random.randint(*band) / 500) * 500.0


@dataclass
class HrState:
    """What the simulated HR system knows. It is not the app's database."""
    next_id: int = FIRST_STREAM_ID
    employees: dict[str, dict] = field(default_factory=dict)   # EmployeeID -> employee
    last_event_time: dict[str, str] = field(default_factory=dict)

    @classmethod
    def load(cls) -> "HrState":
        if STATE_FILE.exists():
            return cls(**json.loads(STATE_FILE.read_text()))
        return cls()

    def save(self) -> None:
        STATE_FILE.parent.mkdir(exist_ok=True)
        tmp = STATE_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.__dict__, indent=1))
        tmp.replace(STATE_FILE)

    def copy(self) -> "HrState":
        return HrState(**json.loads(json.dumps(self.__dict__)))


def envelope(event_type: str, employee: dict, change: str | None = None,
             event_time: datetime | None = None) -> dict:
    return {
        "event_id": str(uuid.uuid4()),
        "event_type": f"employee.{event_type}",
        "event_time": iso(event_time or utc_now()),
        "source": SOURCE,
        "schema_version": SCHEMA_VERSION,
        "change": change,
        "employee": dict(employee),
    }


class EventFactory:
    """Turns HR state into the next realistic event, and applies it to the state."""

    def __init__(self, state: HrState, bad_rate: float, dup_rate: float, late_rate: float):
        self.state = state
        self.bad_rate, self.dup_rate, self.late_rate = bad_rate, dup_rate, late_rate
        self.previous: dict | None = None

    def next(self) -> tuple[dict, str]:
        """Returns (event, kind). kind tags test events: ok, duplicate, late, bad."""
        roll = random.random()
        if self.previous and roll < self.dup_rate:
            return self.previous, "duplicate"          # same event_id again
        roll -= self.dup_rate
        if self.state.employees and roll < self.late_rate:
            return self._late_update(), "late"
        roll -= self.late_rate
        if roll < self.bad_rate:
            return self._bad_event(), "bad"

        active = len(self.state.employees)
        kind = random.choices(["created", "updated", "deleted"],
                              weights=[0.35, 0.5, 0.15])[0] if active >= 5 else "created"
        event = {"created": self._hire, "updated": self._change, "deleted": self._leave}[kind]()
        self.previous = event
        self.state.last_event_time[str(event["employee"]["EmployeeID"])] = event["event_time"]
        return event, "ok"

    # --- valid events -----------------------------------------------------
    def _hire(self) -> dict:
        emp_id = self.state.next_id
        self.state.next_id += 1
        first, last = random.choice(FIRST_NAMES), random.choice(LAST_NAMES)
        dept = random.choice(list(DEPARTMENTS))
        title = random.choice(DEPARTMENTS[dept])
        employee = {
            "EmployeeID": emp_id,
            "FullName": f"{first} {last}",
            # The id suffix keeps emails unique; Email is unique in the app.
            "Email": f"{first}.{last}.{emp_id}@example.com".lower(),
            "Salary": salary_for(title),
            "JoiningDate": (date.today() + timedelta(days=random.randint(0, 45))).isoformat(),
            "Department": dept,
            "JobTitle": title,
        }
        self.state.employees[str(emp_id)] = employee
        return envelope("created", employee, "new_hire")

    def _change(self) -> dict:
        key = random.choice(list(self.state.employees))
        employee = self.state.employees[key]
        change = random.choices(["salary_change", "promotion", "transfer", "name_change"],
                                weights=[0.45, 0.25, 0.2, 0.1])[0]
        if change == "salary_change":
            employee["Salary"] = round(employee["Salary"] * random.uniform(1.03, 1.15) / 500) * 500.0
        elif change == "promotion":
            titles = DEPARTMENTS[employee["Department"]]
            higher = titles[titles.index(employee["JobTitle"]) + 1:] if employee["JobTitle"] in titles else []
            if higher:
                employee["JobTitle"] = higher[0]
                employee["Salary"] = max(employee["Salary"] * 1.12, salary_for(higher[0]))
                employee["Salary"] = round(employee["Salary"] / 500) * 500.0
            else:
                change = "salary_change"
                employee["Salary"] = round(employee["Salary"] * 1.08 / 500) * 500.0
        elif change == "transfer":
            dept = random.choice([d for d in DEPARTMENTS if d != employee["Department"]])
            employee["Department"], employee["JobTitle"] = dept, random.choice(DEPARTMENTS[dept])
        else:   # married name, corrected spelling, ...
            employee["FullName"] = f'{employee["FullName"].split()[0]} {random.choice(LAST_NAMES)}'
        return envelope("updated", employee, change)

    def _leave(self) -> dict:
        key = random.choice(list(self.state.employees))
        employee = self.state.employees.pop(key)
        return envelope("deleted", employee, "leaver")

    # --- test events (never change the state) -----------------------------
    def _late_update(self) -> dict:
        """An update that arrives after a newer one for the same employee; it must be ignored."""
        key = random.choice(list(self.state.employees))
        stale = dict(self.state.employees[key], Salary=1.0)   # obviously wrong if applied
        newest = datetime.fromisoformat(self.state.last_event_time.get(key, iso(utc_now())).replace("Z", "+00:00"))
        return envelope("updated", stale, "late_arrival", newest - timedelta(minutes=random.randint(5, 60)))

    def _bad_event(self) -> dict:
        base = self._hire()
        self.state.employees.pop(str(base["employee"]["EmployeeID"]))   # never really hired
        emp = base["employee"]
        problem = random.choice(["unknown_department", "missing_email", "negative_salary",
                                 "bad_date", "unknown_event_type"])
        if problem == "unknown_department":
            emp["Department"] = "Space Exploration"
        elif problem == "missing_email":
            emp.pop("Email")
        elif problem == "negative_salary":
            emp["Salary"] = -5000.0
        elif problem == "bad_date":
            emp["JoiningDate"] = "2026-02-30"
        else:
            base["event_type"] = "employee.promoted"
        base["change"] = f"test_{problem}"
        return base


def load_dotenv() -> None:
    env = HERE / ".env"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


class Sender:
    def __init__(self, dry_run: bool):
        self.dry_run = dry_run
        self.client = None
        if dry_run:
            return
        conn = os.environ.get("EVENTSTREAM_CONNECTION_STRING", "")
        if "EntityPath=" not in conn:
            sys.exit("Set EVENTSTREAM_CONNECTION_STRING (with EntityPath=...) in .env or the environment. "
                     "Copy it from the Eventstream custom endpoint source: Event Hub > Keys.")
        from azure.eventhub import EventData, EventHubProducerClient   # only needed when sending
        self.EventData = EventData
        self.client = EventHubProducerClient.from_connection_string(conn)

    def send(self, events: list[dict]) -> None:
        if self.dry_run:
            for e in events:
                print(json.dumps(e, ensure_ascii=False))
            return
        # One batch per EmployeeID: the partition key keeps each employee's events in order.
        by_key: dict[str, list[dict]] = {}
        for e in events:
            by_key.setdefault(str(e["employee"].get("EmployeeID")), []).append(e)
        for key, group in by_key.items():
            batch = self.client.create_batch(partition_key=key)
            for e in group:
                data = self.EventData(json.dumps(e, ensure_ascii=False))
                data.content_type = "application/json"
                data.properties = {"event_type": e["event_type"], "source": SOURCE}
                batch.add(data)
            self.client.send_batch(batch)

    def close(self) -> None:
        if self.client:
            self.client.close()


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--rate", type=float, default=1.0, help="events per second (default 1)")
    p.add_argument("--count", type=int, help="stop after this many events")
    p.add_argument("--duration", type=float, help="stop after this many seconds")
    p.add_argument("--dry-run", action="store_true", help="print events instead of sending; state is not saved")
    p.add_argument("--bad-rate", type=float, default=0.0, help="share of invalid events, to test rejects")
    p.add_argument("--dup-rate", type=float, default=0.0, help="share of re-sent events, to test idempotency")
    p.add_argument("--late-rate", type=float, default=0.0, help="share of out-of-order updates, to test ordering")
    p.add_argument("--seed", type=int, help="random seed for a repeatable run")
    p.add_argument("--reset", action="store_true", help="forget the simulated HR state and start from 900001")
    args = p.parse_args()
    if args.rate <= 0:
        p.error("--rate must be positive")

    if args.seed is not None:
        random.seed(args.seed)
    load_dotenv()
    if args.reset and STATE_FILE.exists():
        STATE_FILE.unlink()

    state = HrState.load()
    factory = EventFactory(state, args.bad_rate, args.dup_rate, args.late_rate)
    sender = Sender(args.dry_run)

    stop = False
    def on_signal(*_):
        nonlocal stop
        stop = True
    signal.signal(signal.SIGINT, on_signal)
    signal.signal(signal.SIGTERM, on_signal)

    sent, kinds, started = 0, {}, time.monotonic()
    log = sys.stderr
    print(f"{'DRY RUN' if args.dry_run else 'Streaming'} · {args.rate}/s · "
          f"{len(state.employees)} active stream employees · next id {state.next_id}", file=log)
    try:
        while not stop:
            if args.count is not None and sent >= args.count:
                break
            if args.duration is not None and time.monotonic() - started >= args.duration:
                break
            tick = time.monotonic()
            n = max(1, int(args.rate)) if args.rate >= 1 else 1
            if args.count is not None:
                n = min(n, args.count - sent)
            snapshot = state.copy()
            events, tick_kinds = [], []
            for _ in range(n):
                event, kind = factory.next()
                events.append(event)
                tick_kinds.append(kind)
            try:
                sender.send(events)
            except Exception as exc:   # keep the HR state in step with what was actually sent
                factory.state = state = snapshot
                factory.previous = None
                print(f"send failed, state rolled back: {exc}", file=log)
                time.sleep(5)
                continue
            sent += len(events)
            for kind in tick_kinds:
                kinds[kind] = kinds.get(kind, 0) + 1
            if not args.dry_run:
                state.save()
                for e in events:
                    print(f"{e['event_time']}  {e['event_type']:<17} {e['employee'].get('EmployeeID')}  "
                          f"{e['change'] or ''}", file=log)
            interval = (n / args.rate) if args.rate >= 1 else (1 / args.rate)
            time.sleep(max(0.0, interval - (time.monotonic() - tick)))
    finally:
        sender.close()
    print(f"done · {sent} events · {kinds} · {len(state.employees)} active stream employees", file=log)


if __name__ == "__main__":
    main()
